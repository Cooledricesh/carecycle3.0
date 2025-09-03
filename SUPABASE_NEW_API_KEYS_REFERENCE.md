# 🔐 Supabase 새로운 API Key 시스템 완전 가이드

> ⚠️ **중요**: 이 문서는 Supabase의 새로운 API Key 시스템에 대한 참고 문서입니다. Legacy JWT 기반 키에서 새 시스템으로 마이그레이션 시 반드시 이 문서를 참조하세요.

## 📋 목차
1. [핵심 변경사항](#1-핵심-변경사항)
2. [키 타입 비교](#2-키-타입-비교)
3. [마이그레이션 전략](#3-마이그레이션-전략)
4. [코드 구현 예제](#4-코드-구현-예제)
5. [제한사항 및 호환성](#5-제한사항-및-호환성)
6. [보안 모범 사례](#6-보안-모범-사례)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 핵심 변경사항

### 🔄 Legacy vs New System

| 구분 | Legacy System (JWT) | New System |
|------|-------------------|------------|
| **형식** | JWT 토큰 (`eyJ...`) | 문자열 키 (`sb_...`) |
| **종류** | `anon`, `service_role` | `sb_publishable_`, `sb_secret_` |
| **생성 시점** | 프로젝트 생성 시 자동 | 대시보드에서 수동 생성 |
| **로테이션** | JWT Secret 전체 로테이션 필요 | 개별 키 독립적 로테이션 가능 |
| **만료** | 10년 고정 | 관리 가능 |
| **크기** | 큼 (JWT 페이로드 포함) | 작음 (단순 문자열) |

### ⚡ 왜 새 시스템을 사용해야 하는가?

1. **독립적 로테이션**: 각 키를 개별적으로 교체 가능
2. **보안 강화**: 브라우저에서 Secret key 사용 시 자동 차단
3. **간단한 관리**: JWT 복잡성 제거
4. **유연한 권한**: 컴포넌트별 별도 키 발급 가능

---

## 2. 키 타입 비교

### 📱 Publishable Key (`sb_publishable_...`)
**용도**: 클라이언트 사이드 애플리케이션
- ✅ 웹 페이지
- ✅ 모바일 앱
- ✅ 데스크톱 앱
- ✅ CLI 도구
- ✅ 공개 소스코드

**특징**:
- 공개되어도 안전
- 기본 DDoS 보호 제공
- RLS 정책 적용됨
- `anon` 역할로 동작

### 🔒 Secret Key (`sb_secret_...`)
**용도**: 서버 사이드 전용
- ✅ 백엔드 서버
- ✅ Edge Functions
- ✅ 마이크로서비스
- ✅ 관리자 도구
- ✅ 데이터 처리 파이프라인

**특징**:
- **절대 노출 금지**
- RLS 우회 (`BYPASSRLS`)
- `service_role` 역할로 동작
- 브라우저에서 사용 시 401 에러

---

## 3. 마이그레이션 전략

### 📝 단계별 마이그레이션 가이드

#### Step 1: 새 키 생성
```
1. Supabase Dashboard 접속
2. Settings → API → API Keys 섹션
3. "Create new key" 클릭
4. 키 타입 선택:
   - Publishable key (클라이언트용)
   - Secret key (서버용)
5. 키 이름 설정 (예: "production-server", "mobile-app")
```

#### Step 2: 환경 변수 준비
```bash
# .env.local (기존)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx  # NEW (formerly ANON_KEY)
SUPABASE_SECRET_KEY=sb_secret_xxx                        # NEW (formerly SERVICE_ROLE_KEY)

# .env.local (새로운)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx  # NEW
SUPABASE_SECRET_KEY=sb_secret_xxx                        # NEW

# Legacy 키는 모두 제거됨 (완전 마이그레이션 완료)
# NEXT_PUBLIC_SUPABASE_ANON_KEY → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# SUPABASE_SERVICE_ROLE_KEY → SUPABASE_SECRET_KEY
```

#### Step 3: 점진적 코드 마이그레이션
```typescript
// 새 키 시스템 전용 (Legacy 지원 제거됨)
const getApiKey = () => {
  // 새 키만 사용 (Legacy 키는 지원하지 않음)
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
  }
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
};

const getSecretKey = () => {
  // Secret key만 사용 (service_role 즉시 중단)
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_SECRET_KEY is required');
  }
  return process.env.SUPABASE_SECRET_KEY;
};
```

---

## 4. 코드 구현 예제

### 🖥️ 클라이언트 사이드 구현

#### `/src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! // NEW: Publishable key
  );
}
```

### 🖥️ 서버 사이드 구현

#### `/src/lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '../database.types';

// 일반 사용자 인증용 클라이언트
export async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // NEW: Publishable key
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// 관리자 작업용 클라이언트 (RLS 우회)
export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!, // NEW: Secret key
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}
```

### 🔄 API Route 예제

#### `/src/app/api/admin/create-user/route.ts`
```typescript
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Secret key를 사용하는 관리자 클라이언트
  const supabase = await createServiceClient();
  
  const { email, name } = await request.json();
  
  // RLS를 우회하여 직접 데이터 생성
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    user_metadata: { name },
    email_confirm: true
  });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({ data });
}
```

---

## 5. 제한사항 및 호환성

### ⚠️ 중요한 제한사항

#### 1. Authorization Header 비호환
```typescript
// ❌ 작동하지 않음
headers: {
  'Authorization': `Bearer ${publishableKey}`
}

// ✅ 올바른 사용
headers: {
  'apikey': publishableKey
}
```

#### 2. Edge Functions 특별 처리
```typescript
// Edge Functions에서 새 키 사용 시
// --no-verify-jwt 옵션 필요

// supabase/functions/my-function/index.ts
Deno.serve(async (req) => {
  const apiKey = req.headers.get('apikey');
  
  // 직접 키 검증 구현 필요
  if (apiKey !== Deno.env.get('SUPABASE_SECRET_KEY')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // 함수 로직...
});
```

#### 3. Realtime 연결 제한
- Publishable key 사용 시 24시간 연결 제한
- 사용자 인증으로 연결 연장 필요

#### 4. Self-hosting 미지원
- 새 키 시스템은 Supabase 플랫폼 전용
- Self-hosting은 Legacy JWT 키만 사용 가능

---

## 6. 보안 모범 사례

### 🛡️ Secret Key 보안 규칙

#### 절대 하지 말아야 할 것:
```typescript
// ❌ 절대 금지 사항들

// 1. 클라이언트 코드에 포함
const client = createClient(url, 'sb_secret_xxx'); // 절대 금지!

// 2. 로그에 기록
console.log(`Using key: ${secretKey}`); // 절대 금지!

// 3. URL 파라미터로 전달
fetch(`/api/data?key=${secretKey}`); // 절대 금지!

// 4. 버전 관리에 포함
// .env 파일을 git에 커밋하지 마세요!
```

#### 올바른 사용 방법:
```typescript
// ✅ 올바른 보안 사례

// 1. 환경 변수에서만 읽기
const secretKey = process.env.SUPABASE_SECRET_KEY;

// 2. 키 검증 시 해시 비교
import { createHash } from 'crypto';

const validateKey = (providedKey: string) => {
  const hashedProvided = createHash('sha256').update(providedKey).digest('hex');
  const hashedActual = createHash('sha256').update(secretKey).digest('hex');
  return hashedProvided === hashedActual;
};

// 3. 부분 로깅 (최대 6자)
console.log(`Key initialized: ${secretKey.substring(0, 6)}...`);
```

### 🔑 컴포넌트별 키 분리

```typescript
// 각 서비스별로 별도 Secret key 생성 및 사용
const keys = {
  adminPanel: process.env.SUPABASE_SECRET_KEY_ADMIN,
  dataProcessor: process.env.SUPABASE_SECRET_KEY_PROCESSOR,
  scheduler: process.env.SUPABASE_SECRET_KEY_SCHEDULER,
};

// 키가 노출되면 해당 컴포넌트만 교체
```

---

## 7. 트러블슈팅

### 🔧 일반적인 문제 해결

#### 문제: "Invalid API key" 에러
```typescript
// 체크리스트:
// 1. 키 형식 확인 (sb_publishable_ 또는 sb_secret_)
// 2. 환경 변수 로드 확인
console.log('Key format:', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.substring(0, 15));

// 3. 키 타입이 올바른지 확인
// - 클라이언트: Publishable key
// - 서버: Secret key
```

#### 문제: 브라우저에서 401 Unauthorized
```typescript
// Secret key를 브라우저에서 사용하면 자동 차단됨
// 해결: Publishable key로 변경
const supabase = createClient(
  url,
  'sb_publishable_xxx' // sb_secret이 아닌 sb_publishable 사용
);
```

#### 문제: RLS 정책이 우회되지 않음
```typescript
// Secret key가 제대로 설정되었는지 확인
// createServiceClient가 Secret key를 사용하는지 확인
const supabase = await createServiceClient(); // Secret key 사용 확인
```

### 📝 마이그레이션 체크리스트

- [ ] Supabase Dashboard에서 새 키 생성
- [ ] 환경 변수 파일 업데이트 (.env.local)
- [ ] 클라이언트 코드를 Publishable key로 업데이트
- [ ] 서버 코드를 Secret key로 업데이트
- [ ] Edge Functions 키 검증 로직 추가
- [ ] 로컬 테스트 완료
- [ ] Vercel/배포 환경 변수 업데이트
- [ ] 프로덕션 배포
- [ ] Legacy 키 사용 모니터링 (Dashboard → API Keys → Last Used)
- [ ] Legacy 키 비활성화 (모든 전환 확인 후)

---

## ⚠️ 절대 잊지 말아야 할 것

1. **Service Role Key는 즉시 제거**: 노출된 `service_role` key는 즉시 사용 중단
2. **Secret Key는 서버 전용**: 절대 클라이언트 코드에 포함 금지
3. **점진적 마이그레이션**: 다운타임 방지를 위해 단계적 전환
4. **키 로테이션 계획**: 컴포넌트별 별도 키로 리스크 분산
5. **모니터링 필수**: Dashboard에서 키 사용 현황 지속 확인

---

*이 문서는 Supabase 공식 문서 기반으로 작성되었습니다. 최신 업데이트는 [Supabase Docs](https://supabase.com/docs/guides/api/api-keys)를 참조하세요.*