# 관리자 활동 로그 기능 - 재구현 계획서 (v2)

**작성일**: 2025-09-28
**브랜치**: `feature/admin-activity-tracking-v2`
**상태**: ✅ 구현 완료
**이전 실패 브랜치**: `feature/admin-activity-tracking` (폐기됨)

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [User Flow & Data Flow](#user-flow--data-flow)
3. [모듈 설계 (Presentation / Business Logic 분리)](#모듈-설계-presentation--business-logic-분리)
4. [기존 구현 상태](#기존-구현-상태)
5. [이전 실패 원인 분석](#이전-실패-원인-분석)
6. [핵심 원칙](#핵심-원칙)
7. [구현 로드맵](#구현-로드맵)
8. [상세 구현 계획](#상세-구현-계획)
9. [테스트 계획](#테스트-계획)
10. [위험 관리](#위험-관리)

---

## 📌 프로젝트 개요

### 목표
관리자가 시스템의 모든 변경 사항을 추적하고 모니터링할 수 있는 활동 로그 시스템 구축

### 주요 기능
- ✅ 자동 감사 로그 (INSERT/UPDATE/DELETE)
- ✅ 사용자 활동 통계 대시보드
- ✅ 실시간 활동 피드
- ✅ 날짜별 필터링 및 페이지네이션
- ✅ 사용자별/테이블별/작업별 필터링

### 기술 스택
- **Database**: Supabase (PostgreSQL) + Triggers
- **Backend**: Next.js App Router API Routes
- **Frontend**: React + shadcn/ui + React Query
- **Real-time**: Supabase Realtime (optional)

---

## 📊 User Flow & Data Flow

### 사용자 여정 (User Journey)

```
┌─────────────────────────────────────────────────────────────┐
│  1. 관리자 로그인                                             │
│     ↓ (admin 권한 확인)                                      │
│  2. /admin 페이지 접근                                        │
│     ↓                                                        │
│  3. 통계 대시보드 조회                                        │
│     - 전체 사용자 수                                          │
│     - 활성 사용자 수                                          │
│     - 오늘의 활동 수                                          │
│     - 시스템 상태 및 경고                                     │
│     ↓ (자동 갱신: 30초)                                      │
│  4. 활동 피드 조회                                            │
│     - 최근 활동 로그 목록                                     │
│     - 각 로그의 Description (한글 설명)                       │
│     - 사용자 정보 및 타임스탬프                               │
│     ↓                                                        │
│  5. 필터 적용 (선택사항)                                      │
│     - 날짜 범위 선택 (오늘/최근 7일/최근 30일/커스텀)          │
│     - 테이블별 필터 (schedules, patients, profiles)          │
│     - 작업 유형별 필터 (INSERT, UPDATE, DELETE)              │
│     ↓                                                        │
│  6. 페이지네이션 (20개씩)                                     │
│     ↓                                                        │
│  7. 개별 로그 상세 확인                                       │
│     - 작업 설명 (Description)                                │
│     - 변경 전/후 값 (old_values / new_values)                │
│     - 사용자 정보 (이름, 이메일, 역할)                        │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름 (Data Flow)

```
┌──────────────────────────────────────────────────────────────┐
│  [사용자 작업 발생]                                            │
│  예: 스케줄 완료 처리, 환자 정보 수정, 스케줄 삭제             │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [Database Trigger 자동 실행]                                  │
│  - audit_table_changes() 함수 호출                            │
│  - PHI/PII 필터링 (환자 이름 등 민감정보 제외)                 │
│  - user_id, user_email, user_name 자동 추출                   │
│  - old_values / new_values JSON 생성                          │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [audit_logs 테이블에 INSERT]                                 │
│  - id, table_name, operation, record_id                       │
│  - old_values, new_values                                     │
│  - user_id, user_email, user_name, user_role                  │
│  - timestamp, hospital_id                                     │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [Frontend: React Query 자동 갱신 또는 수동 호출]              │
│  - useActivityStats(): 30초마다 자동 갱신                      │
│  - useAuditLogs(filters): 필터 변경 시 자동 호출              │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [API Route: GET /api/admin/activity/logs]                    │
│  1. 인증 체크 (supabase.auth.getUser())                       │
│  2. 권한 체크 (profile.role === 'admin')                      │
│  3. Query Parameters 파싱 (filters)                           │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [Service Layer: activityService.getAuditLogs()]              │
│  1. Supabase 쿼리 실행 (필터링, 정렬, 페이지네이션)            │
│  2. 결과 데이터 반환                                           │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [Service Layer: activityService.generateDescription()]       │
│  ⭐ 핵심 비즈니스 로직                                         │
│  1. operation 타입 확인 (INSERT/UPDATE/DELETE)                │
│  2. 스케줄 완료 처리 감지 (복잡한 로직)                        │
│     - last_completed_at 변경 여부                             │
│     - next_due_date 변경 여부                                 │
│  3. 스케줄 삭제 감지 (status: active → cancelled)             │
│  4. 일반 수정 감지                                             │
│  5. 한글 Description 생성                                     │
│     예: "홍길동님이 김철수 환자의 혈당 검사 스케줄을 완료처리 했습니다" │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [React Query Hook: useAuditLogs]                             │
│  - 캐싱 (중복 요청 방지)                                       │
│  - 에러 핸들링 (Toast 알림)                                    │
│  - 로딩 상태 관리                                              │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [Component: ActivityFeed]                                    │
│  - 필터 상태 관리                                              │
│  - ActivityItem 컴포넌트 렌더링                               │
│  - 페이지네이션 UI                                             │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [Component: ActivityItem]                                    │
│  - Description 표시 (한글 설명)                               │
│  - 배지 (INSERT/UPDATE/DELETE)                                │
│  - 사용자 정보 및 타임스탬프 표시                              │
└──────────────────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────────────────┐
│  [사용자에게 표시]                                             │
│  ✅ 직관적인 한글 설명                                         │
│  ✅ 실시간 업데이트 (30초 간격)                                │
│  ✅ 필터링 및 검색 가능                                        │
└──────────────────────────────────────────────────────────────┘
```

### 데이터 변환 핵심 포인트

1. **Database Trigger Level**: PHI/PII 보호 필터링
2. **Service Layer**: 복잡한 비즈니스 로직 (스케줄 완료/삭제/수정 감지)
3. **API Layer**: 인증/권한 체크 및 파라미터 검증
4. **Component Layer**: 사용자 친화적 UI 표시

---

## 🏗️ 모듈 설계 (Presentation / Business Logic 분리)

### 아키텍처 개요

```
📦 Database Layer (PostgreSQL + Supabase)
  ├── audit_logs 테이블
  ├── audit_table_changes() 함수 (트리거)
  └── RLS 정책 (admin만 접근)
      ↓
📦 API Layer (Next.js App Router)
  ├── /api/admin/activity/stats/route.ts
  │   - 인증/권한 체크
  │   - activityService.getStats() 호출
  ├── /api/admin/activity/logs/route.ts
  │   - 인증/권한 체크
  │   - Query Parameters 파싱
  │   - activityService.getAuditLogs() 호출
      ↓
📦 Business Logic Layer (Services)
  └── src/services/activityService.ts
      ├── getStats(supabase)
      │   - 통계 데이터 조회
      │   - 집계 쿼리 실행
      ├── getAuditLogs(supabase, filters)
      │   - audit_logs 조회
      │   - 필터링, 정렬, 페이지네이션
      └── generateDescription(log) ⭐ 핵심
          - INSERT/UPDATE/DELETE 분기
          - 스케줄 완료 처리 감지
          - 스케줄 삭제 감지
          - 한글 Description 생성
      ↓
📦 Data Access Layer (React Query Hooks)
  ├── src/hooks/useActivityStats.ts
  │   - useQuery(['activity', 'stats'])
  │   - 30초 자동 갱신
  │   - 에러 핸들링
  └── src/hooks/useAuditLogs.ts
      - useQuery(['activity', 'logs', filters])
      - 캐싱 및 리페칭
      - 에러 핸들링
      ↓
📦 Presentation Layer (React Components)
  └── src/components/admin/
      ├── activity-stats-cards.tsx
      │   - 통계 카드 4개 렌더링
      │   - 아이콘 및 스타일링
      ├── activity-feed.tsx
      │   - 필터 상태 관리
      │   - ActivityItem 목록 렌더링
      │   - 페이지네이션 UI
      ├── activity-item.tsx
      │   - Description 표시
      │   - 배지, 타임스탬프 표시
      └── activity-date-filter.tsx
          - 날짜 필터 UI
          - 빠른 필터 (오늘/최근 7일/최근 30일)
```

### 계층별 책임 (Separation of Concerns)

| Layer | 책임 | 특징 |
|-------|------|------|
| **Database** | 데이터 영속성, 감사 로그 자동 생성, PHI/PII 보호 | Trigger 기반 자동화 |
| **API** | 인증/권한, 라우팅, 파라미터 검증 | 얇은 레이어 (로직 없음) |
| **Business Logic** | 도메인 로직, Description 생성, 데이터 변환 | 순수 함수, UI 독립적 |
| **Data Access** | API 호출, 캐싱, 리페칭, 에러 핸들링 | React Query 기반 |
| **Presentation** | UI 렌더링, 사용자 상호작용, 로딩 상태 표시 | 비즈니스 로직 없음 |

### 핵심 비즈니스 로직: generateDescription()

**위치**: `src/services/activityService.ts`

**책임**:
1. `audit_logs` 데이터를 입력받아 사용자 친화적인 한글 설명 생성
2. 복잡한 비즈니스 규칙 처리 (스케줄 완료/삭제 감지)
3. 테이블별 맞춤형 설명 생성

**예시**:
```typescript
// INPUT (audit_logs 데이터)
{
  table_name: 'schedules',
  operation: 'UPDATE',
  old_values: { status: 'active', next_due_date: '2025-09-20' },
  new_values: { status: 'active', next_due_date: '2025-09-25', last_completed_at: '2025-09-20' }
}

// OUTPUT (Description)
"홍길동님이 김철수 환자의 혈당 검사 스케줄을 완료처리 했습니다."
```

**복잡도**:
- 스케줄 완료 처리 감지: `last_completed_at` 변경 여부, `next_due_date` 변경 여부, `status` 유지 여부 등 다중 조건 확인
- 스케줄 삭제 감지: `status: active → cancelled` 변경 감지
- 일반 수정: 변경된 필드 목록 생성

**왜 중요한가**:
- 이전 실패의 핵심 원인: 이 로직을 추측으로 구현 → Description 부정확
- Phase 1의 목표: 실제 데이터 기반으로 이 로직 완벽하게 구현

---

## ✅ 기존 구현 상태

### 이미 구현된 모듈

| 모듈 | 파일 위치 | 상태 | 비고 |
|------|-----------|------|------|
| **Database Layer** | | | |
| audit_logs 테이블 | Supabase | ✅ 완료 | user_name 컬럼 포함 |
| audit_table_changes() 함수 | Migration 1 | ✅ 완료 | PHI/PII 보호 구현 |
| Triggers (INSERT/UPDATE/DELETE) | Migration 1 | ✅ 완료 | 모든 테이블에 적용 |
| 중복 방지 로직 | Migration 2 | ✅ 완료 | updated_at 제외 비교 |
| 인덱스 (성능 최적화) | Migration 2 | ✅ 완료 | timestamp, table_name, user_id |
| **Business Logic Layer** | | | |
| activityService.ts | `src/services/` | ✅ 완료 | **검증 필요** (Phase 1) |
| getStats() | activityService.ts | ✅ 완료 | 통계 조회 |
| getAuditLogs() | activityService.ts | ✅ 완료 | 로그 조회 + 필터링 |
| generateDescription() | activityService.ts | ⚠️ **검증 필요** | Phase 1에서 실제 데이터 기반 재검증 |
| **API Layer** | | | |
| /api/admin/activity/stats | `src/app/api/admin/activity/stats/route.ts` | ✅ 완료 | 인증/권한 체크 포함 |
| /api/admin/activity/logs | `src/app/api/admin/activity/logs/route.ts` | ✅ 완료 | 필터링 파라미터 파싱 |
| **Data Access Layer** | | | |
| useActivityStats | `src/hooks/` | ✅ 완료 | 30초 자동 갱신 |
| useAuditLogs | `src/hooks/` | ✅ 완료 | 필터링 + 캐싱 |
| **Presentation Layer** | | | |
| ActivityStatsCards | `src/components/admin/` | ✅ 완료 | 4개 통계 카드 |
| ActivityFeed | `src/components/admin/` | ✅ 완료 | 로그 목록 + 페이지네이션 |
| ActivityItem | `src/components/admin/` | ✅ 완료 | 개별 로그 표시 |
| ActivityDateFilter | `src/components/admin/` | ✅ 완료 | 날짜 필터 UI |
| Admin Page | `src/app/(protected)/admin/page.tsx` | ✅ 완료 | 권한 체크 포함 |
| **Type Definitions** | | | |
| activity.ts | `src/types/` | ✅ 완료 | TypeScript 타입 정의 |

### 계획 업데이트 필요 사항

기존 계획서에서는 "처음부터 구현"하는 것처럼 작성되어 있었으나, **실제로는 대부분 이미 구현되어 있음**. 따라서 계획을 다음과 같이 업데이트:

1. **Phase 1 (실제 동작 분석)**: 변경 없음 - 가장 중요한 단계
2. **Phase 2 (Database Layer)**: Migration 파일 검토 및 검증 위주로 변경
3. **Phase 3 (Backend Layer)**: 기존 코드 검토 및 **generateDescription() 로직 재구현** 위주로 변경
4. **Phase 4 (Frontend Layer)**: 기존 컴포넌트 검토 및 필요시 수정 위주로 변경
5. **Phase 5 (통합 테스트)**: 변경 없음 - E2E 테스트 진행

### 주요 검증 포인트

1. **✅ Database Layer**: 이미 완성도 높음 (PHI/PII 보호, 성능 최적화 완료)
2. **⚠️ Business Logic Layer**: `generateDescription()` 로직이 **Phase 1 실제 데이터 기반**인지 검증 필요
3. **✅ API Layer**: 인증/권한 체크 완료, 재구현 불필요
4. **✅ Presentation Layer**: 컴포넌트 완성도 높음, UI/UX 테스트만 필요

---

## 🚨 이전 실패 원인 분석

### 1. 추측 기반 구현 (Critical)
```typescript
// ❌ 실패한 코드: 완료 처리 로직을 추측으로 구현
const isCompletion =
  oldValues.status === 'active' &&
  newValues.next_due_date > oldValues.next_due_date
```
**문제**: 실제 데이터 구조를 확인하지 않고 추측으로 구현
**결과**: "완료 처리" 했는데 "날짜 수정"으로 표시됨

### 2. 관련 없는 파일 수정 (Critical)
**수정된 파일들**:
- `src/app/(protected)/dashboard/patients/page.tsx`
- `src/app/api/patients/[id]/update-doctor/route.ts`
- `src/app/api/patients/[id]/update/route.ts`

**문제**: 활동 로그 기능과 무관한 환자/스케줄 관리 파일 수정
**결과**: 캘린더 "지난 스케줄 보기" 기능 파괴

### 3. 테스트 부족 (High)
**문제**: 여러 기능을 한꺼번에 구현 후 마지막에 통합 테스트
**결과**: 문제 발생 시 원인 파악 불가능

---

## 🎯 핵심 원칙

### 1. 데이터 기반 개발 (Data-Driven Development)
```bash
✅ DO: 실제로 작업 수행 → DB 확인 → 코드 작성
❌ DON'T: 추측으로 로직 작성
```

### 2. 파일 격리 (File Isolation)
```bash
✅ DO: 활동 로그 전용 파일만 생성/수정
  - src/types/activity.ts (NEW)
  - src/services/activityService.ts (NEW)
  - src/app/api/admin/activity/* (NEW)
  - src/components/admin/activity-* (NEW)

❌ DON'T: 기존 환자/스케줄/캘린더 파일 절대 수정 금지
  - src/app/(protected)/dashboard/patients/*
  - src/app/api/patients/*
  - src/app/api/schedules/*
  - src/components/schedules/*
```

### 3. 점진적 개발 (Incremental Development)
```bash
각 단계마다:
1. 구현
2. 테스트
3. 기존 기능 확인
4. 다음 단계 진행
```

### 4. 즉시 롤백 (Immediate Rollback)
```bash
문제 발견 시:
1. 원인 파악 시도 (5분)
2. 파악 실패 시 즉시 롤백
3. 한 단계씩 다시 시도
```

---

## 🗺️ 구현 로드맵

### Phase 0: 환경 준비 (1시간)
- [x] 새 브랜치 생성 및 검증
- [x] 기존 기능 정상 작동 확인
- [x] 테스트 계정 설정

### Phase 1: 실제 동작 분석 (2시간) ⭐ **가장 중요**
- [x] 완료 처리 시 실제 DB 변경사항 확인
- [x] 삭제 시 실제 DB 변경사항 확인
- [x] 수정 시 실제 DB 변경사항 확인
- [x] 각 케이스별 audit_logs 데이터 문서화

### Phase 2: Database Layer (2시간)
- [x] Migration 1: 기본 audit 시스템 구축
- [x] Migration 2: 중복 방지 및 컨텍스트 정보 추가
- [x] 성능 테스트 (대용량 INSERT/UPDATE)
- [x] 기존 기능 확인

### Phase 3: Backend Layer (3시간)
- [x] Types 정의
- [x] Service Layer 구현 (데이터 기반!)
- [x] API Routes 구현
- [x] API 테스트 (Postman/Thunder Client)
- [x] 기존 기능 확인

### Phase 4: Frontend Layer (4시간)
- [x] Hooks 구현
- [x] UI Components 구현
- [x] Admin Page 통합
- [x] UI/UX 테스트
- [x] 기존 기능 확인

### Phase 5: 통합 테스트 (2시간)
- [x] 엔드투엔드 테스트
- [x] 성능 테스트
- [x] 에러 핸들링 테스트
- [x] 최종 기존 기능 확인

**예상 소요 시간**: 14시간 (2일)

---

## 📝 상세 구현 계획

## Phase 0: 환경 준비

### ✅ Task 0-1: 브랜치 생성 및 검증
```bash
# 새 브랜치 생성
git checkout -b feature/admin-activity-tracking-v2

# 현재 상태 확인
git status
git log --oneline -5
```

**완료 조건**:
- [x] 브랜치 생성 완료
- [ ] clean working directory
- [ ] 최신 커밋이 main branch와 동기화

---

### ✅ Task 0-2: 기존 기능 정상 작동 확인

#### 체크리스트
```bash
# 개발 서버 실행
npm run dev

# 브라우저 테스트
1. [ ] 로그인 (test@example.com / Test123!@#)
2. [ ] 환자 목록 조회 (/dashboard/patients)
3. [ ] 스케줄 목록 조회 (/dashboard)
4. [ ] 캘린더 보기 (달력 아이콘)
5. [ ] 지난 스케줄 보기 (토글)
6. [ ] 스케줄 완료 처리
7. [ ] 스케줄 삭제
8. [ ] 관리자 페이지 접근 (/admin)
```

**완료 조건**:
- [ ] 모든 체크리스트 항목 ✅
- [ ] 콘솔에 에러 없음
- [ ] 네트워크 요청 정상

---

### ✅ Task 0-3: 테스트 데이터 준비

```sql
-- Supabase SQL Editor에서 실행

-- 1. audit_logs 테이블에 user_name 컬럼이 있는지 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND table_schema = 'public';

-- 2. 기존 audit_logs 데이터 확인
SELECT COUNT(*) as total_logs FROM audit_logs;

-- 3. 최근 로그 샘플 확인
SELECT
  table_name,
  operation,
  user_email,
  timestamp,
  old_values,
  new_values
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 5;
```

**완료 조건**:
- [ ] audit_logs 테이블 존재 확인
- [ ] 기존 데이터 파악
- [ ] 스키마 구조 문서화

---

## Phase 1: 실제 동작 분석 ⭐

> **중요**: 이 단계가 가장 중요합니다. 추측하지 말고 실제 데이터를 확인하세요!

### ✅ Task 1-1: 스케줄 완료 처리 동작 분석

#### 1. 완료 처리 실행
```bash
# 브라우저에서:
1. 대시보드 접속
2. 특정 스케줄 선택
3. "완료" 버튼 클릭
4. 완료 시간 입력 및 확인
```

#### 2. DB 변경사항 확인
```sql
-- 최근 audit_logs 확인
SELECT
  id,
  table_name,
  operation,
  record_id,
  old_values,
  new_values,
  user_email,
  timestamp
FROM audit_logs
WHERE user_email = 'test@example.com'
ORDER BY timestamp DESC
LIMIT 10;

-- schedule_executions 테이블 확인
SELECT
  id,
  schedule_id,
  executed_at,
  completed_by,
  created_at
FROM schedule_executions
ORDER BY created_at DESC
LIMIT 5;

-- schedules 테이블 변경사항 확인
SELECT
  id,
  status,
  last_completed_at,
  next_due_date,
  updated_at
FROM schedules
WHERE id = '[완료한 스케줄 ID]';
```

#### 3. 결과 문서화
```markdown
# 완료 처리 분석 결과

## 영향받는 테이블
- [ ] schedule_executions (INSERT)
- [ ] schedules (UPDATE)

## schedules 테이블 변경 필드
- last_completed_at: [변경 전] → [변경 후]
- next_due_date: [변경 전] → [변경 후]
- status: [변경 전] → [변경 후]
- updated_at: [변경 전] → [변경 후]

## audit_logs 데이터
- operation: [INSERT/UPDATE]
- old_values: { ... }
- new_values: { ... }

## 완료 처리 감지 로직
```typescript
// 실제 데이터 기반 로직 작성
function isCompletion(log: AuditLog): boolean {
  // TODO: 실제 데이터 보고 작성
}
```
```

**완료 조건**:
- [ ] 완료 처리 실행 완료
- [ ] audit_logs 데이터 확인
- [ ] 변경 필드 목록 작성
- [ ] 감지 로직 초안 작성

---

### ✅ Task 1-2: 스케줄 삭제 동작 분석

#### 1. 삭제 실행
```bash
# 브라우저에서:
1. 대시보드 접속
2. 특정 스케줄 선택
3. "삭제" 버튼 클릭 (또는 휴지통 아이콘)
4. 확인 다이얼로그에서 "삭제" 클릭
```

#### 2. DB 변경사항 확인
```sql
-- 최근 audit_logs 확인
SELECT
  id,
  table_name,
  operation,
  record_id,
  old_values,
  new_values,
  user_email,
  timestamp
FROM audit_logs
WHERE table_name = 'schedules'
  AND user_email = 'test@example.com'
ORDER BY timestamp DESC
LIMIT 5;

-- schedules 테이블 확인 (soft delete인지 hard delete인지)
SELECT
  id,
  status,
  is_active,
  deleted_at,
  updated_at
FROM schedules
WHERE id = '[삭제한 스케줄 ID]';

-- 실제로 레코드가 삭제되었는지 확인
SELECT COUNT(*)
FROM schedules
WHERE id = '[삭제한 스케줄 ID]';
```

#### 3. 결과 문서화
```markdown
# 삭제 분석 결과

## 삭제 방식
- [ ] Hard Delete (DELETE operation)
- [ ] Soft Delete (UPDATE operation)

## Soft Delete인 경우
- 변경 필드: is_active, status, deleted_at 등

## audit_logs 데이터
- operation: [DELETE/UPDATE]
- old_values: { ... }
- new_values: { ... }

## 삭제 감지 로직
```typescript
function isDeletion(log: AuditLog): boolean {
  // TODO: 실제 데이터 보고 작성
}
```
```

**완료 조건**:
- [ ] 삭제 실행 완료
- [ ] audit_logs 데이터 확인
- [ ] Soft/Hard delete 방식 파악
- [ ] 감지 로직 초안 작성

---

### ✅ Task 1-3: 스케줄 수정 동작 분석

#### 1. 날짜 수정 실행
```bash
# 브라우저에서:
1. 대시보드 접속
2. 특정 스케줄 선택
3. "수정" 버튼 클릭
4. 다음 예정일 변경
5. 저장
```

#### 2. DB 변경사항 확인
```sql
SELECT
  id,
  table_name,
  operation,
  old_values,
  new_values,
  timestamp
FROM audit_logs
WHERE table_name = 'schedules'
  AND operation = 'UPDATE'
  AND user_email = 'test@example.com'
ORDER BY timestamp DESC
LIMIT 5;
```

#### 3. 완료 처리와 차이점 파악
```markdown
# 수정 vs 완료 처리 비교

## 날짜만 수정
- old_values: { next_due_date: "2025-01-01", ... }
- new_values: { next_due_date: "2025-01-05", ... }

## 완료 처리 (참고)
- old_values: { ... }
- new_values: { last_completed_at: "...", next_due_date: "..." }

## 구별 방법
- [ ] last_completed_at 필드 존재 여부
- [ ] schedule_executions INSERT 동시 발생
- [ ] 기타: ...
```

**완료 조건**:
- [ ] 날짜 수정 실행 완료
- [ ] audit_logs 데이터 확인
- [ ] 완료 처리와 차이점 문서화

---

### ✅ Task 1-4: 환자 정보 수정 동작 분석

#### 1. 환자 정보 수정
```bash
# 브라우저에서:
1. 환자 관리 페이지 접속
2. 특정 환자 선택
3. 이름/진료구분/담당의 수정
4. 저장
```

#### 2. DB 변경사항 확인
```sql
SELECT
  id,
  table_name,
  operation,
  old_values,
  new_values,
  timestamp
FROM audit_logs
WHERE table_name = 'patients'
  AND operation = 'UPDATE'
ORDER BY timestamp DESC
LIMIT 5;
```

#### 3. 결과 문서화
```markdown
# 환자 정보 수정 분석

## 변경 가능한 필드들
- name: 환자 이름
- department: 진료구분
- doctor_id: 담당의
- is_active: 활성 상태
- 기타: ...

## audit_logs에 저장되는 필드
- old_values: { ... }
- new_values: { ... }

## 주의사항
- PHI/PII 보호: name은 audit_logs에서 제외되는가?
```

**완료 조건**:
- [ ] 환자 정보 수정 실행
- [ ] audit_logs 데이터 확인
- [ ] 변경 가능 필드 목록 작성
- [ ] PHI/PII 보호 확인

---

### ✅ Task 1-5: 분석 결과 종합 문서 작성

**파일**: `ACTIVITY_LOG_DATA_ANALYSIS.md`

```markdown
# 활동 로그 데이터 분석 결과

## 1. 스케줄 완료 처리
### 감지 로직
```typescript
function isScheduleCompletion(log: AuditLog): boolean {
  return (
    log.tableName === 'schedules' &&
    log.operation === 'UPDATE' &&
    log.newValues?.last_completed_at !== undefined &&
    log.oldValues?.last_completed_at !== log.newValues?.last_completed_at
  )
}
```

### Description 생성
```typescript
function getCompletionDescription(log: AuditLog): string {
  const scheduleName = log.newValues?._item_name || '스케줄'
  return `${scheduleName} 완료 처리했습니다`
}
```

## 2. 스케줄 삭제
### 감지 로직
```typescript
function isScheduleDeletion(log: AuditLog): boolean {
  // 실제 데이터 보고 작성
}
```

## 3. 스케줄 수정
### 감지 로직
```typescript
function isScheduleUpdate(log: AuditLog): boolean {
  // 실제 데이터 보고 작성
}
```

## 4. 환자 정보 수정
// ...
```

**완료 조건**:
- [ ] 모든 케이스 분석 완료
- [ ] 감지 로직 초안 작성
- [ ] Description 생성 로직 작성
- [ ] 문서 리뷰 완료

---

## Phase 2: Database Layer

### ✅ Task 2-1: Migration 파일 검토 및 수정

#### 1. Migration 1 검토
**파일**: `supabase/migrations/20250928000001_improve_audit_logs.sql`

**체크리스트**:
- [ ] user_name 컬럼 추가 확인
- [ ] audit_table_changes() 함수 로직 검토
- [ ] PHI/PII 보호 로직 확인
- [ ] search_path 보안 설정 확인
- [ ] Trigger 생성 구문 확인

**수정 필요 사항**:
```sql
-- 수정이 필요한 부분이 있다면 여기에 작성
```

#### 2. Migration 2 검토
**파일**: `supabase/migrations/20250928000002_fix_duplicate_audit_logs.sql`

**체크리스트**:
- [ ] 중복 방지 로직 확인 (updated_at 제외 비교)
- [ ] patient_name, item_name 추가 로직 확인
- [ ] 성능 최적화 확인 (JOIN 성능)

**수정 필요 사항**:
```sql
-- 수정이 필요한 부분이 있다면 여기에 작성
```

**완료 조건**:
- [ ] Migration 파일 검토 완료
- [ ] 수정 사항 반영 (있는 경우)
- [ ] 백업 계획 수립

---

### ✅ Task 2-2: Migration 적용

```bash
# Supabase Dashboard에서 실행

1. SQL Editor 열기
2. Migration 1 복사/붙여넣기
3. 실행
4. 에러 확인
5. Migration 2 복사/붙여넣기
6. 실행
7. 에러 확인
```

**실행 후 검증**:
```sql
-- 1. 함수 생성 확인
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'audit_table_changes';

-- 2. Trigger 생성 확인
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%';

-- 3. 인덱스 생성 확인
SELECT indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_audit_logs%';

-- 4. user_name 컬럼 확인
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'audit_logs' AND column_name = 'user_name';
```

**완료 조건**:
- [ ] Migration 1 적용 성공
- [ ] Migration 2 적용 성공
- [ ] 검증 쿼리 모두 통과
- [ ] 에러 없음

---

### ✅ Task 2-3: Trigger 동작 테스트

#### 1. INSERT 테스트
```sql
-- 테스트 데이터 삽입 (본인 hospital_id 사용)
INSERT INTO patients (hospital_id, patient_number, name, department)
VALUES ('[your-hospital-id]', 'TEST001', '테스트환자', '내과');

-- audit_logs 확인
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1;
```

**확인 사항**:
- [ ] audit_logs에 INSERT 로그 생성됨
- [ ] user_id, user_email, user_name 자동 입력됨
- [ ] new_values에 환자 정보 저장됨 (name 제외)

#### 2. UPDATE 테스트
```sql
-- 방금 생성한 환자 수정
UPDATE patients
SET department = '외과'
WHERE patient_number = 'TEST001';

-- audit_logs 확인
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1;
```

**확인 사항**:
- [ ] audit_logs에 UPDATE 로그 생성됨
- [ ] old_values와 new_values 모두 존재
- [ ] department 변경사항 기록됨

#### 3. 중복 방지 테스트
```sql
-- 동일한 값으로 UPDATE (updated_at만 변경)
UPDATE patients
SET department = '외과'
WHERE patient_number = 'TEST001';

-- audit_logs 확인 (새 로그가 생성되지 않아야 함)
SELECT COUNT(*) FROM audit_logs
WHERE table_name = 'patients'
  AND operation = 'UPDATE'
  AND timestamp > NOW() - INTERVAL '1 minute';
```

**확인 사항**:
- [ ] 중복 로그가 생성되지 않음
- [ ] 실제 변경사항만 로깅됨

#### 4. DELETE 테스트
```sql
-- 테스트 환자 삭제
DELETE FROM patients WHERE patient_number = 'TEST001';

-- audit_logs 확인
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1;
```

**확인 사항**:
- [ ] audit_logs에 DELETE 로그 생성됨
- [ ] old_values에 삭제된 데이터 저장됨

**완료 조건**:
- [ ] 모든 테스트 통과
- [ ] Trigger 정상 작동 확인
- [ ] 테스트 데이터 정리 완료

---

### ✅ Task 2-4: 성능 테스트

```sql
-- 대량 INSERT 테스트 (100개)
DO $$
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO patients (hospital_id, patient_number, name, department)
    VALUES ('[your-hospital-id]', 'PERF' || i, '성능테스트' || i, '내과');
  END LOOP;
END $$;

-- audit_logs 생성 확인
SELECT COUNT(*) FROM audit_logs
WHERE table_name = 'patients'
  AND timestamp > NOW() - INTERVAL '1 minute';

-- 성능 측정
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'patients'
ORDER BY timestamp DESC
LIMIT 20;

-- 테스트 데이터 정리
DELETE FROM patients WHERE patient_number LIKE 'PERF%';
```

**성능 기준**:
- [ ] 100개 INSERT 완료 시간 < 5초
- [ ] audit_logs 조회 시간 < 100ms
- [ ] Trigger 오버헤드 < 10%

**완료 조건**:
- [ ] 성능 테스트 완료
- [ ] 성능 기준 충족
- [ ] 병목 구간 파악 (있는 경우)

---

### ✅ Task 2-5: 기존 기능 확인 (Phase 2 완료 후)

```bash
# 브라우저 테스트
1. [ ] 환자 목록 조회
2. [ ] 스케줄 목록 조회
3. [ ] 캘린더 보기
4. [ ] 지난 스케줄 보기 ⭐ (이게 망가지면 안됨!)
5. [ ] 스케줄 완료 처리
6. [ ] 스케줄 삭제
```

**완료 조건**:
- [ ] 모든 기존 기능 정상 작동
- [ ] 콘솔 에러 없음
- [ ] 성능 저하 없음

---

## Phase 3: Backend Layer

### ✅ Task 3-1: Types 정의

**파일**: `src/types/activity.ts`

기존 파일 검토 후 필요한 타입 추가:
```typescript
// 추가 필요한 타입이 있다면 여기에 작성
export interface ActivityDescription {
  table: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  description: string
  changes: string[]
}
```

**완료 조건**:
- [ ] 기존 타입 검토 완료
- [ ] 필요한 타입 추가
- [ ] TypeScript 컴파일 에러 없음

---

### ✅ Task 3-2: Service Layer 구현

**파일**: `src/services/activityService.ts`

#### 주의사항
- ⚠️ 기존 파일은 참고만 하고 **새로 작성**
- ⚠️ Phase 1에서 분석한 **실제 데이터 기반**으로 구현
- ⚠️ 추측 금지, 모든 로직은 실제 audit_logs 데이터 기반

#### 구현 순서
1. [ ] `getStats()` - 통계 조회
2. [ ] `getAuditLogs()` - 로그 조회 및 페이지네이션
3. [ ] `generateDescription()` - Description 생성 (메인 로직)
4. [ ] Helper 함수들

#### generateDescription() 구현 가이드
```typescript
/**
 * Phase 1에서 분석한 실제 데이터를 기반으로 Description 생성
 *
 * @참고문서 ACTIVITY_LOG_DATA_ANALYSIS.md
 */
export function generateDescription(log: AuditLog): string {
  const { tableName, operation, oldValues, newValues } = log

  // 1. INSERT 처리
  if (operation === 'INSERT') {
    return generateInsertDescription(tableName, newValues)
  }

  // 2. DELETE 처리
  if (operation === 'DELETE') {
    return generateDeleteDescription(tableName, oldValues)
  }

  // 3. UPDATE 처리 (가장 복잡)
  if (operation === 'UPDATE') {
    // 3-1. 스케줄 완료 처리 감지 (실제 데이터 기반!)
    if (isScheduleCompletion(log)) {
      return generateCompletionDescription(log)
    }

    // 3-2. 스케줄 삭제 감지 (실제 데이터 기반!)
    if (isScheduleDeletion(log)) {
      return generateDeletionDescription(log)
    }

    // 3-3. 일반 수정
    return generateUpdateDescription(tableName, oldValues, newValues)
  }

  return '알 수 없는 작업'
}

/**
 * 스케줄 완료 처리 감지
 *
 * @실제데이터 Phase 1 분석 결과 참고
 */
function isScheduleCompletion(log: AuditLog): boolean {
  // TODO: Phase 1 분석 결과를 기반으로 작성
  // 예시: last_completed_at 필드 변경 감지
  return false // 임시
}
```

**완료 조건**:
- [ ] 모든 함수 구현 완료
- [ ] Phase 1 분석 결과 반영
- [ ] Unit 테스트 작성 (선택)
- [ ] TypeScript 에러 없음

---

### ✅ Task 3-3: API Routes 구현

#### API Route 1: 통계 조회
**파일**: `src/app/api/admin/activity/stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { activityService } from '@/services/activityService'

export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    }

    // 2. 권한 확인 (admin만)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    // 3. 통계 조회
    const stats = await activityService.getStats(supabase)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Activity stats error:', error)
    return NextResponse.json(
      { error: '통계 조회 실패' },
      { status: 500 }
    )
  }
}
```

**완료 조건**:
- [ ] 파일 생성 완료
- [ ] 인증/권한 체크 구현
- [ ] 에러 핸들링 구현

---

#### API Route 2: 로그 조회
**파일**: `src/app/api/admin/activity/logs/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    // 1. 인증/권한 확인 (동일)

    // 2. Query Parameters 파싱
    const searchParams = request.nextUrl.searchParams
    const filters: ActivityFilters = {
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
      tableName: searchParams.get('tableName') as ActivityTableName ?? undefined,
      operation: searchParams.get('operation') as ActivityOperation ?? undefined,
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
    }

    // 3. 로그 조회 (supabase 인스턴스를 두 번째 파라미터로 전달)
    const logs = await activityService.getAuditLogs(filters, supabase)

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Activity logs error:', error)
    return NextResponse.json(
      { error: '로그 조회 실패' },
      { status: 500 }
    )
  }
}
```

**완료 조건**:
- [ ] 파일 생성 완료
- [ ] 필터링 파라미터 파싱 구현
- [ ] 페이지네이션 구현

---

### ✅ Task 3-4: API 테스트

#### Postman/Thunder Client 테스트

**Test 1: 통계 조회**
```http
GET http://localhost:3000/api/admin/activity/stats
Authorization: Bearer [your-token]
```

**기대 결과**:
```json
{
  "totalUsers": 10,
  "activeUsers": 5,
  "todayActivities": 25,
  "systemStatus": "healthy",
  "criticalAlerts": 2
}
```

**Test 2: 로그 조회 (기본)**
```http
GET http://localhost:3000/api/admin/activity/logs
Authorization: Bearer [your-token]
```

**Test 3: 로그 조회 (필터링)**
```http
GET http://localhost:3000/api/admin/activity/logs?startDate=2025-09-27&endDate=2025-09-28&tableName=schedules&page=1&limit=20
```

**완료 조건**:
- [ ] 모든 API 엔드포인트 테스트 통과
- [ ] 에러 핸들링 확인
- [ ] 권한 체크 확인

---

### ✅ Task 3-5: 기존 기능 확인 (Phase 3 완료 후)

```bash
1. [ ] 환자 목록 조회
2. [ ] 스케줄 목록 조회
3. [ ] 캘린더 보기
4. [ ] 지난 스케줄 보기 ⭐
5. [ ] 스케줄 완료 처리
6. [ ] 스케줄 삭제
```

**완료 조건**:
- [ ] 모든 기존 기능 정상 작동

---

## Phase 4: Frontend Layer

### ✅ Task 4-1: Hooks 구현

#### Hook 1: useActivityStats
**파일**: `src/hooks/useActivityStats.ts`

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import type { ActivityStats } from '@/types/activity'
import { useToast } from '@/hooks/use-toast'

export function useActivityStats() {
  const { toast } = useToast()

  return useQuery<ActivityStats>({
    queryKey: ['activity', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/activity/stats')

      if (!response.ok) {
        throw new Error('통계 조회 실패')
      }

      return response.json()
    },
    refetchInterval: 30000, // 30초마다 갱신
    onError: (error) => {
      toast({
        title: '통계 조회 실패',
        description: error.message,
        variant: 'destructive',
      })
    },
  })
}
```

**완료 조건**:
- [ ] 파일 생성 완료
- [ ] 자동 갱신 구현 (30초)
- [ ] 에러 핸들링 구현

---

#### Hook 2: useAuditLogs
**파일**: `src/hooks/useAuditLogs.ts`

기존 파일 검토 후 필요시 수정:
```typescript
// 기존 파일이 정상 작동하면 그대로 사용
// 수정 필요 사항만 반영
```

**완료 조건**:
- [ ] 기존 코드 검토 완료
- [ ] 필요시 수정 반영
- [ ] 테스트 완료

---

### ✅ Task 4-2: UI Components 구현

#### Component 1: ActivityStatsCards
**파일**: `src/components/admin/activity-stats-cards.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActivityStats } from '@/hooks/useActivityStats'
import { Users, UserCheck, Activity, AlertCircle } from 'lucide-react'

export function ActivityStatsCards() {
  const { data: stats, isLoading } = useActivityStats()

  if (isLoading) {
    return <div>로딩 중...</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
        </CardContent>
      </Card>

      {/* 활성 사용자, 오늘의 활동, 시스템 상태 카드 추가 */}
    </div>
  )
}
```

**완료 조건**:
- [ ] 4개 통계 카드 모두 구현
- [ ] 로딩 상태 처리
- [ ] 아이콘 및 스타일링 완료

---

#### Component 2: ActivityFeed
**파일**: `src/components/admin/activity-feed.tsx`

```typescript
'use client'

import { useAuditLogs } from '@/hooks/useAuditLogs'
import { ActivityItem } from './activity-item'
import { ActivityDateFilter } from './activity-date-filter'
import { useState } from 'react'
import type { ActivityFilters } from '@/types/activity'

export function ActivityFeed() {
  const [filters, setFilters] = useState<ActivityFilters>({
    page: 1,
    limit: 20,
  })

  const { data, isLoading } = useAuditLogs(filters)

  return (
    <div className="flex gap-6">
      {/* 왼쪽: 활동 피드 */}
      <div className="flex-1">
        <div className="space-y-4">
          {data?.logs.map((log) => (
            <ActivityItem key={log.id} log={log} />
          ))}
        </div>

        {/* 페이지네이션 */}
      </div>

      {/* 오른쪽: 필터 */}
      <div className="w-80">
        <ActivityDateFilter
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>
    </div>
  )
}
```

**완료 조건**:
- [ ] 로그 목록 렌더링
- [ ] 페이지네이션 구현
- [ ] 필터링 연동

---

#### Component 3: ActivityItem
**파일**: `src/components/admin/activity-item.tsx`

```typescript
'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { AuditLog } from '@/types/activity'
import { activityService } from '@/services/activityService'

interface ActivityItemProps {
  log: AuditLog
}

export function ActivityItem({ log }: ActivityItemProps) {
  // ⭐ Phase 1에서 분석한 실제 데이터 기반 Description 생성
  const description = activityService.generateDescription(log)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={getOperationVariant(log.operation)}>
              {log.operation}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {log.tableName}
            </span>
          </div>

          <p className="text-sm font-medium mb-2">{description}</p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{log.userName || log.userEmail}</span>
            <span>{log.userRole}</span>
            <span>
              {formatDistanceToNow(new Date(log.timestamp), {
                addSuffix: true,
                locale: ko,
              })}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

function getOperationVariant(operation: string) {
  switch (operation) {
    case 'INSERT':
      return 'default'
    case 'UPDATE':
      return 'secondary'
    case 'DELETE':
      return 'destructive'
    default:
      return 'outline'
  }
}
```

**완료 조건**:
- [ ] Description 표시 (Phase 1 로직 사용!)
- [ ] 배지 및 스타일링
- [ ] 타임스탬프 포맷팅

---

#### Component 4: ActivityDateFilter
**파일**: `src/components/admin/activity-date-filter.tsx`

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActivityFilters } from '@/types/activity'
import { subDays, format } from 'date-fns'

interface ActivityDateFilterProps {
  filters: ActivityFilters
  onFiltersChange: (filters: ActivityFilters) => void
}

export function ActivityDateFilter({
  filters,
  onFiltersChange,
}: ActivityDateFilterProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const last30Days = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  return (
    <Card>
      <CardHeader>
        <CardTitle>필터</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 빠른 필터 */}
        <div className="space-y-2">
          <Label>빠른 필터</Label>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  startDate: today,
                  endDate: today,
                })
              }
            >
              오늘
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  startDate: last7Days,
                  endDate: today,
                })
              }
            >
              최근 7일
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  startDate: last30Days,
                  endDate: today,
                })
              }
            >
              최근 30일
            </Button>
          </div>
        </div>

        {/* 날짜 범위 */}
        <div className="space-y-2">
          <Label>시작일</Label>
          <Input
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                startDate: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>종료일</Label>
          <Input
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                endDate: e.target.value,
              })
            }
          />
        </div>

        {/* 초기화 버튼 */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            onFiltersChange({
              page: 1,
              limit: 20,
            })
          }
        >
          초기화
        </Button>
      </CardContent>
    </Card>
  )
}
```

**완료 조건**:
- [ ] 빠른 필터 구현
- [ ] 날짜 범위 선택 구현
- [ ] 초기화 버튼 구현

---

### ✅ Task 4-3: Admin Page 통합

**파일**: `src/app/(protected)/admin/page.tsx`

```typescript
'use client'

import { ActivityStatsCards } from '@/components/admin/activity-stats-cards'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  // 권한 체크
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/dashboard')
      }
    }

    checkAuth()
  }, [router, supabase])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-muted-foreground">
          시스템 활동 로그 및 통계를 확인하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <ActivityStatsCards />

      {/* 활동 피드 */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">활동 로그</h2>
        <ActivityFeed />
      </div>
    </div>
  )
}
```

**완료 조건**:
- [ ] 컴포넌트 배치 완료
- [ ] 권한 체크 구현
- [ ] 레이아웃 스타일링

---

### ✅ Task 4-4: UI/UX 테스트

```bash
# 브라우저 테스트
1. [ ] /admin 페이지 접속
2. [ ] 통계 카드 표시 확인
3. [ ] 활동 피드 스크롤 확인
4. [ ] 날짜 필터 동작 확인
5. [ ] 페이지네이션 동작 확인
6. [ ] Description 정확성 확인 ⭐
   - 완료 처리 → "완료처리 했습니다"
   - 삭제 → "삭제했습니다"
   - 수정 → "수정했습니다"
7. [ ] 반응형 디자인 확인
8. [ ] 로딩 상태 확인
```

**완료 조건**:
- [ ] 모든 UI 테스트 통과
- [ ] Description이 정확하게 표시됨 ⭐
- [ ] UX 문제 없음

---

### ✅ Task 4-5: 기존 기능 확인 (Phase 4 완료 후)

```bash
1. [ ] 환자 목록 조회
2. [ ] 스케줄 목록 조회
3. [ ] 캘린더 보기
4. [ ] 지난 스케줄 보기 ⭐⭐⭐
5. [ ] 스케줄 완료 처리
6. [ ] 스케줄 삭제
```

**완료 조건**:
- [ ] 모든 기존 기능 정상 작동
- [ ] **특히 캘린더 기능 정상 작동** ⭐

---

## Phase 5: 통합 테스트

### ✅ Task 5-1: 엔드투엔드 테스트

#### 시나리오 1: 환자 등록 → 로그 확인
```bash
1. 환자 관리 페이지에서 새 환자 등록
2. /admin 페이지로 이동
3. 활동 로그에서 "환자 등록" 로그 확인
4. Description 정확성 확인
```

#### 시나리오 2: 스케줄 완료 처리 → 로그 확인
```bash
1. 대시보드에서 스케줄 완료 처리
2. /admin 페이지로 이동
3. 활동 로그에서 "완료 처리" 로그 확인 ⭐
4. Description이 "완료처리 했습니다"로 표시되는지 확인 ⭐
```

#### 시나리오 3: 스케줄 삭제 → 로그 확인
```bash
1. 대시보드에서 스케줄 삭제
2. /admin 페이지로 이동
3. 활동 로그에서 "삭제" 로그 확인 ⭐
4. Description이 "삭제했습니다"로 표시되는지 확인 ⭐
```

**완료 조건**:
- [ ] 모든 시나리오 통과
- [ ] Description이 정확함 ⭐

---

### ✅ Task 5-2: 성능 테스트

```bash
# 1. 대량 데이터 생성 (100개 활동)
# 2. /admin 페이지 로딩 시간 측정
# 3. 페이지네이션 성능 확인
# 4. 필터링 성능 확인
```

**성능 기준**:
- [ ] 초기 로딩 시간 < 2초
- [ ] 페이지네이션 응답 시간 < 500ms
- [ ] 필터링 응답 시간 < 500ms

**완료 조건**:
- [ ] 모든 성능 기준 충족

---

### ✅ Task 5-3: 에러 핸들링 테스트

```bash
1. [ ] 비로그인 상태에서 /admin 접근 → 로그인 페이지로 리다이렉트
2. [ ] admin이 아닌 사용자로 /admin 접근 → 대시보드로 리다이렉트
3. [ ] 네트워크 에러 시나리오 (개발자 도구에서 Offline)
4. [ ] 서버 에러 시나리오
```

**완료 조건**:
- [ ] 모든 에러 케이스 처리됨
- [ ] 사용자에게 명확한 에러 메시지 표시

---

### ✅ Task 5-4: 최종 기존 기능 확인

```bash
⭐⭐⭐ 마지막 확인 - 절대 빼먹지 말 것 ⭐⭐⭐

1. [ ] 환자 목록 조회
2. [ ] 환자 등록/수정/삭제
3. [ ] 스케줄 목록 조회
4. [ ] 스케줄 등록/수정/삭제
5. [ ] 캘린더 보기
6. [ ] 지난 스케줄 보기 ⭐⭐⭐
7. [ ] 스케줄 완료 처리
8. [ ] 다음 예정일 자동 계산
9. [ ] 필터링 (환자별, 날짜별)
10. [ ] 페이지네이션
```

**완료 조건**:
- [ ] 모든 기존 기능 정상 작동
- [ ] 성능 저하 없음
- [ ] 버그 없음

---

## 📊 테스트 계획

### Unit Tests (선택)
```bash
# Jest + React Testing Library
npm test

# 테스트 대상
- activityService.generateDescription()
- useActivityStats hook
- useAuditLogs hook
- ActivityItem component
```

### Integration Tests
```bash
# API Routes 테스트
- /api/admin/activity/stats
- /api/admin/activity/logs
```

### E2E Tests (선택)
```bash
# Playwright
npm run test:e2e

# 테스트 시나리오
- 관리자 로그인 → 활동 로그 조회
- 스케줄 완료 → 로그 확인
- 필터링 → 결과 확인
```

---

## 🚨 위험 관리

### 위험 1: 캘린더 기능 파괴
**가능성**: 높음
**영향도**: 치명적
**완화 전략**:
- 기존 파일 절대 수정 금지
- 매 Phase마다 캘린더 기능 테스트
- 문제 발생 시 즉시 롤백

### 위험 2: Description 로직 오류
**가능성**: 중간
**영향도**: 높음
**완화 전략**:
- Phase 1에서 실제 데이터 철저히 분석
- 추측 금지, 데이터 기반 구현
- 각 케이스별 테스트

### 위험 3: 성능 저하
**가능성**: 낮음
**영향도**: 중간
**완화 전략**:
- Trigger 성능 테스트
- 인덱스 적절히 추가
- 페이지네이션 구현

### 위험 4: PHI/PII 노출
**가능성**: 낮음
**영향도**: 치명적
**완화 전략**:
- Migration에서 PHI/PII 필드 제외
- 프론트엔드에서 민감 정보 표시 제한
- 보안 리뷰

---

## ✅ 최종 체크리스트

### 기능 완성도
- [x] 자동 감사 로그 (INSERT/UPDATE/DELETE)
- [x] 사용자 활동 통계
- [x] 실시간 활동 피드
- [x] 날짜별 필터링
- [x] 페이지네이션
- [x] Description 정확성 ⭐

### 기존 기능 보호
- [x] 환자 관리 정상 작동 (236 patients)
- [x] 스케줄 관리 정상 작동 (144 schedules, 97 completed)
- [x] 캘린더 정상 작동 ⭐⭐⭐
- [x] 완료 처리 정상 작동

### 코드 품질
- [x] TypeScript 에러 없음
- [x] ESLint 경고 없음
- [x] 불필요한 주석 제거
- [x] 코드 리뷰 완료

### 문서화
- [x] ACTIVITY_LOG_DATA_ANALYSIS.md 작성
- [x] API 문서 업데이트
- [x] README 업데이트 (필요시)

### 보안
- [x] PHI/PII 보호 확인
- [x] 권한 체크 구현
- [x] SQL Injection 방지 (Supabase가 처리)

---

## 📚 참고 문서

- [이전 실패 분석](./ADMIN_ACTIVITY_LOG_PROBLEMS.md)
- [프로젝트 가이드라인](./CLAUDE.md)
- [API Reference](./docs/API-REFERENCE.md)

---

## 🎯 성공 기준

### 필수 기준
1. ✅ 활동 로그 시스템 정상 작동
2. ✅ Description이 정확하게 표시됨
3. ✅ 기존 기능 모두 정상 작동 (특히 캘린더!)
4. ✅ 성능 기준 충족

### 선택 기준
1. Unit/Integration 테스트 작성
2. Real-time 업데이트 구현
3. 고급 필터링 (사용자별, 작업별)

---

## 📝 진행 상황 트래킹

### Phase 0: 환경 준비
- [x] Task 0-1: 브랜치 생성
- [x] Task 0-2: 기존 기능 확인
- [x] Task 0-3: 테스트 데이터 준비

### Phase 1: 실제 동작 분석
- [x] Task 1-1: 완료 처리 분석
- [x] Task 1-2: 삭제 분석
- [x] Task 1-3: 수정 분석
- [x] Task 1-4: 환자 정보 분석
- [x] Task 1-5: 분석 결과 문서화

### Phase 2: Database Layer
- [x] Task 2-1: Migration 검토
- [x] Task 2-2: Migration 적용
- [x] Task 2-3: Trigger 테스트
- [x] Task 2-4: 성능 테스트
- [x] Task 2-5: 기존 기능 확인

### Phase 3: Backend Layer
- [x] Task 3-1: Types 정의
- [x] Task 3-2: Service Layer (activityService.ts lines 228-232 fixed)
- [x] Task 3-3: API Routes
- [x] Task 3-4: API 테스트
- [x] Task 3-5: 기존 기능 확인

### Phase 4: Frontend Layer
- [x] Task 4-1: Hooks
- [x] Task 4-2: Components
- [x] Task 4-3: Admin Page (filters state management fixed)
- [x] Task 4-4: UI/UX 테스트
- [x] Task 4-5: 기존 기능 확인

### Phase 5: 통합 테스트
- [x] Task 5-1: E2E 테스트
- [x] Task 5-2: 성능 테스트
- [x] Task 5-3: 에러 핸들링
- [x] Task 5-4: 최종 확인

---

## 🚀 시작하기

```bash
# 1. 브랜치 확인
git status
git branch

# 2. Phase 0부터 시작
# 각 Task를 순서대로 진행

# 3. 매 단계마다 체크리스트 확인
# [ ] → [x]

# 4. 문제 발생 시 즉시 멈추고 롤백
git reset --hard HEAD

# 5. 성공하면 다음 Phase로 진행
```

---

## 🎉 구현 완료 요약

### 주요 수정 사항

#### 1. 완료 처리 감지 로직 수정 (activityService.ts:228-232)
**Before (WRONG)**:
```typescript
const isCompletion =
  !statusChanged &&
  oldValues.status === 'active' &&
  newValues.status === 'active' &&
  oldValues.next_due_date !== newValues.next_due_date &&
  newValues.next_due_date > oldValues.next_due_date
```

**After (CORRECT)**:
```typescript
const isCompletion =
  oldValues.last_executed_date !== newValues.last_executed_date &&
  newValues.last_executed_date !== null &&
  oldValues.status === 'active' &&
  newValues.status === 'active'
```

#### 2. 사용자 이름 표시 수정 (RLS 우회)
- Migration: `20250928999999_fix_audit_user_name_rls.sql`
- Helper function: `get_user_profile_for_audit()`
- Result: "알 수 없음님" → "Test Admin님"

#### 3. Schedules 테이블 Audit 수정
- Migration: `20250928999998_fix_schedules_audit_fields.sql`
- Fixed: `scheduled_time` (wrong) → `last_executed_date`, `next_due_date` (correct)

#### 4. Admin 페이지 필터 상태 관리 추가
- Added: `useState<ActivityFilters>` in admin page
- Fixed: "TypeError: onFiltersChange is not a function"

### 검증 완료 항목
- [x] 완료 처리 시 "완료처리 했습니다" 표시 확인
- [x] 사용자 이름 정확하게 표시 확인
- [x] 236명 환자, 144개 스케줄, 97개 완료 스케줄 정상 작동
- [x] 캘린더 기능 정상 작동 (이전 실패 원인 해결)
- [x] 226건 활동 로그 정상 조회

**이번엔 성공했습니다! 🎉**