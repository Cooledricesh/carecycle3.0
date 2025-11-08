# 기능: 관리자 이메일 초대 기능 구현

## 📋 개요
사용자가 시스템에 가입하기 전, 관리자가 이메일을 통해 조직에 초대하는 기능입니다. 초대받은 사용자는 링크를 통해 즉시 승인된 멤버로 가입할 수 있습니다.

## 🎯 비즈니스 가치
- **온보딩 효율화**: 관리자가 사전 승인한 사용자만 가입하여 승인 프로세스 간소화
- **보안 강화**: 무분별한 가입 방지 및 조직 멤버 관리 강화
- **사용자 경험 개선**: 초대받은 사용자는 별도 승인 대기 없이 즉시 시스템 사용 가능

## ✅ 인수 조건 (Acceptance Criteria)

### 관리자 기능
- [ ] 관리자는 사용자 관리 페이지에서 '사용자 초대' 버튼을 클릭할 수 있다
- [ ] 초대 모달에서 이메일 주소와 역할(admin, doctor, nurse)을 선택할 수 있다
- [ ] 이메일 형식 검증 및 중복 초대 방지 기능이 작동한다
- [ ] 초대 전송 시 성공/실패 피드백을 받는다
- [ ] 초대 목록 페이지에서 모든 초대 상태를 확인할 수 있다 (pending, accepted, expired)
- [ ] 대기 중인 초대를 취소할 수 있다

### 이메일 기능
- [ ] 초대받은 사용자는 고유한 토큰이 포함된 초대 링크를 이메일로 받는다
- [ ] 초대 이메일에는 조직명, 초대한 관리자 이름, 부여될 역할이 표시된다
- [ ] 초대 링크는 7일간 유효하며, 만료 시 새로 초대해야 한다

### 가입 프로세스
- [ ] 초대 링크를 클릭하면 자동으로 가입 페이지로 이동한다
- [ ] 가입 폼에는 초대받은 이메일과 역할이 미리 입력되어 있다
- [ ] 비밀번호 설정 후 가입하면 `approval_status`가 `approved`로 설정된다
- [ ] 가입 완료 즉시 조직의 멤버로 활성화되어 로그인 가능하다
- [ ] 초대 토큰은 1회 사용 후 무효화된다

### 보안 요구사항
- [ ] 초대 토큰은 암호화되어 저장되며 추측 불가능해야 한다
- [ ] 만료된 초대 링크는 사용할 수 없다
- [ ] 이미 가입된 이메일로는 초대를 보낼 수 없다
- [ ] 초대는 반드시 해당 조직의 관리자만 발송할 수 있다

## 🔧 기술 구현 요구사항

### 데이터베이스
- `invitations` 테이블 활용 (이미 생성됨)
  - `id`: UUID, Primary Key
  - `organization_id`: 초대 조직
  - `email`: 초대받은 이메일
  - `role`: 부여될 역할
  - `token`: 고유 초대 토큰 (SHA-256 해시)
  - `invited_by`: 초대한 관리자 ID
  - `status`: 'pending' | 'accepted' | 'expired' | 'cancelled'
  - `expires_at`: 만료 시각 (생성 시각 + 7일)
  - `created_at`, `updated_at`

### API 엔드포인트
1. **POST /api/admin/invitations**
   - 새 초대 생성 및 이메일 전송
   - 권한: admin only
   - Body: `{ email, role }`

2. **GET /api/admin/invitations**
   - 조직의 모든 초대 목록 조회
   - 권한: admin only
   - Query: `?status=pending&page=1&limit=20`

3. **DELETE /api/admin/invitations/:id**
   - 초대 취소
   - 권한: admin only

4. **GET /api/auth/invitations/verify/:token**
   - 초대 토큰 검증
   - 권한: public
   - Returns: `{ valid: boolean, email, role, organizationName }`

5. **POST /api/auth/signup/with-invitation**
   - 초대 토큰으로 가입
   - 권한: public
   - Body: `{ token, password, name }`

### UI 컴포넌트
- `InviteUserButton`: 초대 버튼
- `InviteUserModal`: 초대 생성 모달
- `InvitationListPage`: 초대 목록 페이지
- `InvitationStatusBadge`: 상태 배지 컴포넌트
- `AcceptInvitationPage`: 초대 수락 페이지

### 이메일 템플릿
- Supabase Auth Email Template 또는 별도 이메일 서비스 활용
- 템플릿 변수: `organizationName`, `inviterName`, `role`, `invitationLink`, `expiresAt`

## 📊 테스트 시나리오

### Unit Tests
- [ ] 초대 생성 시 토큰 생성 및 만료 시각 설정 검증
- [ ] 중복 이메일 초대 방지 로직 테스트
- [ ] 토큰 검증 로직 (유효/만료/사용됨) 테스트
- [ ] 권한 검증 (admin만 초대 가능) 테스트

### Integration Tests
- [ ] 초대 생성 → 이메일 전송 → 토큰 검증 → 가입 전체 플로우 테스트
- [ ] 초대 취소 시 토큰 무효화 테스트
- [ ] 만료된 초대로 가입 시도 시 에러 발생 테스트

### E2E Tests
- [ ] 관리자가 초대 전송부터 사용자 가입까지 전체 시나리오 테스트
- [ ] 잘못된 토큰으로 가입 시도 시 에러 처리 테스트

## 📦 Dependencies
- 이메일 전송: Supabase Auth Email 또는 SendGrid/AWS SES
- 토큰 생성: `crypto` (Node.js built-in) 또는 `uuid`
- 폼 검증: `zod` (기존 프로젝트에서 사용 중)

## 🔄 마이그레이션 필요사항
- `invitations` 테이블에 RLS 정책 추가
  - `SELECT`: admin만 자기 조직 초대 조회 가능
  - `INSERT`: admin만 자기 조직에 초대 생성 가능
  - `UPDATE`: admin만 자기 조직 초대 취소 가능
  - `DELETE`: 금지 (soft delete로 status='cancelled' 사용)

## 📝 추가 고려사항
1. **알림**: 초대가 수락되면 관리자에게 알림
2. **재전송**: 초대 이메일 재전송 기능
3. **대량 초대**: CSV 파일로 여러 사용자 한 번에 초대
4. **감사 로그**: 초대 생성/취소/수락 이벤트를 `audit_logs`에 기록

## 🎨 UI/UX 참고사항
- 초대 상태별 색상 구분
  - `pending`: 노란색 (대기 중)
  - `accepted`: 초록색 (수락됨)
  - `expired`: 회색 (만료됨)
  - `cancelled`: 빨간색 (취소됨)
- 초대 만료까지 남은 시간 표시
- 초대받은 사용자를 위한 친근한 가입 페이지 디자인

## 🚀 우선순위
- **Priority**: Medium
- **Estimated Effort**: 5-8 days
- **Dependencies**: 이메일 서비스 설정 필요

## 📌 관련 이슈
- 사용자 승인 프로세스 개선
- 멀티테넌시 사용자 관리 강화
