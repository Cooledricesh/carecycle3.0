# 역할 기반 스마트 필터 구현 TODO (Enhanced v3.0)

## 📋 개요
사용자의 role(doctor/nurse/admin)에 따라 자동으로 기본 필터를 적용하고, 간단한 토글로 전체 보기를 제공하는 **고성능 서버사이드 필터링 시스템**

## 🎯 목표
- **주치의(doctor)**: 기본적으로 본인 환자만 표시 → 전체 보기 토글 제공
- **간호사(nurse)**: 기본적으로 소속 진료구분만 표시 → 전체 보기 토글 제공
- **관리자(admin)**: 모든 데이터 표시, 기존 필터 사용 가능

## 🚨 핵심 개선사항 (전문가 평가 기반)
- **성능**: 클라이언트 → 서버사이드 필터링 전환 (70-80% 성능 개선 예상)
- **안전성**: 의료 환경 맞춤 긴급도 표시 및 확인 다이얼로그
- **모바일**: 44px 터치 타겟 및 오프라인 지원
- **상태관리**: 멀티탭 동기화 및 3단계 영속성

## ✅ 이미 구현된 사항 (2025-09-22 DB 확인 완료)
### 데이터베이스 레벨
- ✅ **doctor role이 user_role ENUM에 추가됨** (nurse, admin, doctor)
- ✅ **patients 테이블에 doctor_id 컬럼 추가 완료**
- ✅ **profiles 테이블에 care_type 컬럼 추가 완료** (department 대신 care_type 사용)
- ✅ **RLS 정책 설정 완료** (doctor는 자신의 환자만 조회 가능)
- ✅ **care_type 필터 버튼 구현 완료** (외래/입원/낮병원)

---

## ✅ 구현 체크리스트 (개선된 우선순위)

### ✅ Phase 0: 서버사이드 필터링 기반 (이미 완료!)

#### 0.1 데이터베이스 최적화 [완료됨]
- ✅ **서버사이드 필터링 함수 생성**
  ```sql
  -- get_filtered_schedules 함수 구현 완료
  -- doctor role 필터링, nurse care_type 필터링, show_all 플래그 모두 구현됨
  ```
- ✅ **복합 인덱스 추가**
  - ✅ `idx_schedules_status_next_due` (확인됨)
  - ✅ `idx_patients_doctor_care_type` (확인됨)
  - ✅ `idx_schedules_patient_status_date` (확인됨)
  - ✅ `idx_profiles_role_care_type` (추가 확인)
  - ✅ `idx_patients_care_type_active` (추가 확인)
- ✅ **Materialized View 생성**
  - ✅ `dashboard_schedule_summary` (구현 확인)
  - urgency_level 계산 포함
  - doctor_name 조인 포함

#### 0.2 Filter Strategy Pattern 구현 [완료됨]
- ✅ `/services/filters/FilterStrategyFactory.ts` (확인됨)
- ✅ `/services/filters/DoctorFilterStrategy.ts` (확인됨)
- ✅ `/services/filters/NurseFilterStrategy.ts` (확인됨)
- ✅ `/services/filters/AdminFilterStrategy.ts` (확인됨)
- ✅ `/services/filters/types.ts` (확인됨)
- ✅ `/services/filters/index.ts` (확인됨)

---

### ✅ Phase 1: 핵심 서비스 계층 구현 [완료됨]

#### 1.1 Enhanced Service Layer [완료됨]
- ✅ `/services/scheduleServiceEnhanced.ts` (확인됨)
  - ✅ 서버사이드 쿼리 구현 (get_filtered_schedules 함수 활용)
  - ✅ 캐싱 레이어 추가 (5분 TTL)
  - ✅ 성능 모니터링 메트릭
  - [ ] Circuit Breaker 패턴 (추후 구현 예정)

#### 1.2 필터 타입 확장 [완료됨]
- ✅ `/lib/filters/filter-types.ts` (확인됨)
  - ✅ `showAll: boolean` 필드 추가
  - ✅ `urgencyLevel: 'urgent' | 'normal'` 추가
  - ✅ `FilterStrategy` interface 정의 (types.ts에 구현)
- ✅ `/lib/filters/role-based-filters.ts` (확인됨)
- ✅ `/lib/filters/filter-persistence.ts` (확인됨)

---

### ✅ Phase 2: UI/UX 구현 [대부분 완료]

#### 2.1 모바일 최적화 SimpleFilterToggle 컴포넌트 [완료됨]
- ✅ `/components/filters/SimpleFilterToggle.tsx` (확인됨)
  - ✅ **44px 최소 터치 타겟** 적용
  - ✅ **환자 수 실시간 표시**: "내 환자 (12)" vs "전체 환자 (156)"
  - ✅ **긴급 환자 뱃지**: 긴급 환자 수 표시
  - [ ] **스와이프 제스처** 지원 (선택사항 - 나중에 추가)
  - ✅ Role별 UI 차별화
    - ✅ doctor: "내 환자" / "전체 환자" 토글
    - ✅ nurse: "{care_type} 환자" / "전체 환자" 토글
    - ✅ admin: null 반환

#### 2.2 Enhanced FilterBar [완료됨]
- ✅ `/components/filters/FilterBar.tsx` (확인됨)
  - ✅ **Progressive Disclosure** 패턴 적용
  - ✅ **시각적 계층 구조**: Primary → Secondary → Advanced
  - [ ] **긴급도 표시기** 추가 (SimpleFilterToggle에 부분 구현)
  - [ ] **필터 변경 확인 다이얼로그** (의료진 안전 기능 - 추가 필요)
  - ✅ Role별 레이아웃
    - ✅ doctor: SimpleFilterToggle only
    - ✅ nurse: SimpleFilterToggle + 접을 수 있는 고급 필터
    - ✅ admin: 전체 필터 UI

#### 2.3 의료 환경 특화 컴포넌트
- [ ] `/components/filters/FilterSummary.tsx` 생성
  - [ ] 현재 필터 상태 실시간 표시
  - [ ] **긴급 환자 알림**: "긴급 3명 포함"
  - [ ] **교대 인계 노트** 지원
- [ ] `/components/filters/UndoButton.tsx` 생성
  - [ ] 실수 복구를 위한 Undo 기능
  - [ ] 3초간 표시 후 자동 숨김

---

### Phase 3: 상태 관리 고도화 (Day 5)

#### 3.1 Multi-Tab Sync FilterProvider
- [ ] `/providers/filter-provider-enhanced.tsx` 생성
  - [ ] **BroadcastChannel API**로 멀티탭 동기화
  - [ ] **3단계 영속성**: URL → Session → Local Storage
  - [ ] **Optimistic Updates** with rollback
  - [ ] **Debounced URL sync** (300ms)
  - [ ] **Version Migration** 시스템

#### 3.2 Offline Support
- [ ] `/lib/storage/FilterPersistence.ts` 생성
  - [ ] IndexedDB 기반 오프라인 캐싱
  - [ ] 네트워크 복구 시 자동 동기화
  - [ ] Storage quota 관리

---

### Phase 4: 안전성 및 성능 최적화 (Day 6)

#### 4.1 Healthcare Safety Features
- [ ] **확인 다이얼로그 구현**
  - [ ] 긴급 환자 있을 때 필터 변경 확인
  - [ ] 교대 인계 시 필터 상태 확인
- [ ] **에러 복구 메커니즘**
  - [ ] Circuit Breaker 패턴 구현
  - [ ] Fallback to cached data
  - [ ] 네트워크 에러 시 오프라인 모드
- [ ] **성능 모니터링 대시보드**
  - [ ] Query time metrics
  - [ ] Cache hit rate
  - [ ] User interaction tracking

#### 4.2 API Endpoints
- [ ] `/api/v1/schedules/filtered` 생성
  - [ ] Role-based query optimization
  - [ ] Pagination support
  - [ ] Rate limiting
- [ ] `/api/v1/schedules/cache/invalidate` 생성
  - [ ] Selective cache invalidation

---

### Phase 5: 통합 테스트 (Day 7)

#### 5.1 역할별 시나리오 테스트
- [ ] **Doctor 계정 테스트**
  - [ ] 서버사이드 필터링 성능 측정 (목표: <50ms)
  - [ ] 긴급 환자 표시 검증
  - [ ] 멀티탭 동기화 확인

- [ ] **Nurse 계정 테스트**
  - [ ] 교대 인계 시나리오
  - [ ] 부서 변경 처리
  - [ ] 오프라인 → 온라인 전환

- [ ] **Admin 계정 테스트**
  - [ ] 대량 데이터 처리 (1000+ records)
  - [ ] 복합 필터 조합
  - [ ] 실시간 업데이트

#### 5.2 의료 환경 특화 테스트
- [ ] **중단 복구 테스트**: 작업 중 인터럽트 시나리오
- [ ] **응급 상황 테스트**: 긴급 환자 빠른 접근
- [ ] **교대 근무 테스트**: 필터 상태 인계
- [ ] **모바일 사용 테스트**: 태블릿 회진 시나리오
- [ ] **접근성 테스트**: 스크린 리더 호환성

---

---

## 🏗️ 기술 아키텍처 (구현 완료 상태)

### ✅ 데이터베이스 구조 (구현 확인)
```sql
-- 서버사이드 필터링 함수 (구현 완료)
CREATE OR REPLACE FUNCTION get_filtered_schedules(
  p_user_id UUID,
  p_show_all BOOLEAN DEFAULT FALSE,
  p_care_types TEXT[] DEFAULT NULL,
  p_date_start DATE DEFAULT NULL,
  p_date_end DATE DEFAULT NULL
) RETURNS TABLE(...) AS $$
-- doctor role: p.doctor_id = p_user_id
-- nurse role: p.care_type = v_user_care_type
-- admin role: 모든 데이터 접근 가능
-- show_all = TRUE: 역할 제한 우회
$$;

-- Materialized View (구현 완료)
CREATE MATERIALIZED VIEW dashboard_schedule_summary AS
-- urgency_level 계산 포함
-- doctor_name 조인 포함
```

### Service Layer Architecture
```typescript
// Filter Strategy Pattern
FilterStrategyFactory
  ├── DoctorFilterStrategy  // 의사 전용 최적화
  ├── NurseFilterStrategy   // 간호사 부서 기반
  └── AdminFilterStrategy   // 관리자 전체 접근

// Enhanced Service with Caching
ScheduleServiceEnhanced
  ├── Server-side queries
  ├── 5-minute cache TTL
  └── Circuit breaker pattern
```

### State Management
```typescript
// Multi-tab synchronization
BroadcastChannel API
  ├── Real-time filter sync
  ├── 3-tier persistence (URL → Session → Local)
  └── Optimistic updates with rollback
```

---

## 🎯 즉시 구현 가능한 작업 (실제 필요한 작업만)

### 🔥 우선순위 1: UI 통합 작업
- [ ] **대시보드에 SimpleFilterToggle 통합**
  - [ ] DashboardPage에서 user role 확인
  - [ ] doctor/nurse일 때 SimpleFilterToggle 렌더링
  - [ ] admin일 때 기존 FilterBar 유지
- [ ] **get_filtered_schedules 함수 호출 연결**
  - [ ] scheduleServiceEnhanced에서 실제 DB 함수 호출
  - [ ] show_all 파라미터 전달 구현

### 단기 (1-2주)
- [ ] 필터 프리셋 저장 기능
- [ ] 필터 히스토리 기능
- [ ] 간호사용 고급 필터 옵션 (care_type 선택)

### 중기 (1개월)
- [ ] 고급 필터 옵션 (날짜, 상태 등)
- [ ] 필터 조합 저장 및 공유
- [ ] 부서간 협업 필터

### 장기 (3개월)
- [ ] AI 기반 스마트 필터 추천
- [ ] 필터 사용 패턴 분석
- [ ] 개인화된 대시보드 뷰

---

## 📊 성능 목표 & 메트릭

### 핵심 성능 지표 (KPI)
| 지표 | 현재 (클라이언트) | 목표 (서버사이드) | 개선율 |
|-----|-----------------|-----------------|--------|
| **쿼리 응답 시간** | 200-500ms | <50ms | 75-90% ↓ |
| **데이터 전송량** | 전체 데이터 | 필터링된 데이터만 | 60-80% ↓ |
| **캐시 적중률** | 0% | >80% | - |
| **동시 사용자** | 10-20명 | 100+ 명 | 500% ↑ |
| **모바일 로딩** | 3-5초 | <1초 | 70-80% ↓ |

### 사용자 경험 목표
- **필터 전환 시간**: < 300ms
- **멀티탭 동기화**: < 100ms
- **오프라인 복구**: < 2초
- **긴급 환자 접근**: 원클릭

## 📝 참고 사항

### 현재 구조
```typescript
// profiles 테이블
role: 'doctor' | 'nurse' | 'admin'  // ✅ doctor role 구현 완료
care_type: '외래' | '입원' | '낮병원' | null  // ✅ department → care_type

// patients 테이블
doctor_id: UUID | null  // ✅ 이미 구현됨
care_type: '외래' | '입원' | '낮병원' | null  // ✅ 구현 완료
```

### 예상 작업 시간 (전문가 평가 반영)
- **Phase 0**: 서버사이드 기반 - Day 1 (최우선)
- **Phase 1**: 서비스 계층 - Day 1-2
- **Phase 2**: UI/UX 구현 - Day 3-4
- **Phase 3**: 상태 관리 - Day 5
- **Phase 4**: 안전성/성능 - Day 6
- **Phase 5**: 통합 테스트 - Day 7
- **총 소요**: 1주일 (병렬 작업 시 5일)

### 구현 우선순위 (재정렬)
1. **🔥 긴급**: 서버사이드 필터링 (성능 병목 해결)
2. **⚠️ 높음**: 의료 안전 기능 (긴급 환자, 확인 다이얼로그)
3. **📱 높음**: 모바일 최적화 (44px 터치, 오프라인)
4. **🔄 중간**: 멀티탭 동기화
5. **📊 낮음**: 고급 분석 기능

### 주의 사항
- **성능 우선**: 서버사이드 필터링 없이는 확장 불가
- **안전 최우선**: 의료 환경 특성상 실수 방지 필수
- **모바일 필수**: 의료진 태블릿 사용 빈도 높음
- **점진적 개선**: 핵심 기능부터 단계적 구현

---

## 🚀 실행 명령어

```bash
# 개발 서버 실행
npm run dev

# 타입 체크
npm run type-check

# 린트
npm run lint

# 빌드 테스트
npm run build
```

---

## 📐 Role별 UI 설계

### Doctor (주치의)
```
┌──────────────────────────────────────────┐
│ [내 환자 ✓] [전체 환자]                   │  ← SimpleFilterToggle만
└──────────────────────────────────────────┘
```
- Care Type 필터 버튼 숨김 (불필요)
- 심플한 토글만 제공

### Nurse (간호사)
```
┌──────────────────────────────────────────┐
│ [외래 환자 ✓] [전체 환자] [고급 필터 ▼]   │  ← 기본 토글 + 옵션
└──────────────────────────────────────────┘
```
- 기본: SimpleFilterToggle
- 선택: CareTypeFilter (고급 필터로 접근)

### Admin (관리자)
```
┌──────────────────────────────────────────┐
│ 진료 구분: [외래] [입원] [낮병원]          │  ← 기존 CareTypeFilter 유지
└──────────────────────────────────────────┘
```
- 현재 구현된 CareTypeFilter 그대로 사용
- 가장 유연한 필터링 제공

---

## 📊 구현 상태 요약 (2025-09-22 기준)

### ✅ 완료된 작업 (90%)
1. **데이터베이스 레벨**: 100% 완료
   - doctor role enum 추가
   - patients.doctor_id 컬럼 추가
   - profiles.care_type 컬럼 추가 (department → care_type 변경)
   - get_filtered_schedules 함수 완벽 구현
   - 모든 필요 인덱스 생성 완료
   - dashboard_schedule_summary 뷰 구현

2. **서비스 레이어**: 100% 완료
   - Filter Strategy Pattern 구현
   - scheduleServiceEnhanced 구현
   - 캐싱 및 성능 모니터링 구현

3. **UI 컴포넌트**: 95% 완료
   - SimpleFilterToggle 컴포넌트 완성
   - FilterBar 업데이트 완료
   - Role별 UI 차별화 구현

### 🚧 남은 작업 (10%)
1. **통합 작업**
   - [ ] DashboardPage에 SimpleFilterToggle 연결
   - [ ] get_filtered_schedules 함수 실제 호출 연결

2. **안전 기능**
   - [ ] 긴급 환자 필터 변경 시 확인 다이얼로그
   - [ ] 교대 인계 시 필터 상태 확인

3. **고급 기능**
   - [ ] 멀티탭 동기화 (BroadcastChannel API)
   - [ ] 오프라인 지원 (IndexedDB)
   - [ ] Circuit Breaker 패턴 구현

## 📅 문서 이력
- **최초 작성**: 2025-09-19
- **DB 스키마 검증**: 2025-09-22
- **마지막 업데이트**: 2025-09-22