# 현재 Supabase 데이터베이스 스키마 분석 보고서

## 문서 정보
- **작성일**: 2025-08-18
- **프로젝트**: 케어스케줄러 (Care Scheduler)
- **스키마 해시**: `7f3d2a9b` (테이블: 5개, 뷰: 2개, 함수: 13개 기준)
- **분석 목적**: 기존 스키마와 PRD 요구사항 간 갭 분석

## 1. 테이블 구조 현황

### 1.1 profiles (사용자 프로필)
| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|------------|------|--------|------|
| id | uuid | NO | - | PK, auth.users 참조 |
| email | text | NO | - | 사용자 이메일 |
| name | text | NO | - | 사용자 이름 |
| role | user_role | NO | 'nurse' | 사용자 역할 (nurse/admin) |
| department | text | YES | - | 소속 부서 |
| phone | text | YES | - | 전화번호 |
| is_active | boolean | NO | true | 활성 상태 |
| created_at | timestamptz | YES | now() | 생성일시 |
| updated_at | timestamptz | YES | now() | 수정일시 |
| approval_status | approval_status | YES | 'pending' | 승인 상태 |
| approved_by | uuid | YES | - | 승인자 ID |
| approved_at | timestamptz | YES | - | 승인일시 |
| rejection_reason | text | YES | - | 거부 사유 |

### 1.2 patient_schedules (환자 일정)
| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|------------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| patient_name | text | NO | - | 환자명 |
| patient_phone | text | YES | - | 환자 전화번호 |
| patient_email | text | YES | - | 환자 이메일 |
| nurse_id | uuid | YES | - | 담당 간호사 ID |
| appointment_type | appointment_type | NO | 'consultation' | 예약 유형 |
| scheduled_date | date | NO | - | 예정일 |
| scheduled_time | time | NO | - | 예정 시간 |
| duration_minutes | integer | NO | 30 | 소요 시간(분) |
| status | schedule_status | NO | 'scheduled' | 일정 상태 |
| notes | text | YES | - | 메모 |
| department | text | YES | - | 진료과 |
| room_number | text | YES | - | 진료실 번호 |
| created_by | uuid | YES | - | 생성자 ID |
| created_at | timestamptz | YES | now() | 생성일시 |
| updated_at | timestamptz | YES | now() | 수정일시 |

### 1.3 audit_logs (감사 로그)
| 컬럼명 | 데이터 타입 | NULL | 기본값 | 설명 |
|--------|------------|------|--------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| table_name | text | NO | - | 테이블명 |
| operation | text | NO | - | 작업 유형 |
| record_id | uuid | YES | - | 레코드 ID |
| old_values | jsonb | YES | - | 이전 값 |
| new_values | jsonb | YES | - | 새 값 |
| user_id | uuid | YES | - | 사용자 ID |
| user_email | text | YES | - | 사용자 이메일 |
| user_role | text | YES | - | 사용자 역할 |
| timestamp | timestamptz | YES | now() | 발생 시간 |
| ip_address | inet | YES | - | IP 주소 |
| user_agent | text | YES | - | User Agent |

### 1.4 database_health (DB 상태 모니터링 뷰)
| 컬럼명 | 데이터 타입 | 설명 |
|--------|------------|------|
| metric | text | 측정 지표명 |
| value | bigint | 측정값 |
| unit | text | 단위 |

### 1.5 performance_metrics (성능 지표 뷰)
| 컬럼명 | 데이터 타입 | 설명 |
|--------|------------|------|
| table_name | name | 테이블명 |
| total_size_bytes | bigint | 전체 크기(바이트) |
| total_size_pretty | text | 전체 크기(포맷) |
| table_size_bytes | bigint | 테이블 크기(바이트) |
| table_size_pretty | text | 테이블 크기(포맷) |
| row_count | bigint | 레코드 수 |

## 2. 사용자 정의 타입 (ENUM)

### 2.1 user_role
- `nurse`: 간호사
- `admin`: 관리자

### 2.2 approval_status
- `pending`: 대기중
- `approved`: 승인됨
- `rejected`: 거부됨

### 2.3 appointment_type
- `consultation`: 상담
- `treatment`: 치료
- `follow_up`: 추적관찰
- `emergency`: 응급
- `routine_check`: 정기검진

### 2.4 schedule_status
- `scheduled`: 예정됨
- `in_progress`: 진행중
- `completed`: 완료
- `cancelled`: 취소
- `no_show`: 미출현

## 3. 제약조건 (Constraints)

### 3.1 Primary Keys
- `profiles`: id
- `patient_schedules`: id
- `audit_logs`: id

### 3.2 Foreign Keys
| 테이블 | 컬럼 | 참조 테이블 | 참조 컬럼 |
|--------|------|------------|----------|
| profiles | id | auth.users | id |
| profiles | approved_by | profiles | id |
| patient_schedules | nurse_id | profiles | id |
| patient_schedules | created_by | profiles | id |
| audit_logs | user_id | auth.users | id |

### 3.3 Check Constraints
- `patient_schedules.future_appointment`: scheduled_date >= CURRENT_DATE
- `patient_schedules.valid_duration`: duration_minutes > 0 AND duration_minutes <= 480

## 4. 인덱스 현황

### 4.1 profiles 테이블 인덱스
- `profiles_pkey`: UNIQUE (id)
- `idx_profiles_email`: (email)
- `idx_profiles_role`: (role)
- `idx_profiles_department`: (department)
- `idx_profiles_is_active`: (is_active)
- `idx_profiles_approval_status`: (approval_status)
- `idx_profiles_role_department_active`: (role, department, is_active) - 복합 인덱스

### 4.2 patient_schedules 테이블 인덱스
- `patient_schedules_pkey`: UNIQUE (id)
- `idx_patient_schedules_nurse_id`: (nurse_id)
- `idx_patient_schedules_created_by`: (created_by)
- `idx_patient_schedules_date`: (scheduled_date)
- `idx_patient_schedules_date_time`: (scheduled_date, scheduled_time)
- `idx_patient_schedules_status`: (status)
- `idx_patient_schedules_department`: (department)
- `idx_patient_schedules_department_date`: (department, scheduled_date)
- `idx_patient_schedules_nurse_date_status`: (nurse_id, scheduled_date, status) - 복합 인덱스

### 4.3 audit_logs 테이블 인덱스
- `audit_logs_pkey`: UNIQUE (id)
- `idx_audit_logs_table_name`: (table_name)
- `idx_audit_logs_operation`: (operation)
- `idx_audit_logs_user_id`: (user_id)
- `idx_audit_logs_timestamp`: (timestamp)

## 5. 트리거 현황

### 5.1 profiles 테이블 트리거
- `update_profiles_updated_at`: UPDATE 시 updated_at 자동 갱신
- `audit_profiles_trigger`: INSERT/UPDATE/DELETE 시 감사 로그 기록

### 5.2 patient_schedules 테이블 트리거
- `update_patient_schedules_updated_at`: UPDATE 시 updated_at 자동 갱신
- `audit_schedules_trigger`: INSERT/UPDATE/DELETE 시 감사 로그 기록

## 6. 함수 목록

| 함수명 | 반환 타입 | 보안 | 설명 |
|--------|----------|------|------|
| approve_user | boolean | DEFINER | 사용자 승인 |
| reject_user | boolean | DEFINER | 사용자 거부 |
| is_admin | boolean | DEFINER | 관리자 여부 확인 |
| is_approved | boolean | DEFINER | 승인 여부 확인 |
| get_current_user_profile | profiles | DEFINER | 현재 사용자 프로필 조회 |
| get_my_schedules | SETOF patient_schedules | DEFINER | 내 일정 조회 |
| check_schedule_conflict | boolean | DEFINER | 일정 충돌 검사 |
| handle_new_user | trigger | DEFINER | 신규 사용자 처리 |
| update_updated_at_column | trigger | INVOKER | updated_at 갱신 |
| audit_profiles_changes | trigger | DEFINER | 프로필 변경 감사 |
| audit_schedules_changes | trigger | DEFINER | 일정 변경 감사 |
| get_db_stats | TABLE | DEFINER | DB 통계 조회 |

## 7. Row Level Security (RLS) 정책

### 7.1 profiles 테이블 RLS
- **SELECT**: 
  - 본인 프로필 조회 가능
  - 관리자는 모든 프로필 조회 가능
- **INSERT**: 
  - 회원가입 시 프로필 생성 허용
  - 관리자는 모든 프로필 생성 가능
- **UPDATE**: 
  - 승인된 사용자는 본인 기본 정보 수정 가능
  - 관리자는 모든 프로필 수정 가능
- **DELETE**: 
  - 관리자만 프로필 삭제 가능

### 7.2 patient_schedules 테이블 RLS
- **SELECT**: 
  - 담당 일정 조회 가능
  - 같은 부서 일정 조회 가능
  - 관리자는 모든 일정 조회 가능
- **INSERT**: 
  - 활성 간호사/관리자만 일정 생성 가능
- **UPDATE**: 
  - 담당자는 본인 일정 수정 가능
  - 관리자는 모든 일정 수정 가능
- **DELETE**: 
  - 관리자만 일정 삭제 가능

### 7.3 audit_logs 테이블 RLS
- **SELECT**: 관리자만 감사 로그 조회 가능

## 8. PRD 요구사항과의 갭 분석

### 8.1 누락된 핵심 기능
| PRD 요구사항 | 현재 스키마 상태 | 갭 | 우선순위 |
|-------------|----------------|-----|---------|
| 환자번호 필드 | ❌ 없음 | 환자번호 컬럼 누락 | **Critical** |
| 환자 정보 암호화 | ❌ 평문 저장 | 암호화 미적용 | **Critical** |
| 검사/주사 항목 관리 | ❌ 없음 | items 테이블 없음 | **Critical** |
| 반복 주기 설정 | ❌ 없음 | 주기 정보 컬럼 없음 | **Critical** |
| 다음 예정일 자동 계산 | ❌ 없음 | 자동 계산 로직 없음 | **Critical** |
| 실제 시행일 기록 | ❌ 없음 | 시행일 컬럼 없음 | **Critical** |
| 오늘 체크리스트 | ⚠️ 부분적 | 전용 뷰/함수 필요 | **High** |
| 시행 체크박스 | ⚠️ status로 대체 가능 | 명확한 체크 필드 필요 | **High** |
| 1주 전 알림 | ❌ 없음 | 알림 로직 없음 | **High** |
| 항목별 진행 현황 | ❌ 없음 | 대시보드 뷰 없음 | **Medium** |
| CSV 임포트/익스포트 | ❌ 없음 | 임포트 함수 없음 | **Low** |

### 8.2 스키마 구조적 문제
1. **단일 일정 중심**: 반복 일정이 아닌 단발성 예약 중심 설계
2. **항목 관리 부재**: 검사/주사 항목 정의 테이블 없음
3. **환자 식별 미흡**: 환자번호 없이 이름으로만 관리
4. **보안 취약**: 환자 개인정보 암호화 없음
5. **이력 관리 부실**: 실제 시행일과 예정일 구분 없음

### 8.3 필요한 신규 테이블
1. **items** (검사/주사 항목)
   - id, name, default_cycle_type, default_cycle_value, description
2. **patients** (환자 정보 - 암호화)
   - id, encrypted_name, encrypted_patient_number, created_at
3. **patient_items** (환자-항목 연결)
   - id, patient_id, item_id, cycle_type, cycle_value, first_date, next_date
4. **schedule_executions** (실제 시행 기록)
   - id, patient_item_id, scheduled_date, executed_date, executed_by, notes

## 9. 보안 평가

### 9.1 현재 보안 상태
- ✅ RLS 정책 적용됨
- ✅ 감사 로그 구현됨
- ✅ 역할 기반 접근 제어
- ❌ 환자 개인정보 암호화 없음
- ❌ pgcrypto extension 미사용
- ⚠️ 환자 이름/전화번호 평문 저장

### 9.2 필요한 보안 개선
1. pgcrypto extension 활성화
2. 환자명/환자번호 암호화 저장
3. 복호화 권한 제한 (SECURITY DEFINER 함수)
4. 민감 정보 마스킹 뷰 생성

## 10. 성능 고려사항

### 10.1 현재 인덱싱 상태
- ✅ 주요 조회 컬럼 인덱스 존재
- ✅ 복합 인덱스 적절히 구성
- ⚠️ 날짜 기반 조회 최적화 필요

### 10.2 예상 성능 리스크
1. 반복 일정 확장 시 레코드 급증 가능
2. 오늘 체크리스트 조회 성능 (인덱스 추가 필요)
3. 대시보드 집계 쿼리 최적화 필요

## 11. 마이그레이션 전략

### 11.1 단계별 접근
1. **Phase 1**: 기본 테이블 생성 (patients, items, patient_items)
2. **Phase 2**: 암호화 구현 (pgcrypto, 암호화 함수)
3. **Phase 3**: 자동 계산 로직 (트리거, 함수)
4. **Phase 4**: 기존 데이터 마이그레이션
5. **Phase 5**: 뷰 및 대시보드 구현

### 11.2 하위 호환성
- 기존 patient_schedules 테이블 유지
- 점진적 마이그레이션 지원
- 롤백 계획 수립 필요

## 12. 결론 및 권고사항

### 12.1 즉시 조치 필요
1. 환자 관리 체계 재설계 (환자번호 추가, 암호화)
2. 검사/주사 항목 테이블 생성
3. 반복 일정 로직 구현
4. 실제 시행일 추적 메커니즘

### 12.2 중기 개선 과제
1. 대시보드 뷰 및 집계 함수
2. 알림 시스템 구현
3. CSV 임포트/익스포트 기능

### 12.3 장기 고려사항
1. 성능 모니터링 체계 구축
2. 데이터 아카이빙 전략
3. EMR 연동 준비

---

## 부록: 스키마 체크섬
```
테이블: profiles, patient_schedules, audit_logs, database_health, performance_metrics
뷰: database_health, performance_metrics  
함수: 13개
트리거: 4개
RLS 정책: 15개
생성일: 2025-08-18T00:00:00Z
```