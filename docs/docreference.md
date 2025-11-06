# 📚 문서 참조 가이드 및 CLAUDE.md 분석

## 목차
1. [정리된 문서들의 참조 시나리오](#1️⃣-정리된-문서들의-참조-시나리오)
2. [CLAUDE.md에서 참조하는 문서들](#2️⃣-claudemd에서-참조하는-문서들)
3. [기능 추가/코드베이스 개선 시 참조 순서](#3️⃣-기능-추가코드베이스-개선-시-참조-순서)
4. [CLAUDE.md의 핵심 금지사항](#4️⃣-claudemd의-핵심-금지사항-자주-실수하는-것들)
5. [추천 워크플로우](#5️⃣-추천-워크플로우)

---

## 1️⃣ 정리된 문서들의 참조 시나리오

### `docs/api/API-REFERENCE.md`
**언제 참조하나:**
- ✅ 새로운 API 엔드포인트 추가할 때
- ✅ 기존 API 수정할 때 (권한, 에러 코드 확인)
- ✅ Role-based 권한 체계 확인이 필요할 때
- ✅ RLS 에러 처리 방법 확인할 때
- ✅ 데이터베이스 스키마 변경 시 API 영향 확인

**주요 내용:**
- 완전한 API 명세 (v1.2.0)
- 인증 시스템 설명
- 에러 코드 목록 (42501, ROLE_RESTRICTED 등)
- 각 엔드포인트별 권한 매트릭스
- Change Log (버전별 변경사항)

### `docs/api/API-QUICKSTART.md`
**언제 참조하나:**
- ✅ 프로젝트 처음 셋업할 때
- ✅ API 테스트 빠르게 해야 할 때
- ✅ 환경변수 설정 확인
- ✅ 간단한 curl 명령어 필요할 때

**주요 내용:**
- 5분 안에 시작하기
- 환경변수 설정 (.env.local)
- 빠른 인증 예제
- 기본 curl 명령어

### `docs/code-quality/LINT_AND_TYPE_ENFORCEMENT.md`
**언제 참조하나:**
- ✅ 코드 작업 시작 전 (baseline 생성)
- ✅ Lint/TypeScript 에러 발생 시
- ✅ PR 제출 전 체크리스트 확인
- ✅ 에러 분류 기준 확인 (MUST FIX/SHOULD FIX/CAN DEFER)
- ✅ 팀 코드 품질 정책 확인

**주요 내용:**
- Zero Tolerance 정책
- 에러 분류 시스템 (Category A/B/C)
- 필수 체크리스트
- Emergency procedures

### `docs/code-quality/QUICK_REFERENCE_ERROR_CHECKS.md`
**언제 참조하나:**
- ✅ 개발 중 빠른 명령어 복사/붙여넣기
- ✅ 에러 체크 명령어 빠르게 찾을 때
- ✅ 프린트해서 모니터 옆에 붙여놓기

**주요 내용:**
- Copy-paste 가능한 명령어
- 에러 카테고리 빠른 참조
- Success/Fail 기준

---

## 2️⃣ CLAUDE.md에서 참조하는 문서들

### 직접 참조되는 문서:

1. **`/docs/code-quality/LINT_AND_TYPE_ENFORCEMENT.md`** (Line 180)
   ```markdown
   **참조**: 전체 가이드는 `/docs/code-quality/LINT_AND_TYPE_ENFORCEMENT.md` 확인
   ```
   - **컨텍스트**: Code Quality Enforcement 섹션에서 참조
   - **목적**: Lint와 TypeScript 에러 무시 금지 정책 상세 설명

2. **`/SUPABASE_NEW_API_KEYS_REFERENCE.md`** (간접 참조)
   - Supabase 새 API 키 시스템 마이그레이션 가이드

3. **`/emergency-security-measures.md`** (간접 참조)
   - 보안 사고 대응 절차

### CLAUDE.md의 주요 지침과 관련 문서 매핑:

| CLAUDE.md 섹션 | 관련 문서 | 언제 참조하나 |
|---------------|-----------|-------------|
| **🚨 개발 서버 실행 전 필수 체크** | - | 포트 3000 체크 (npm run dev 전) |
| **React Key Prop Error Prevention** | - | React 컴포넌트 작업 시 |
| **SNAKE_CASE 명명 규칙** | API-REFERENCE.md | API 응답/요청 필드명 확인 |
| **주치의 컬럼 권한 정책** | API-REFERENCE.md (Line 191-197) | PatientDoctorSelect 권한 확인 |
| **API 키 하드코딩 금지** | API-QUICKSTART.md | 환경변수 설정 확인 |
| **Code Quality Enforcement** | LINT_AND_TYPE_ENFORCEMENT.md | 모든 코드 작업 시 |
| **테스트 환자 데이터 제한** | - | 테스트 쿼리 작성 시 |
| **Playwright MCP 사용법** | - | E2E 테스트 작성 시 |

---

## 3️⃣ 기능 추가/코드베이스 개선 시 참조 순서

### 새 기능 추가 시:
```
1. CLAUDE.md (프로젝트 특수 규칙 확인)
   ↓
2. API-REFERENCE.md (기존 API 구조 파악)
   ↓
3. LINT_AND_TYPE_ENFORCEMENT.md (코드 품질 기준)
   ↓
4. 개발 중: QUICK_REFERENCE_ERROR_CHECKS.md (명령어)
   ↓
5. 테스트: API-QUICKSTART.md (빠른 테스트)
```

### 버그 수정 시:
```
1. CLAUDE.md (특히 snake_case, 권한 정책)
   ↓
2. API-REFERENCE.md (에러 코드, RLS 처리)
   ↓
3. QUICK_REFERENCE_ERROR_CHECKS.md (baseline 생성)
```

### 코드 리팩토링 시:
```
1. LINT_AND_TYPE_ENFORCEMENT.md (전체 정책)
   ↓
2. CLAUDE.md (프로젝트 특수 규칙)
   ↓
3. QUICK_REFERENCE_ERROR_CHECKS.md (검증 명령어)
```

---

## 4️⃣ CLAUDE.md의 핵심 금지사항 (자주 실수하는 것들)

1. **🚫 포트 체크 없이 npm run dev**
   - 항상: `lsof -i :3000` 먼저

2. **🚫 camelCase 사용**
   - 모든 데이터 필드는 snake_case
   - 예: `patient_name` (O), `patientName` (X)

3. **🚫 주치의 컬럼 admin-only 제한**
   - admin, doctor, nurse 모두 볼 수 있어야 함

4. **🚫 환경변수 하드코딩**
   - 절대 키를 코드에 직접 입력 금지

5. **🚫 "관련 없는 에러" 무시**
   - 모든 에러는 수정하거나 문서화

6. **🚫 실제 환자 데이터 테스트**
   - 오직 '테스트', '테스트투', '테스트환자'만 사용

7. **🚫 Playwright browser_close 없이 navigate**
   - about:blank 창 100개 생성 방지

---

## 5️⃣ 추천 워크플로우

### 일일 개발 시작 시:
1. QUICK_REFERENCE_ERROR_CHECKS.md 열어놓기 (프린트 권장)
2. `.errors-baseline.txt` 생성
3. CLAUDE.md 빠르게 훑어보기 (특히 금지사항)

### PR 제출 전:
1. LINT_AND_TYPE_ENFORCEMENT.md의 체크리스트 확인
2. CLAUDE.md의 Code Quality 섹션 재확인
3. git commit 메시지 컨벤션 확인

### API 작업 시:
1. API-REFERENCE.md에서 기존 패턴 확인
2. 권한 매트릭스 확인 (특히 doctorId 필드)
3. snake_case 일관성 유지

### 디버깅 시:
1. API-REFERENCE.md의 에러 코드 섹션
2. CLAUDE.md의 관련 금지사항 체크
3. API-QUICKSTART.md로 빠른 테스트

---

## 📊 문서 구조 개요

```
docs/
├── api/
│   ├── API-REFERENCE.md         # 완전한 API 명세
│   └── API-QUICKSTART.md        # 빠른 시작 가이드
├── code-quality/
│   ├── LINT_AND_TYPE_ENFORCEMENT.md  # 코드 품질 정책
│   └── QUICK_REFERENCE_ERROR_CHECKS.md # 빠른 참조 명령어
└── docreference.md               # 이 문서 (참조 가이드)

CLAUDE.md                         # 프로젝트 특수 규칙 (루트)
```

---

*Last Updated: November 2025*