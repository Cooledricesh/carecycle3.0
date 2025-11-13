# Pre-commit Hook 사용 가이드

## 📋 목차
1. [개요](#개요)
2. [설치 완료](#설치-완료)
3. [작동 방식](#작동-방식)
4. [사용 예시](#사용-예시)
5. [문제 해결](#문제-해결)

## 개요

이 프로젝트에는 코드 품질과 문서 일관성을 자동으로 유지하는 pre-commit hook이 설정되어 있습니다.

### 자동 실행 항목

**커밋 시 자동으로**:
1. ✅ 하드코딩된 API 키/시크릿 검사
2. ✅ API 라우트 변경 시 OpenAPI 명세 업데이트

## 설치 완료

다음 파일들이 설치되었습니다:

```
프로젝트/
├── .husky/
│   └── pre-commit          # Husky Git hook
├── scripts/
│   └── generate-openapi.sh # OpenAPI 자동 생성 스크립트
└── docs/
    └── openapi.yaml        # API 명세 파일 (자동 업데이트)
```

## 작동 방식

### 1단계: 시크릿 검사

커밋하려는 파일에서 하드코딩된 API 키를 검사합니다:

```bash
🔍 [1/2] Scanning for hardcoded API keys and secrets...

검사 대상:
- sb_secret_*
- sb_publishable_*
- JWT 토큰 (eyJhbGciOi...)
- 환경변수 직접 할당
```

**만약 발견되면**:
```bash
❌ BLOCKED: Found potential hardcoded secret in src/config.ts
   Pattern: sb_secret_[a-zA-Z0-9_]+

🚨 COMMIT BLOCKED: Hardcoded secrets detected!

Please remove all hardcoded API keys and use environment variables instead:
  ✅ process.env.NEXT_PUBLIC_SUPABASE_URL
  ✅ process.env.SUPABASE_SECRET_KEY
```

### 2단계: OpenAPI 명세 업데이트

API 라우트 파일이 변경되면 자동으로 OpenAPI 명세를 업데이트합니다:

```bash
📝 [2/2] Updating OpenAPI specification...

🔄 API route changes detected:
   • src/app/api/admin/delete-user/route.ts

Running OpenAPI generator...
🔍 Scanning API routes...
✓ Found 34 API route files

📝 Analyzing routes...
  ⚠ /admin/delete-user (missing @swagger comments)

✅ OpenAPI generation completed
```

## 사용 예시

### 예시 1: 일반 커밋 (API 변경 없음)

```bash
$ git add src/components/Button.tsx
$ git commit -m "feat: add new button component"

🚀 Pre-commit Hook: Running checks...
======================================

🔍 [1/2] Scanning for hardcoded API keys and secrets...
✅ No hardcoded secrets detected

📝 [2/2] Updating OpenAPI specification...
ℹ️  No API route changes detected, skipping OpenAPI update

======================================
✅ All pre-commit checks passed!
======================================

[main abc1234] feat: add new button component
 1 file changed, 50 insertions(+)
```

### 예시 2: API 라우트 변경

```bash
$ git add src/app/api/admin/delete-user/route.ts
$ git commit -m "refactor: simplify user deletion"

🚀 Pre-commit Hook: Running checks...
======================================

🔍 [1/2] Scanning for hardcoded API keys and secrets...
✅ No hardcoded secrets detected

📝 [2/2] Updating OpenAPI specification...

🔄 API route changes detected:
   • src/app/api/admin/delete-user/route.ts

Running OpenAPI generator...
🔍 Scanning API routes...
✓ Found 34 API route files

📝 Analyzing routes...
  ⚠ /admin/delete-user (missing @swagger comments)

✅ OpenAPI spec is up to date

======================================
✅ All pre-commit checks passed!
======================================

[main def5678] refactor: simplify user deletion
 2 files changed, 25 insertions(+), 10 deletions(-)
```

### 예시 3: 시크릿 감지 (커밋 차단)

```bash
$ git add src/config.ts
$ git commit -m "add: new config"

🚀 Pre-commit Hook: Running checks...
======================================

🔍 [1/2] Scanning for hardcoded API keys and secrets...
❌ BLOCKED: Found potential hardcoded secret in src/config.ts
   Pattern: sb_secret_[a-zA-Z0-9_]+

   15: const SECRET_KEY = 'sb_secret_test_abc123...'

🚨 COMMIT BLOCKED: Hardcoded secrets detected!

Please remove all hardcoded API keys and use environment variables instead:
  ✅ process.env.NEXT_PUBLIC_SUPABASE_URL
  ✅ process.env.SUPABASE_SECRET_KEY
  ✅ process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

If this is a false positive, you can skip this check with:
  git commit --no-verify
```

## 문제 해결

### Hook이 실행되지 않을 때

```bash
# Husky 재설치
npm install

# Hook 권한 확인
chmod +x .husky/pre-commit
chmod +x scripts/generate-openapi.sh
```

### False Positive (잘못된 시크릿 감지)

일시적으로 우회하려면:
```bash
git commit --no-verify -m "your message"
```

하지만 **실제 시크릿이 없는지 반드시 확인하세요!**

### OpenAPI 생성 실패

스크립트를 직접 실행해서 문제를 확인:
```bash
bash scripts/generate-openapi.sh
```

### Hook 비활성화 (권장하지 않음)

긴급 상황에서만:
```bash
# 임시 비활성화
mv .husky/pre-commit .husky/pre-commit.disabled

# 다시 활성화
mv .husky/pre-commit.disabled .husky/pre-commit
```

## OpenAPI 명세에 주석 추가하기 (향후)

현재는 수동으로 `docs/openapi.yaml`을 업데이트하지만, 향후에는 코드에 주석을 추가하여 자동 생성할 수 있습니다:

```typescript
// src/app/api/example/route.ts

/**
 * @swagger
 * /api/example:
 *   post:
 *     summary: Example endpoint
 *     tags: [Example]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(request: Request) {
  // 구현
}
```

## 팀 협업 가이드

### 새 팀원 온보딩

1. 저장소 클론 후:
```bash
npm install  # Husky 자동 설치됨
```

2. 첫 커밋 시도:
```bash
git add .
git commit -m "test: verify pre-commit hook"
# → Hook이 자동으로 실행됨
```

### CI/CD 설정

GitHub Actions에서도 같은 검사 실행:
```yaml
# .github/workflows/ci.yml
- name: Run pre-commit checks
  run: bash .husky/pre-commit
```

## 이점

### 자동화된 작업

| 작업 | Before | After |
|------|--------|-------|
| API 키 검사 | 수동 코드 리뷰 | 자동 차단 |
| OpenAPI 업데이트 | 커밋 후 별도 작업 | 자동 업데이트 |
| 문서 일관성 | 누락 가능 | 항상 최신 |

### 시간 절약

- 🚫 하드코딩 실수 방지 → 보안 사고 예방
- 📝 문서 자동 업데이트 → 수동 작업 불필요
- ✅ 커밋 시점에 검증 → 나중에 수정 불필요

## 관련 파일

- `.husky/pre-commit`: Git hook 메인 파일
- `scripts/generate-openapi.sh`: OpenAPI 생성 스크립트
- `docs/openapi.yaml`: API 명세 파일 (자동 업데이트 대상)
- `docs/openapi.yaml.backup`: 백업 파일 (생성 시점)

## 지원

문제가 있으면 다음을 확인하세요:
1. Node.js 버전 (>=18.0.0 권장)
2. Git 버전 (>=2.9.0 권장)
3. Bash 쉘 사용 가능 여부

---

**설치 완료 날짜**: 2025-11-13
**Husky 버전**: Latest
**관리자**: Claude
