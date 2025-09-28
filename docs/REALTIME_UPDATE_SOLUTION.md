# 실시간 데이터 업데이트 문제 해결 문서

## 작성 목적
전체 코드베이스에 걸친 실시간 업데이트 문제의 근본 원인과 해결 방법을 기록.
**동일한 실수를 반복하지 않기 위한 필독 문서.**

---

## 📋 목차
1. [문제 정의](#문제-정의)
2. [근본 원인 발견](#근본-원인-발견)
3. [최종 해결책](#최종-해결책)
4. [적용 범위](#적용-범위)
5. [실패한 시도들](#실패한-시도들)
6. [금지 사항](#금지-사항)
7. [체크리스트](#체크리스트)

---

## 문제 정의

### 문제 1: 페이지 내 액션 후 UI 업데이트 안됨
**증상:**
- 캘린더에서 스케줄 완료/삭제/일시중지/재개 후 UI가 즉시 업데이트되지 않음
- 스케줄 관리 페이지에서 스케줄 삭제 후에도 여전히 표시됨
- 환자 추가/삭제 후 목록이 갱신되지 않음
- 항목 추가/수정 후 변경사항이 보이지 않음

**공통점:** 모든 mutation 후 페이지 새로고침이 필요했음

### 문제 2: 다른 페이지에서 추가한 데이터가 반영 안됨
**증상:**
- 스케줄 관리 페이지에서 스케줄 추가 → 캘린더로 이동 → 새 스케줄 안 보임
- 환자 관리 페이지에서 환자 추가 → 스케줄 생성 시 환자 목록에 안 보임
- 다른 페이지에서 데이터 변경 → 돌아와도 이전 데이터 표시

**원인:** React Query 캐시 + scheduleServiceEnhanced 캐시의 이중 캐싱 문제

---

## 💡 근본 원인 발견

### 이중 캐시 시스템 문제

```
┌─────────────────────────────────────┐
│  React Query Cache (Layer 2)       │
│  - staleTime, refetchOnMount 등 관리│
└──────────────┬──────────────────────┘
               │ refetch 시도
               ↓
┌─────────────────────────────────────┐
│  scheduleServiceEnhanced (Layer 1) │
│  - 내부 Map 캐시 (TTL 있음)         │
│  - 캐시 hit 시 서버 요청 없이 반환  │
└─────────────────────────────────────┘
```

**핵심 문제:**
1. React Query가 `refetch()` 또는 `invalidateQueries()`를 호출
2. scheduleServiceEnhanced.getFilteredSchedules() 실행
3. **scheduleServiceEnhanced 내부 캐시 체크 → 캐시 hit**
4. 오래된 캐시 데이터 반환 (서버 요청 안 함!)
5. React Query는 "새 데이터를 받았다"고 착각
6. UI는 여전히 오래된 데이터 표시

### 증거 코드

`src/services/scheduleServiceEnhanced.ts`:
```typescript
// Line 28: 내부 캐시
private cache = new Map<string, CacheEntry<any>>()

// Line 64-82: 캐시 우선 체크
const cached = this.getFromCache<any[]>(cacheKey)
if (cached) {
  return { schedules: cached, metrics }  // 서버 안 감!
}
```

**왜 발견하는데 오래 걸렸나?**
- ScheduleEditModal은 이미 `scheduleServiceEnhanced.clearCache()`를 사용 중이었음
- 하지만 다른 mutation들은 React Query만 믿고 있었음
- 7번의 시도 모두 "React Query 설정"만 수정했음

---

## ✅ 최종 해결책

### 표준 패턴 (모든 mutation에 적용)

```typescript
// 1. 서비스 레이어 캐시 클리어
scheduleServiceEnhanced.clearCache()

// 2. 이벤트 발행 (관련 컴포넌트에 알림)
eventManager.emitScheduleChange()  // 또는 emitPatientChange(), emitProfileChange()

// 3. React Query 무효화 (선택적)
queryClient.invalidateQueries({ queryKey: ['schedules'] })
```

### 동작 원리

```
1. Mutation 성공
   ↓
2. scheduleServiceEnhanced.clearCache()
   → Layer 1 캐시 제거
   ↓
3. eventManager.emitScheduleChange()
   → 이벤트 구독 중인 컴포넌트들에 알림
   ↓
4. useScheduleRefetch 훅이 이벤트 수신
   → queryClient.refetchQueries() 실행
   ↓
5. scheduleServiceEnhanced.getFilteredSchedules()
   → 캐시 miss → 서버에서 최신 데이터 fetch
   ↓
6. UI 즉시 업데이트 ✅
```

---

## 📁 적용 범위 (전체 코드베이스)

### 수정된 파일 (총 10개)

| # | 파일 | 변경 사항 |
|---|------|----------|
| 1 | `lib/events/schedule-event-manager.ts` | ✅ 환자/프로필 이벤트 추가 |
| 2 | `app/(protected)/debug/profile/page.tsx` | ✅ window.location.reload 제거 |
| 3 | `hooks/usePatients.ts` | ✅ 캐시 클리어 + 이벤트 (생성/삭제) |
| 4 | `hooks/useItemMutations.ts` | ✅ 캐시 클리어 + 이벤트 (전체) |
| 5 | `hooks/useScheduleState.ts` | ✅ 캐시 클리어 + 이벤트 (일시정지/재개) |
| 6 | `hooks/useCalendarSchedules.ts` | ✅ mount 시 캐시 클리어, 폴링 제거 |
| 7 | `app/(protected)/dashboard/schedules/page.tsx` | ✅ 삭제/상태변경 시 캐시 클리어 |
| 8 | `components/schedules/schedule-create-modal.tsx` | ✅ 캐시 클리어 + 이벤트 |
| 9 | `components/schedules/schedule-edit-modal.tsx` | ✅ 이벤트 발행 추가 |
| 10 | `app/(protected)/dashboard/profile/page.tsx` | ✅ 에러 처리 개선 |

### 적용 예시

#### 1. Hook에서 적용 (usePatients.ts)
```typescript
const createMutation = useMutation({
  mutationFn: async (input: PatientCreateInput) => {
    return await patientService.create(input, supabase)
  },
  onSuccess: () => {
    scheduleServiceEnhanced.clearCache()
    eventManager.emitPatientChange()
    queryClient.invalidateQueries()
    toast({ title: '성공', description: '환자가 등록되었습니다.' })
  }
})
```

#### 2. 컴포넌트에서 적용 (schedules/page.tsx)
```typescript
const deleteMutation = useMutation({
  mutationFn: scheduleService.delete,
  onSuccess: async () => {
    scheduleServiceEnhanced.clearCache()
    eventManager.emitScheduleChange()
    await queryClient.invalidateQueries({ queryKey: ['schedules'] })
    toast({ title: '성공', description: '스케줄이 삭제되었습니다.' })
  }
})
```

#### 3. 모달에서 적용 (schedule-create-modal.tsx)
```typescript
const onSubmit = async (data: ScheduleCreateWithIntervalInput) => {
  await scheduleService.createWithCustomItem({ ... })

  // Clear cache and emit event
  const { scheduleServiceEnhanced } = require('@/services/scheduleServiceEnhanced')
  const { eventManager } = require('@/lib/events/schedule-event-manager')
  scheduleServiceEnhanced.clearCache()
  eventManager.emitScheduleChange()

  toast({ title: '성공', description: '스케줄이 추가되었습니다.' })
}
```

#### 4. 캘린더 페이지 진입 시 (useCalendarSchedules.ts)
```typescript
export function useCalendarSchedules(currentDate: Date) {
  // Clear cache on mount to ensure fresh data
  useEffect(() => {
    scheduleServiceEnhanced.clearCache()
  }, [monthStart, monthEnd])

  return useQuery({
    queryKey: ['calendar-schedules', ...],
    queryFn: async () => { ... },
    staleTime: 0,
    refetchOnMount: 'always'  // 항상 최신 데이터
  })
}
```

---

## ❌ 실패한 시도들 (7번의 시도)

<details>
<summary>시도 1: refetchInterval 제거</summary>

**변경:** `refetchInterval: 60000` 제거, `staleTime: 0` 추가
**결과:** ❌ 실패
**이유:** Query invalidation만으로는 자동 refetch가 트리거되지 않음
</details>

<details>
<summary>시도 2-3: Optimistic Update 추가/제거</summary>

**변경:** `queryClient.setQueriesData`로 낙관적 업데이트
**결과:** ❌ 실패
**이유:** 캘린더는 scheduled와 completed 모두 표시. 로직 불일치.
</details>

<details>
<summary>시도 4: refetchType 'all' 추가</summary>

**변경:** `invalidateQueries({ refetchType: 'all' })`
**결과:** ❌ 실패
**이유:** Query key 부분 매칭 안 됨
</details>

<details>
<summary>시도 5: 명시적 refetch() 호출</summary>

**변경:** `await refetch()` 직접 호출
**결과:** ❌ 실패
**이유:** React Query 내부 메커니즘 문제
</details>

<details>
<summary>시도 6: Exact Query Key Invalidation</summary>

**변경:** 전체 query key로 정확히 invalidation
**결과:** ❌ 실패
**이유:** scheduleServiceEnhanced 캐시를 못 건드림
</details>

<details>
<summary>시도 7: Event-Driven Direct Refetch</summary>

**변경:** 이벤트 시스템 도입, `refetchQueries()` 직접 호출
**결과:** ❌ 부분 실패
**이유:** scheduleServiceEnhanced 캐시 클리어를 안 해서 여전히 문제
</details>

### 시도 8: scheduleServiceEnhanced Cache Clear ✅ 성공!

**변경:** 시도 7 + `scheduleServiceEnhanced.clearCache()` 추가
**결과:** ✅ **100% 성공**
**테스트:**
- ✅ 스케줄 완료: 즉시 업데이트
- ✅ 스케줄 일시정지/재개: 즉시 업데이트
- ✅ 스케줄 삭제: 즉시 업데이트
- ✅ 환자 추가/삭제: 즉시 업데이트
- ✅ 항목 변경: 즉시 업데이트
- ✅ 페이지 이동 후에도 최신 데이터
- ✅ 페이지 새로고침 불필요
- ✅ 깜빡임 없음

---

## 🚫 금지 사항

### 절대 다시 시도하지 말 것

1. ❌ **Optimistic update 추가/제거 반복**
   - 로직이 복잡하고 이중 캐시 문제 해결 안 됨

2. ❌ **Query key 관련 설정만 변경**
   - `staleTime`, `refetchType`, `refetchInterval` 조정
   - 근본 원인(서비스 레이어 캐시)을 못 건드림

3. ❌ **"이번엔 확실하다" 말하기**
   - 테스트 전까지는 확실한 게 없음

4. ❌ **이론적 접근만 하기**
   - "React Query 공식 문서에 따르면..."
   - **실용성이 답이다**

5. ❌ **window.location.reload() 사용**
   - 페이지 깜빡임으로 UX 나쁨
   - 이벤트 기반 해결책이 있음

6. ❌ **불필요한 polling 추가**
   - 이벤트 기반 업데이트가 있으면 polling 불필요
   - 네트워크 낭비

---

## ✅ 허용 사항

### 앞으로 사용해도 되는 방법

1. ✅ **표준 패턴 사용**
   ```typescript
   scheduleServiceEnhanced.clearCache()
   eventManager.emitScheduleChange()
   ```

2. ✅ **간단한 코드 유지**
   - 3줄 이내
   - 한눈에 이해 가능

3. ✅ **페이지 mount 시 캐시 클리어**
   ```typescript
   useEffect(() => {
     scheduleServiceEnhanced.clearCache()
   }, [dependencies])
   ```

4. ✅ **auth-provider의 router.refresh()**
   - 인증 상태 변경 시 서버 컴포넌트 업데이트용
   - 정당한 사용 케이스

---

## 📋 체크리스트

### 새로운 mutation을 추가할 때

- [ ] `scheduleServiceEnhanced.clearCache()` 호출했는가?
- [ ] 적절한 이벤트(`emitScheduleChange`, `emitPatientChange` 등) 발행했는가?
- [ ] `queryClient.invalidateQueries()`로 React Query 캐시 무효화했는가?
- [ ] 실제로 테스트해서 즉시 업데이트되는지 확인했는가?

### 문제가 생겼을 때

- [ ] 이 문서를 먼저 읽었는가?
- [ ] 금지 사항을 확인했는가?
- [ ] 간단한 방법(캐시 클리어)부터 시도하는가?
- [ ] 3번 이상 같은 방법을 반복하지 않는가?
- [ ] scheduleServiceEnhanced 캐시를 확인했는가?

---

## 🎯 결론

### 핵심 교훈

1. **문제의 근본 원인을 찾아라**
   - 7번의 실패는 모두 React Query만 보았기 때문
   - 실제 원인은 scheduleServiceEnhanced의 자체 캐시
   - **작동하는 코드를 분석하는 것이 중요**

2. **이중 캐시 시스템을 조심하라**
   - Layer 1: 서비스 레이어 캐시
   - Layer 2: React Query 캐시
   - 두 레이어를 모두 고려해야 함

3. **실용적인 해결책이 최고다**
   - 이론보다 실제 작동하는 코드
   - 이미 검증된 패턴을 따름

4. **포기하지 마라, 하지만 방향을 바꿔라**
   - 7번 실패 후에도 다른 각도에서 접근
   - "왜 ScheduleEditModal은 작동하나?"가 돌파구

### 최종 해결책 요약

| Before (실패) | After (성공) |
|--------------|-------------|
| `window.location.reload()` | `scheduleServiceEnhanced.clearCache()` |
| React Query만 공격 | 이중 캐시 모두 클리어 |
| 7번 실패 | ✅ 100% 성공 |
| 페이지 깜빡임 | 부드러운 UI 업데이트 |
| 불필요한 polling | 이벤트 기반 |

### 성과

- ✅ **10개 파일** 수정
- ✅ **모든 mutation**에서 실시간 업데이트 작동
- ✅ **0개** `window.location.reload()` 사용
- ✅ **100%** 일관된 패턴 적용
- ✅ 페이지 새로고침 불필요
- ✅ 깔끔하고 유지보수 가능한 코드

---

*작성일: 2025-09-28*
*최종 업데이트: 2025-09-28*
*작성자: 8번의 시도와 전체 코드베이스 리팩토링을 완료한 AI*
*결과: ✅ 성공 - 전체 앱에서 페이지 새로고침 없는 실시간 업데이트 구현*