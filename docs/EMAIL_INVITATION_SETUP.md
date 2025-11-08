# 이메일 자동 발송 초대 시스템 설정 가이드

**작성일**: 2025-01-08
**상태**: ✅ 구현 완료

---

## 📋 개요

관리자가 사용자 초대 시 **자동으로 이메일이 발송**되는 시스템입니다.

### 이전 프로세스:
```
관리자 초대 생성 → 링크 수동 복사 → 직접 전달
```

### 현재 프로세스:
```
관리자 초대 생성 → 시스템이 자동으로 이메일 발송 → 사용자가 이메일 받음 → 가입
```

---

## 🚀 빠른 시작

### 1. Resend 계정 생성

1. https://resend.com 접속
2. 무료 계정 가입
3. API Keys 메뉴에서 API Key 생성
4. API Key 복사 (한 번만 표시됨!)

### 2. 환경 변수 설정

`.env.local` 파일에 다음 추가:

```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# 발신 이메일 주소
# 테스트용: onboarding@resend.dev (Resend 제공)
# 프로덕션용: noreply@yourdomain.com (본인 도메인)
INVITATION_EMAIL_FROM=onboarding@resend.dev
```

### 3. 개발 서버 재시작

```bash
# 현재 서버 종료 (Ctrl+C)
npm run dev
```

---

## ✅ 설정 완료!

이제 관리자가 초대를 생성하면 자동으로 이메일이 발송됩니다.

---

## 🧪 테스트 방법

### 1. 초대 생성 테스트

1. `/admin/invitations` 페이지 접속
2. "사용자 초대" 버튼 클릭
3. 이메일 주소 입력 (본인 이메일)
4. 역할 선택
5. "초대 전송" 클릭

### 2. 이메일 확인

- **테스트 환경** (`onboarding@resend.dev` 사용 시):
  - Resend 대시보드의 "Emails" 탭에서 발송 내역 확인
  - 실제 이메일은 수신되지 않음 (테스트용)

- **프로덕션 환경** (본인 도메인 사용 시):
  - 입력한 이메일 주소로 실제 이메일 수신

### 3. 서버 로그 확인

초대 생성 시 콘솔에 다음 로그 출력:

```bash
# 성공
Invitation email sent successfully to: user@example.com

# 실패 (환경 변수 미설정)
Failed to send invitation email: RESEND_API_KEY is not configured
Invitation created successfully, but email was not sent. Admin can copy link manually.
```

---

## 📧 이메일 템플릿

### 템플릿 특징:
- 📱 반응형 디자인 (모바일/데스크톱)
- 🎨 그라디언트 디자인 (보라색 계열)
- 🔗 원클릭 초대 수락 버튼
- ⏰ 7일 만료 안내
- 🇰🇷 한글 지원

### 템플릿 커스터마이징

이메일 디자인을 수정하려면: `/src/lib/email.ts` 파일의 `html` 부분 수정

---

## 🔧 프로덕션 설정

### 1. 도메인 인증 (필수)

Resend에서 본인 도메인 인증:

1. Resend 대시보드 → "Domains" 메뉴
2. "Add Domain" 클릭
3. 도메인 입력 (예: `yourdomain.com`)
4. DNS 레코드 추가:
   - **SPF**: `v=spf1 include:amazonses.com ~all`
   - **DKIM**: Resend가 제공하는 값 추가
5. 인증 완료 후 환경 변수 수정:

```bash
INVITATION_EMAIL_FROM=noreply@yourdomain.com
```

### 2. 발송 제한

Resend 무료 플랜:
- **100건/일** 발송 가능
- 월 3,000건

더 많은 발송이 필요하면 유료 플랜 업그레이드.

### 3. 환경 변수 (프로덕션)

Vercel/배포 환경에 다음 환경 변수 추가:

```bash
RESEND_API_KEY=re_prod_xxxxxxxxxxxxxxxxxxxx
INVITATION_EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🛠️ 문제 해결

### 이메일이 발송되지 않음

**증상**: 초대는 생성되지만 이메일이 안 옴

**해결 방법**:

1. **환경 변수 확인**:
   ```bash
   # .env.local 파일 확인
   echo $RESEND_API_KEY
   echo $INVITATION_EMAIL_FROM
   ```

2. **서버 재시작**:
   ```bash
   # 환경 변수 변경 후 반드시 재시작
   npm run dev
   ```

3. **Resend 대시보드 확인**:
   - https://resend.com/emails 에서 발송 내역 확인
   - 에러 메시지 확인

4. **API Key 권한 확인**:
   - Resend에서 새 API Key 생성
   - "Full Access" 권한 확인

### 이메일이 스팸으로 분류됨

**해결 방법**:

1. 도메인 인증 완료 (SPF, DKIM)
2. 발신 이메일 주소를 본인 도메인으로 변경
3. 이메일 내용에 구독 취소 링크 추가 (선택)

### TypeScript 에러 발생

```bash
# 타입 체크
npx tsc --noEmit

# 에러가 있으면 src/lib/email.ts 파일 확인
```

---

## 📂 파일 구조

```
src/
├── lib/
│   └── email.ts                          # 이메일 발송 유틸리티
├── app/api/admin/invitations/
│   └── route.ts                          # 초대 API (이메일 발송 통합)
├── components/admin/
│   ├── InviteUserModal.tsx              # 초대 생성 폼
│   └── InvitationsPage.tsx              # 초대 관리 페이지
└── app/auth/accept-invitation/[token]/
    └── page.tsx                          # 초대 수락 페이지
```

---

## 🔄 폴백 메커니즘

이메일 발송이 실패해도 초대는 정상 생성됩니다.

**이유**:
- 환경 변수 미설정
- Resend API 오류
- 네트워크 문제

**동작**:
1. 초대 생성 → 성공
2. 이메일 발송 → 실패
3. 에러 로그 출력
4. 관리자는 **링크 복사 버튼**으로 수동 전달 가능

---

## 📊 모니터링

### Resend 대시보드

- **Emails**: 발송 내역
- **Analytics**: 오픈율, 클릭률
- **Logs**: 에러 로그

### 서버 로그

초대 생성 시 로그 확인:

```bash
# 성공
Invitation email sent successfully to: user@example.com

# 실패
Failed to send invitation email: <에러 메시지>
```

---

## 🎯 베스트 프랙티스

### 1. 테스트 환경

- `INVITATION_EMAIL_FROM=onboarding@resend.dev` 사용
- 실제 이메일 발송 안 됨 (Resend 대시보드에서만 확인)

### 2. 프로덕션 환경

- 도메인 인증 필수
- `INVITATION_EMAIL_FROM=noreply@yourdomain.com` 사용
- 발송 제한 모니터링

### 3. 보안

- `.env.local` 파일 절대 커밋 금지
- API Key 주기적 교체 권장
- 배포 환경에서 환경 변수 암호화

---

## 📝 변경 사항 요약

### 추가된 파일

1. `/src/lib/email.ts` - 이메일 발송 유틸리티
2. `/docs/EMAIL_INVITATION_SETUP.md` - 이 문서

### 수정된 파일

1. `/src/app/api/admin/invitations/route.ts` - 이메일 발송 로직 추가
2. `/.env.example` - Resend 환경 변수 예시 추가
3. `/package.json` - `resend` 패키지 추가

### 설치된 패키지

```bash
npm install resend
```

---

## 🎉 완료!

이제 초대 시스템이 자동으로 이메일을 발송합니다.

**질문이나 문제가 있으면**:
1. 서버 로그 확인
2. Resend 대시보드 확인
3. 이 문서의 "문제 해결" 섹션 참고

---

**마지막 업데이트**: 2025-01-08
