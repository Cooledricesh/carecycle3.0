# 인증 초기화 순서 문제 해결 문서

## 작성 목적
Auth Provider의 비동기 초기화 순서 문제로 인한 15초 빈 화면 버그의 근본 원인과 해결 방법을 기록.
**동일한 비동기 타이밍 실수를 반복하지 않기 위한 필독 문서.**

---

## 📋 목차
1. [문제 정의](#문제-정의)
2. [근본 원인 분석](#-근본-원인-분석)
3. [최종 해결책](#-최종-해결책)
4. [디버깅이 어려웠던 이유](#-디버깅이-어려웠던-이유)
5. [실패한 시도들](#-실패한-시도들)
6. [재발 방지 가이드](#-재발-방지-가이드)
7. [체크리스트](#-체크리스트)

---

## 문제 정의

### 증상
- **로그인 성공 후 Dashboard 접속 시 15초 동안 빈 화면 표시**
- "프로필 설정 필요" 메시지가 표시됨 (실제로는 프로필 존재)
- 강제 새로고침 후에도 동일한 증상 반복
- 서버 로그는 정상 (26ms~193ms 응답)
- 네트워크 탭에서 profile fetch 요청이 보이지 않음

### 영향 범위
- `/dashboard` 페이지
- `/dashboard/patients`, `/dashboard/schedules` 등 모든 보호된 라우트
- 로그인 직후 첫 접속 시 매번 발생

---

## 💡 근본 원인 분석

### 문제의 계층 구조

```
증상: "프로필이 안 보여요"
  ↓
1층: Dashboard의 중복 fetch 문제
  ↓
2층: Auth Provider의 중복 fetch 문제
  ↓
3층: getSession() hanging 문제
  ↓
4층: Auth Provider와 useProfile의 경쟁 상태
  ↓
5층: 초기화 순서 문제 ← 진짜 원인 (Root Cause)
```

### 핵심 문제: 비동기 초기화 순서

#### ❌ 문제가 있던 코드

```typescript
// src/providers/auth-provider-simple.tsx (Before)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);  // 초기값: null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // 🔴 문제 1: loading을 즉시 false로 설정
    setLoading(false);  // ← 여기서 loading이 false가 됨

    // 🔴 문제 2: user는 여전히 null
    // INITIAL_SESSION 이벤트가 올 때까지 user가 null로 유지됨
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          setUser(session?.user ?? null);  // ← 이건 나중에 실행됨
        }
      }
    );
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### 타임라인 분석

```
시간 →  0ms          100ms        ???ms (15초)
─────────────────────────────────────────────────
setLoading(false)    ⚡ 즉시 실행
user = null          ← 여전히 null

useProfile 실행      ❌ enabled: !!user?.id → false
                     → 쿼리가 비활성화됨

Dashboard 렌더링     빈 화면 표시 (user 없음)

                     ⏰ 비동기로 나중에...
                     INITIAL_SESSION 이벤트 도착
                     setUser(session.user)

                     useProfile 활성화
                     데이터 로드 시작
```

### 의존성 체인의 문제

```
loading = false
    ↓
user = null (아직 설정 안 됨)
    ↓
useProfile.enabled = !!user?.id = false
    ↓
쿼리 실행 안 됨
    ↓
profile = null
    ↓
Dashboard: "프로필 설정 필요" 표시
```

---

## ✅ 최종 해결책

### 핵심 원칙
> **"데이터가 준비되기 전에는 loading을 false로 하지 마라"**

### 수정된 코드

```typescript
// src/providers/auth-provider-simple.tsx (After)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);  // 여전히 true로 시작
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // ✅ 해결책: 초기 세션을 먼저 동기적으로 체크
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null);  // 1. user 먼저 설정
        setLoading(false);                // 2. 그 다음 loading 해제
      }
    });

    // 이후 변경사항만 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
      }

      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 개선된 타임라인

```
시간 →  0ms          50ms         100ms
────────────────────────────────────────
loading = true       (여전히 로딩 중)

getSession() 호출    ⚡ Promise 시작

                     ✅ session 응답 도착
                     setUser(user)
                     setLoading(false)

                     useProfile 활성화
                     쿼리 실행 (enabled = true)

                     profile 데이터 로드
                     Dashboard 렌더링
```

### 부가 개선 사항

#### 1. Auth Provider 단순화
```typescript
// ❌ Before: profile도 함께 관리
interface AuthContextType {
  user: User | null
  profile: UserProfile | null  // 중복!
  loading: boolean
}

// ✅ After: user만 관리
interface AuthContextType {
  user: User | null
  loading: boolean
}
```

#### 2. Dashboard에서 useProfile 직접 사용
```typescript
// ❌ Before: Auth Provider의 profile 사용
const { user, profile } = useAuth();

// ✅ After: useProfile hook 사용
const { user } = useAuth();
const { data: profile, isLoading: profileLoading } = useProfile();

if (profileLoading) {
  return <LoadingSpinner message="프로필 로딩 중..." />;
}
```

#### 3. 과도한 디버그 로그 제거
```typescript
// ❌ Before: 수백 개의 로그
console.log('[Supabase Client Debug] Reusing existing singleton instance');
console.log('[useProfile Debug] Starting query...');
console.log('[useProfile Debug] Query completed:', { ... });

// ✅ After: 에러만 로그
console.error('[useProfile] Error fetching profile:', error.message);
console.error('[useProfile] Query timeout:', timeoutError.message);
```

---

## 🤔 디버깅이 어려웠던 이유

### 1. 문제의 비가시성

```typescript
// 로그에 나타나는 것
✅ [Supabase Client Debug] Client created successfully
✅ GET /dashboard 200 in 26ms
✅ [getTodayChecklist] Query successful: 5 items

// 로그에 나타나지 않는 것 (진짜 문제)
❌ user is null
❌ useProfile is disabled
❌ waiting for INITIAL_SESSION event
```

**교훈**: **"무엇이 없는지"를 봐야 한다.**

### 2. 비동기 타이밍의 특성

- **동기 코드는 즉시 실행** (`setLoading(false)`)
- **비동기 코드는 나중에 실행** (`onAuthStateChange` 콜백)
- 둘 사이의 간격이 얼마나 될지 알 수 없음 (15초 발생)

**교훈**: **시간 축에서 생각해야 한다.** "무엇이 먼저, 무엇이 나중에?"

### 3. 계층이 깊음

표면적 증상 → 5단계 아래의 진짜 원인

**교훈**: **"왜?"를 5번 물어라.**

### 4. 노이즈가 많음

- Supabase Client Debug: 수백 번 반복
- 여러 서비스 로그 혼재
- 진짜 문제는 숨어있음

**교훈**: **과도한 로그는 문제를 숨긴다.**

---

## 💥 실패한 시도들

### 시도 1: Dashboard의 중복 fetch 제거
```typescript
// useEffect에서 profile fetch 제거
// → 개선되었지만 여전히 느림
```
**결과**: 부분적 개선, 근본 원인 아님

### 시도 2: React Query 설정 최적화
```typescript
staleTime: 0 → 30 * 1000
refetchOnMount: 'always' → true
```
**결과**: 약간 빨라졌지만 15초 문제 지속

### 시도 3: Auth Provider의 profile fetch 제거
```typescript
// fetchUserProfile() 함수 제거
// → timeout 에러 발생
```
**결과**: 경쟁 상태 해결, 하지만 여전히 느림

### 시도 4: getSession() hanging 문제 해결
```typescript
// session check 제거, 직접 쿼리로 변경
// → timeout 보호 추가
```
**결과**: timeout은 작동하지만 여전히 10초 대기

### 시도 5: 디버그 로그 제거
```typescript
// 수백 개의 로그 제거
// → 콘솔은 깔끔해졌지만 여전히 느림
```
**결과**: 가독성 개선, 성능 문제는 미해결

### 시도 6 (최종 성공): 초기화 순서 수정
```typescript
// getSession()으로 초기 세션 체크 후 loading 해제
```
**결과**: ✅ 15초 → 1~2초로 극적 개선!

---

## 🛡️ 재발 방지 가이드

### A. 인증/초기화 패턴 - 황금 규칙

```typescript
// ❌ 안티패턴
useEffect(() => {
  setLoading(false);  // 너무 일찍!

  someAsyncFunction().then(data => {
    setData(data);  // 나중에 도착
  });
});

// ✅ 올바른 패턴
useEffect(() => {
  someAsyncFunction().then(data => {
    setData(data);      // 1. 데이터 먼저
    setLoading(false);  // 2. loading 나중에
  });
});
```

### B. React Query enabled 패턴

```typescript
// ❌ 위험한 패턴
const { data } = useQuery({
  queryKey: ['profile', user?.id],
  enabled: !!user?.id,  // user가 null이면 쿼리 실행 안 됨
  queryFn: fetchProfile
});

// ✅ 안전한 패턴
// 1. 의존 데이터(user)의 초기화를 먼저 보장
// 2. 타임아웃 보호 추가
useQuery({
  queryKey: ['profile', user?.id],
  enabled: !!user?.id,
  queryFn: async () => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );
    return Promise.race([fetchProfile(), timeoutPromise]);
  }
});
```

### C. 로깅 전략

```typescript
// ❌ 너무 많은 로그
console.log('[Debug] Function called');
console.log('[Debug] Step 1 complete');
console.log('[Debug] Step 2 complete');

// ✅ 의미 있는 로그만
// 1. 상태 전환
console.log('[Auth] User initialized:', user?.id);

// 2. 에러
console.error('[Auth] Initialization failed:', error);

// 3. 성능 문제
if (duration > 1000) {
  console.warn('[Performance] Slow init:', duration + 'ms');
}
```

---

## 📋 체크리스트

### 비동기 초기화 구현 시

```markdown
- [ ] 초기 데이터를 먼저 동기적으로 가져오는가?
- [ ] 데이터 설정 완료 후 loading을 false로 하는가?
- [ ] 의존성 체인의 순서가 올바른가? (user → profile → UI)
- [ ] enabled 조건의 의존 데이터가 준비되었는가?
- [ ] 타임아웃 보호가 있는가?
- [ ] 에러 핸들링이 있는가?
```

### 코드 리뷰 시 (Auth 관련)

```markdown
- [ ] getSession() 호출로 초기 세션을 체크하는가?
- [ ] loading 상태가 데이터 준비 완료 후 false가 되는가?
- [ ] INITIAL_SESSION 이벤트를 제거했는가? (중복 처리)
- [ ] user가 null일 때 처리가 올바른가?
- [ ] 디버그 로그가 과도하지 않은가?
```

### 디버깅 시 (비동기 문제)

```markdown
- [ ] 타임라인을 그렸는가? (무엇이 먼저, 무엇이 나중에?)
- [ ] "없는" 로그를 찾았는가? (가장 중요!)
- [ ] 서버 응답은 빠른데 UI가 느린가?
- [ ] 의존성 체인을 확인했는가?
- [ ] 초기화 순서를 검증했는가?
```

---

## 📊 성능 영향

### Before vs After

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| 빈 화면 시간 | 15초 | 1~2초 | **87% 감소** |
| 초기 렌더링 | 없음 (빈 화면) | 로딩 UI 표시 | UX 개선 |
| profile fetch | 경쟁 상태 (중복) | 단일 진입점 | 안정성 향상 |
| 디버그 로그 | 수백 개 | 에러만 | 가독성 향상 |

---

## 🎯 핵심 교훈

### 1. 비동기 초기화의 황금 규칙
> **"데이터가 준비되기 전에는 loading을 false로 하지 마라"**

### 2. 타이밍이 전부다
```
동기 코드 (즉시) ≠ 비동기 코드 (나중에)
```
둘 사이의 간격을 항상 고려하라.

### 3. 의존성 순서를 명확히 하라
```
user (Auth) → profile (Data) → UI (Render)
```

### 4. "무엇이 없는가"를 관찰하라
로그에 나타나는 것보다 **나타나지 않는 것**이 더 중요하다.

### 5. 근본 원인을 찾아라
표면적 증상만 보고 1~2층에서 멈추지 마라. "왜?"를 5번 물어라.

---

## 🔗 관련 파일

### 수정된 파일
- `src/providers/auth-provider-simple.tsx` - 초기화 순서 수정
- `src/hooks/useProfile.ts` - 디버그 로그 정리
- `src/lib/supabase/client.ts` - 디버그 로그 제거
- `src/app/(protected)/dashboard/dashboard-content.tsx` - useProfile 직접 사용

### 참고 문서
- `/docs/adr/REALTIME_UPDATE_SOLUTION.md` - 캐시 무효화 패턴
- `/CLAUDE.md` - 프로젝트 가이드라인

---

## 📅 기록

- **문제 발생**: 2025-11-07
- **해결 완료**: 2025-11-07
- **작성자**: AI Assistant with User
- **영향**: 모든 보호된 라우트의 초기 로딩 성능 87% 개선

---

## 마무리

이 문서는 **"비동기 초기화 순서"**라는 고전적이지만 찾기 어려운 버그의 해결 과정을 기록합니다.

다음에 비슷한 증상이 나타나면:
1. 이 문서의 체크리스트를 먼저 확인하세요
2. 타임라인을 그려보세요
3. "무엇이 없는가"를 찾으세요
4. 의존성 순서를 검증하세요

**가장 중요한 것**: 데이터가 준비되기 전에는 loading을 false로 하지 마세요!
