# 목표 데이터베이스 ERD (Entity Relationship Diagram)

## 전체 스키마 ERD

```mermaid
erDiagram
    patients ||--o{ schedules : "has"
    items ||--o{ schedules : "scheduled_for"
    schedules ||--o{ schedule_executions : "tracks"
    schedules ||--o{ notifications : "triggers"
    schedules ||--o{ schedule_logs : "logs"
    schedule_executions ||--o{ notifications : "may_trigger"
    profiles ||--o{ patients : "created"
    profiles ||--o{ schedules : "assigned_to"
    profiles ||--o{ schedules : "created"
    profiles ||--o{ schedule_executions : "executed"
    profiles ||--o{ notifications : "receives"
    profiles ||--o{ schedule_logs : "changed"

    patients {
        uuid id PK "gen_random_uuid()"
        uuid hospital_id FK "멀티테넌시"
        bytea patient_number_encrypted "암호화된 환자번호"
        bytea name_encrypted "암호화된 환자명"
        tsvector name_search "검색용 인덱스"
        text department "부서"
        boolean is_active "활성상태"
        jsonb metadata "메타데이터"
        uuid created_by FK "생성자"
        timestamptz created_at "생성일시"
        timestamptz updated_at "수정일시"
    }

    items {
        uuid id PK "gen_random_uuid()"
        text code UK "항목코드"
        text name "항목명"
        text category "카테고리"
        cadence_type default_cadence_type "기본주기타입"
        integer default_interval "기본주기값"
        text description "설명"
        text instructions "지침"
        text preparation_notes "준비사항"
        boolean is_active "활성상태"
        integer sort_order "정렬순서"
        jsonb metadata "메타데이터"
        timestamptz created_at "생성일시"
        timestamptz updated_at "수정일시"
    }

    schedules {
        uuid id PK "gen_random_uuid()"
        uuid patient_id FK "환자ID"
        uuid item_id FK "항목ID"
        cadence_type cadence_type "반복주기타입"
        integer interval_value "주기값"
        integer_array custom_days "커스텀요일"
        date start_date "시작일"
        date end_date "종료일"
        date last_executed_date "마지막시행일"
        date next_due_date "다음예정일"
        schedule_status status "일정상태"
        uuid assigned_nurse_id FK "담당간호사"
        text notes "메모"
        integer priority "우선순위"
        integer alert_days_before "알림일수"
        uuid created_by FK "생성자"
        timestamptz created_at "생성일시"
        timestamptz updated_at "수정일시"
    }

    schedule_executions {
        uuid id PK "gen_random_uuid()"
        uuid schedule_id FK "일정ID"
        date planned_date "계획일"
        date executed_date "실행일"
        time executed_time "실행시간"
        execution_status status "실행상태"
        uuid executed_by FK "실행자"
        text notes "메모"
        text skipped_reason "스킵사유"
        boolean is_rescheduled "재일정여부"
        date original_date "원래예정일"
        timestamptz created_at "생성일시"
        timestamptz updated_at "수정일시"
    }

    notifications {
        uuid id PK "gen_random_uuid()"
        uuid schedule_id FK "일정ID"
        uuid execution_id FK "실행ID"
        uuid recipient_id FK "수신자"
        notification_channel channel "알림채널"
        date notify_date "알림일"
        time notify_time "알림시간"
        notification_state state "알림상태"
        text title "제목"
        text message "내용"
        jsonb metadata "메타데이터"
        timestamptz sent_at "발송시간"
        text error_message "오류메시지"
        timestamptz created_at "생성일시"
        timestamptz updated_at "수정일시"
    }

    schedule_logs {
        uuid id PK "gen_random_uuid()"
        uuid schedule_id FK "일정ID"
        text action "작업유형"
        jsonb old_values "이전값"
        jsonb new_values "새값"
        uuid changed_by FK "변경자"
        timestamptz changed_at "변경일시"
        text reason "변경사유"
    }

    profiles {
        uuid id PK "auth.users참조"
        text email "이메일"
        text name "이름"
        user_role role "역할"
        text department "부서"
        text phone "전화번호"
        boolean is_active "활성상태"
        timestamptz created_at "생성일시"
        timestamptz updated_at "수정일시"
    }
```

## 핵심 관계 설명

### 1. 환자-일정 관계 (patients ↔ schedules)
- **관계**: 1:N (One-to-Many)
- **설명**: 한 환자는 여러 반복 일정을 가질 수 있음
- **특징**: 각 일정은 하나의 검사/주사 항목과 연결됨

### 2. 항목-일정 관계 (items ↔ schedules)
- **관계**: 1:N (One-to-Many)
- **설명**: 하나의 검사/주사 항목이 여러 환자 일정에 사용됨
- **특징**: 항목별 기본 주기 설정 제공

### 3. 일정-실행 관계 (schedules ↔ schedule_executions)
- **관계**: 1:N (One-to-Many)
- **설명**: 하나의 반복 일정에 대해 여러 실행 기록 존재
- **특징**: 계획일과 실제 실행일 분리 관리

### 4. 일정-알림 관계 (schedules ↔ notifications)
- **관계**: 1:N (One-to-Many)
- **설명**: 하나의 일정에 대해 여러 알림 생성 가능
- **특징**: 예정일 N일 전 자동 알림 생성

### 5. 프로필-일정 관계 (profiles ↔ schedules)
- **관계**: 1:N (One-to-Many)
- **설명**: 간호사가 여러 일정을 담당/생성
- **특징**: 담당자와 생성자 구분

## 데이터 플로우

```mermaid
flowchart TD
    A[환자 등록] --> B[환자 정보 암호화]
    B --> C[patients 테이블 저장]
    
    D[항목 등록] --> E[items 테이블 저장]
    
    C --> F[일정 생성]
    E --> F
    F --> G[schedules 테이블 저장]
    
    G --> H[첫 실행 계획 생성]
    H --> I[schedule_executions 테이블]
    
    G --> J[알림 생성]
    J --> K[notifications 테이블]
    
    I --> L{실행 완료?}
    L -->|Yes| M[다음 예정일 계산]
    M --> N[schedules.next_due_date 업데이트]
    N --> O[새 실행 계획 생성]
    O --> I
    
    L -->|No| P[오늘 체크리스트 표시]
```

## 보안 아키텍처

```mermaid
flowchart LR
    A[클라이언트] --> B[API Gateway]
    B --> C{RLS 정책}
    C -->|권한 확인| D[데이터베이스]
    
    D --> E[암호화된 데이터]
    E --> F[복호화 함수]
    F --> G[SECURITY DEFINER]
    G --> H[보안 뷰]
    H --> B
    
    style E fill:#ff9999
    style F fill:#99ccff
    style G fill:#99ff99
```

## 자동화 프로세스

```mermaid
sequenceDiagram
    participant User
    participant App
    participant DB
    participant Trigger
    participant Function

    User->>App: 일정 실행 완료
    App->>DB: UPDATE schedule_executions
    DB->>Trigger: AFTER UPDATE 트리거 발동
    Trigger->>Function: calculate_next_due_date()
    Function-->>DB: 다음 예정일 반환
    DB->>DB: UPDATE schedules.next_due_date
    DB->>DB: INSERT schedule_executions (다음 계획)
    DB->>Trigger: 알림 트리거 발동
    Trigger->>DB: INSERT notifications
    DB-->>App: 완료
    App-->>User: 다음 일정 표시
```

## 인덱스 전략

### 주요 조회 패턴
1. **오늘 체크리스트**: `schedule_executions.planned_date = CURRENT_DATE`
2. **환자별 일정**: `schedules.patient_id = ?`
3. **다가오는 일정**: `schedules.next_due_date BETWEEN ? AND ?`
4. **담당 간호사 일정**: `schedules.assigned_nurse_id = ?`

### 복합 인덱스
- `(patient_id, next_due_date, status)`: 환자별 활성 일정 조회
- `(planned_date, status)`: 날짜별 실행 계획 조회

## 확장 포인트

### 1. 멀티테넌시
- `hospital_id` 필드 활용
- RLS 정책에 병원 ID 조건 추가
- 병원별 데이터 완전 격리

### 2. CSV 임포트
- `import_patients_csv()` 함수 구현
- 대량 데이터 처리 최적화
- 오류 처리 및 롤백

### 3. 알림 시스템
- Push 알림 연동
- 이메일 발송 연동
- 알림 템플릿 관리

### 4. 감사 로그
- 모든 변경사항 추적
- 규정 준수 보고서
- 접근 기록 관리

---

*생성일: 2025-08-18*
*프로젝트: 케어스케줄러*