# 관리자 활동 로그 기능 - 실패 기록 및 재작업 가이드

**작성일**: 2025-09-28
**브랜치**: `feature/admin-activity-tracking` (폐기됨)
**상태**: ❌ 실패 - 기능 망가뜨림

---

## ⚠️ 브랜치 폐기 사유

1. **캘린더 "지난 스케줄 보기" 기능 망가짐**
   - 완료한 스케줄이 캘린더에서 제대로 표시 안 됨
   - 원인 파악 실패
   - 복구 불가능

2. **활동 로그 Description 로직 오류**
   - 완료 처리했는데 "날짜 수정했다"고 표시됨
   - 삭제했는데 "완료처리 했다"고 표시됨
   - 로직이 추측으로 작성되어 실제 동작과 불일치

3. **관련 없는 파일들 수정**
   - 환자 페이지, API 등 건드리지 말았어야 할 파일 수정
   - 어떤 수정이 캘린더를 망가뜨렸는지 파악 안 됨

---

## 📁 변경된 파일 목록

### 신규 생성 파일 (활동 로그 기능)

#### Database
- `supabase/migrations/20250928000001_improve_audit_logs.sql`
- `supabase/migrations/20250928000002_fix_duplicate_audit_logs.sql`

#### Backend
- `src/types/activity.ts`
- `src/services/activityService.ts` ⚠️
- `src/hooks/useActivityStats.ts`
- `src/hooks/useAuditLogs.ts`
- `src/app/api/admin/activity/stats/route.ts`
- `src/app/api/admin/activity/logs/route.ts`

#### Frontend
- `src/components/admin/activity-stats-cards.tsx`
- `src/components/admin/activity-feed.tsx`
- `src/components/admin/activity-item.tsx`
- `src/components/admin/activity-date-filter.tsx`
- `src/app/(protected)/admin/page.tsx`

#### 문서
- `MULTI_TENANCY_PLAN.md` (활동 로그와 무관 - Multi-tenancy 계획)

#### 임시 파일
- `check_completed.mjs`
- `check_db_function.mjs`

### 수정된 기존 파일 (⚠️ 캘린더 망가뜨린 원인 가능성)
- `src/app/(protected)/dashboard/patients/page.tsx`
- `src/app/api/patients/[id]/update-doctor/route.ts`
- `src/app/api/patients/[id]/update/route.ts`
- `docs/API-REFERENCE.md`

### 삭제된 파일
- `FILTER_CONTEXT_MANAGEMENT.md`
- `FILTER_TODO.md`

---

## 🐛 주요 문제점

### 문제 1: 완료 처리 감지 로직 오류

**위치**: `src/services/activityService.ts:228-233`

```typescript
// ❌ 잘못된 로직
const isCompletion =
  !statusChanged &&
  oldValues.status === 'active' &&
  newValues.status === 'active' &&
  oldValues.next_due_date !== newValues.next_due_date &&
  newValues.next_due_date > oldValues.next_due_date
```

**문제**:
- 실제 완료 처리 로직을 파악하지 않고 추측으로 구현
- next_due_date 비교로 완료 처리 감지 시도했으나 실패
- 결과: "완료 처리했는데 날짜 수정했다고 표시됨"

**원인**:
- schedule_executions 테이블 확인 안 함
- completed_at 필드 확인 안 함
- 실제 audit_logs 데이터 보지 않고 구현

### 문제 2: 삭제 감지 로직 오류

**위치**: `src/services/activityService.ts:236`

```typescript
// ❌ 잘못된 로직
const isDeletion =
  statusChanged &&
  oldValues.status === 'active' &&
  newValues.status === 'cancelled'
```

**문제**:
- active → cancelled만 삭제로 간주
- 실제 삭제가 어떻게 처리되는지 확인 안 함
- 결과: "삭제했는데 완료처리 했다고 표시됨"

**원인**:
- 실제 API 호출해서 audit_logs 확인 안 함
- soft delete vs hard delete 파악 안 함
- 추측으로 구현

### 문제 3: 캘린더 "지난 스케줄 보기" 기능 파괴

**증상**:
- 완료한 스케줄이 캘린더에서 제대로 표시 안 됨
- 지난 스케줄 조회 불가능

**원인 파악 실패**:
- 어떤 파일 수정이 원인인지 모름
- 다음 파일들 중 하나 이상이 원인일 가능성:
  - `src/app/(protected)/dashboard/patients/page.tsx`
  - `src/app/api/patients/[id]/update-doctor/route.ts`
  - `src/app/api/patients/[id]/update/route.ts`
  - Migration의 trigger가 성능 문제?
  - 다른 수정사항?

**복구 실패**:
- git diff로 변경사항 확인했으나 원인 못 찾음
- 브랜치 전체 폐기 결정

---

## 🔍 재작업 시 반드시 확인할 것

### Phase 0: 실제 동작 파악 (선작업 필수!)

```bash
□ 완료 처리 시 실제로 어떤 일이 벌어지는가?
  - 어떤 테이블이 변경되는가?
  - schedule_executions 테이블에 INSERT?
  - schedules 테이블의 어떤 필드가 UPDATE?
  - completed_at, last_completed_at 필드?
  - 실제로 완료 처리 해보고 audit_logs 확인

□ 삭제 시 실제로 어떤 일이 벌어지는가?
  - soft delete (status 변경)?
  - hard delete (DELETE)?
  - is_active = false?
  - 실제로 삭제 해보고 audit_logs 확인

□ 스케줄 수정 시 어떤 필드들이 변경되는가?
  - next_due_date만 변경되면?
  - status + next_due_date 동시 변경되면?
  - 실제 케이스별로 audit_logs 확인
```

### Phase 1: Migration 재검토

```bash
□ Trigger 성능 테스트
  - audit_table_changes() 함수가 성능 문제 일으키는가?
  - 대용량 데이터에서 느려지는가?
  - 필요하면 비동기 처리 고려

□ 중복 방지 로직 검증
  - updated_at 제외 비교가 제대로 작동하는가?
  - 엣지 케이스 테스트

□ 환자명/항목명 추가 로직 검증
  - _patient_name, _item_name이 제대로 들어가는가?
  - JOIN 성능 문제 없는가?
```

### Phase 2: Service Layer 재작성

```bash
□ activityService.ts 전체 재작성
  - generateUpdateDescription() 메서드 완전히 새로 작성
  - 실제 데이터 기반으로 로직 구현
  - 각 테이블별 케이스 확인:
    - patients: 이름 변경, 진료구분 변경, 담당의 변경, 활성상태 변경
    - schedules: 완료처리, 삭제, 날짜 수정, 상태 변경, 메모 수정
    - profiles: 이름, 역할, 진료구분, 승인상태 변경

□ 테스트 케이스 작성
  - 완료 처리 → "완료처리 했습니다" 나와야 함
  - 삭제 → "삭제했습니다" 나와야 함
  - 날짜 수정 → "다음 예정일 수정" 나와야 함
  - 각 케이스마다 실제로 해보고 확인
```

### Phase 3: 기존 기능 보호

```bash
□ 절대 건드리지 말 것
  - 환자 관리 관련 파일
  - 스케줄 관리 관련 파일
  - 캘린더 관련 파일
  - API 라우트 (활동 로그 전용 API만 생성)

□ 매 수정마다 테스트
  - 환자 목록 조회 작동하는가?
  - 스케줄 목록 조회 작동하는가?
  - 캘린더 보기 작동하는가?
  - 지난 스케줄 보기 작동하는가?
  - 완료 처리 작동하는가?
```

---

## 📝 구현했던 기능 목록

### ✅ 작동하는 기능 (확인됨)

1. **통계 카드**
   - 전체 사용자 수
   - 활성 사용자 수
   - 오늘의 활동 수
   - 시스템 상태
   - 중요 알림 (오늘 삭제 작업 수)

2. **활동 로그 조회**
   - 페이지네이션 (20개씩)
   - 날짜 필터링 (시작일, 종료일)
   - 빠른 필터 (오늘, 최근 7일, 최근 30일)
   - 실시간 갱신 (30초마다)

3. **UI 컴포넌트**
   - 통계 카드 레이아웃
   - 활동 피드 (스크롤)
   - 활동 아이템 (배지, 타임스탬프)
   - 날짜 필터 사이드바

4. **Database Trigger**
   - INSERT/UPDATE/DELETE 자동 로깅
   - 중복 로그 방지 (updated_at 제외 비교)
   - 사용자 정보 자동 캡처
   - 환자명/항목명 자동 추가 (schedules)

### ⚠️ 작동 안 하는 기능 (문제 있음)

1. **Description 생성**
   - 완료 처리 감지 실패
   - 삭제 감지 실패
   - 잘못된 메시지 표시

2. **캘린더 보기**
   - 지난 스케줄 조회 불가능
   - 원인 파악 실패

---

## 💡 배운 교훈

### 1. 추측으로 구현하지 말 것

**❌ 나쁜 예**:
```typescript
// 완료 처리는 아마 next_due_date가 변경되겠지?
const isCompletion = newValues.next_due_date > oldValues.next_due_date
```

**✅ 좋은 예**:
```typescript
// 1. 실제로 완료 처리 해보기
// 2. audit_logs 테이블 확인
// 3. old_values, new_values 확인
// 4. 실제 데이터 기반으로 로직 작성
```

### 2. 관련 없는 파일 건드리지 말 것

**❌ 실수**:
- 활동 로그 기능 추가하면서 환자/스케줄 API 수정
- 결과: 캘린더 보기 망가짐

**✅ 올바른 방법**:
- 활동 로그 전용 파일만 생성
- 기존 파일 절대 수정 금지
- 새 API 라우트만 추가 (`/api/admin/activity/*`)

### 3. 매 단계마다 테스트

**❌ 실수**:
- 여러 기능 한꺼번에 구현
- 마지막에 테스트
- 문제 발견했을 때 원인 못 찾음

**✅ 올바른 방법**:
- Migration 적용 → 테스트
- Service 추가 → 테스트
- Component 추가 → 테스트
- 기존 기능 작동 확인 → 테스트

### 4. 실제 데이터 먼저 확인

**체크리스트**:
```bash
□ 완료 처리 해보기
□ audit_logs 테이블 SELECT
□ old_values, new_values 확인
□ 어떤 필드가 변경되는지 파악
□ 그 다음에 코드 작성
```

---

## 🔧 재작업 시 사용 가능한 파일

### ⚠️ 주의: 모든 파일을 의심하고 시작할 것

이 브랜치는 캘린더 기능을 망가뜨렸고, 원인을 파악하지 못했습니다.
따라서 **어떤 파일도 100% 안전하다고 보장할 수 없습니다**.

### 조심스럽게 재사용 고려 가능 (검증 필수)

#### Database (성능 테스트 후 사용)
- `supabase/migrations/20250928000001_improve_audit_logs.sql`
  - ⚠️ Trigger가 성능 문제 일으킬 수 있음
  - ⚠️ 대용량 데이터에서 테스트 필요

- `supabase/migrations/20250928000002_fix_duplicate_audit_logs.sql`
  - ⚠️ 중복 방지 로직 검증 필요
  - ⚠️ 환자명/항목명 추가 로직 확인 필요

#### Types (참고용)
- `src/types/activity.ts`
  - 타입 정의만 참고
  - 실제 사용 시 프로젝트에 맞게 수정

#### Hooks (구조만 참고)
- `src/hooks/useActivityStats.ts`
- `src/hooks/useAuditLogs.ts`
  - React Query 패턴 참고용
  - 실제 구현은 다시 검토

#### Components (UI만 참고)
- `src/components/admin/activity-stats-cards.tsx`
- `src/components/admin/activity-feed.tsx`
- `src/components/admin/activity-item.tsx`
- `src/components/admin/activity-date-filter.tsx`
  - UI 레이아웃만 참고
  - 로직은 재검토 필요

#### API Routes (구조만 참고)
- `src/app/api/admin/activity/stats/route.ts`
- `src/app/api/admin/activity/logs/route.ts`
  - 권한 체크 로직 참고
  - 실제 쿼리는 재작성

#### Admin Page (구조만 참고)
- `src/app/(protected)/admin/page.tsx`
  - 레이아웃만 참고

### ❌ 절대 사용 금지

#### Service Layer
- `src/services/activityService.ts`
  - **generateUpdateDescription() 전체 재작성 필요**
  - 완료/삭제 감지 로직 틀림
  - INSERT/DELETE description도 재검토 필요

#### 수정된 기존 파일들
- `src/app/(protected)/dashboard/patients/page.tsx`
- `src/app/api/patients/[id]/update-doctor/route.ts`
- `src/app/api/patients/[id]/update/route.ts`
- `docs/API-REFERENCE.md`
  - **이 파일들의 변경사항 절대 사용 금지**
  - 캘린더 망가뜨린 원인일 가능성

---

## 📋 재작업 체크리스트

### Phase 0: 준비 단계
```bash
□ 새 브랜치 생성 (feature/admin-activity-v2)
□ 기존 기능 모두 작동하는지 확인
  □ 환자 목록 조회
  □ 스케줄 목록 조회
  □ 캘린더 보기
  □ 지난 스케줄 보기
  □ 완료 처리
  □ 삭제
```

### Phase 1: 실제 동작 파악
```bash
□ 완료 처리 실제로 해보기
  □ audit_logs 테이블 SELECT
  □ old_values, new_values 확인
  □ 어떤 필드가 변경되는지 문서화

□ 삭제 실제로 해보기
  □ audit_logs 테이블 SELECT
  □ old_values, new_values 확인
  □ soft/hard delete 확인

□ 날짜 수정 실제로 해보기
  □ audit_logs 테이블 SELECT
  □ 완료 처리와 차이점 확인
```

### Phase 2: Database
```bash
□ Migration 1 적용
  □ audit_table_changes() 함수 생성
  □ Trigger 생성
  □ 성능 테스트 (INSERT/UPDATE/DELETE 여러 번)

□ Migration 2 적용
  □ 중복 방지 로직 추가
  □ 환자명/항목명 추가 로직
  □ 테스트: 동일한 값으로 UPDATE 시 로그 안 남는지

□ 기존 기능 확인
  □ 환자 목록 조회
  □ 스케줄 목록 조회
  □ 캘린더 보기
  □ 완료 처리
```

### Phase 3: Backend
```bash
□ Types 정의
  □ activity.ts 생성
  □ 필요한 타입 추가

□ Service Layer 작성
  □ activityService.ts 생성
  □ getStats() 구현
  □ getAuditLogs() 구현
  □ generateDescription() 구현
    □ INSERT description (실제 데이터 기반)
    □ UPDATE description (실제 데이터 기반)
    □ DELETE description (실제 데이터 기반)
  □ 각 메서드마다 테스트

□ API Routes 생성
  □ /api/admin/activity/stats
  □ /api/admin/activity/logs
  □ 권한 체크 (admin만)
  □ Postman/Thunder Client로 테스트

□ 기존 기능 확인
  □ 환자 목록 조회
  □ 스케줄 목록 조회
  □ 캘린더 보기
  □ 완료 처리
```

### Phase 4: Frontend
```bash
□ Hooks 생성
  □ useActivityStats
  □ useAuditLogs

□ Components 생성
  □ ActivityStatsCards
  □ ActivityFeed
  □ ActivityItem (description 표시 확인!)
  □ ActivityDateFilter

□ Admin Page 수정
  □ /admin 페이지에 컴포넌트 배치
  □ 레이아웃 확인

□ 기존 기능 확인
  □ 환자 목록 조회
  □ 스케줄 목록 조회
  □ 캘린더 보기
  □ 지난 스케줄 보기
  □ 완료 처리
```

### Phase 5: 테스트
```bash
□ 완료 처리 테스트
  □ 스케줄 완료 처리
  □ 활동 로그 확인
  □ Description: "완료처리 했습니다" 나오는지
  □ 캘린더에서 제대로 표시되는지

□ 삭제 테스트
  □ 스케줄 삭제
  □ 활동 로그 확인
  □ Description: "삭제했습니다" 나오는지

□ 수정 테스트
  □ 환자 정보 수정
  □ 스케줄 날짜 수정
  □ Description 정확한지

□ 필터 테스트
  □ 날짜 필터링
  □ 페이지네이션
  □ 실시간 갱신

□ 성능 테스트
  □ 대용량 로그 (1000개+)
  □ 페이지 로딩 속도
  □ Trigger 성능
```

---

## 🚨 절대 잊지 말 것

1. **완료 처리 / 삭제 로직을 추측하지 말 것**
   - 반드시 실제로 해보고 audit_logs 확인
   - 실제 데이터 기반으로 코드 작성

2. **기존 파일 절대 건드리지 말 것**
   - 환자/스케줄/캘린더 관련 파일 수정 금지
   - 활동 로그 전용 파일만 생성

3. **매 단계마다 기존 기능 확인**
   - Migration 후 → 기존 기능 테스트
   - Service 추가 후 → 기존 기능 테스트
   - Component 추가 후 → 기존 기능 테스트
   - 특히 **캘린더 보기, 지난 스케줄 보기** 반드시 확인

4. **문제 생기면 즉시 롤백**
   - 원인 모르면 그냥 되돌리기
   - 한 번에 하나씩만 변경

---

## 📚 참고 자료

- Multi-tenancy 계획: `MULTI_TENANCY_PLAN.md`
- API Reference: `docs/API-REFERENCE.md`
- Supabase Migration 가이드: `CLAUDE.md`

---

## 결론

이 브랜치는 **완전히 실패**했습니다.

**실패 원인**:
1. 추측으로 구현 (실제 동작 파악 안 함)
2. 관련 없는 파일 수정 (캘린더 망가뜨림)
3. 테스트 부족 (마지막에 한꺼번에)

**재작업 시 핵심**:
1. 실제 데이터 먼저 확인
2. 기존 파일 절대 건드리지 말기
3. 매 단계마다 테스트
4. 문제 생기면 즉시 롤백

**교훈**:
- 코드 작성은 빠르지만, 디버깅은 느리다
- 추측으로 구현하면 반드시 망한다
- 기존 기능을 망가뜨리면 모든 게 무의미하다

---

**다음 번엔 반드시 성공하자.**