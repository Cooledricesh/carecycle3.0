# Scripts 디렉토리

이 디렉토리에는 프로젝트의 자동화 스크립트가 포함되어 있습니다.

## 📁 스크립트 목록

### generate-openapi.sh
**용도**: OpenAPI 명세 자동 업데이트

**실행 방법**:
```bash
bash scripts/generate-openapi.sh
```

**작동 방식**:
1. `src/app/api` 디렉토리의 모든 API 라우트 스캔
2. 각 라우트에 `@swagger` 주석이 있는지 확인
3. `docs/openapi.yaml` 파일 분석
4. 변경사항 감지 시 자동 업데이트

**사용 시나리오**:
- Git pre-commit hook에서 자동 실행
- 수동으로 OpenAPI 명세 확인 시
- CI/CD 파이프라인에서 검증 시

**출력 예시**:
```bash
🔄 OpenAPI Auto-Generator
========================

📦 Creating backup...
✓ Backup created: docs/openapi.yaml.backup

🔍 Scanning API routes...
✓ Found 34 API route files

📝 Analyzing routes...
  ⚠ /admin/delete-user (missing @swagger comments)
  ⚠ /admin/users/update (missing @swagger comments)

📊 Summary:
  Total routes: 34
  Documented: 0
  Missing docs: 34

✅ OpenAPI generation completed
```

### monitor-performance.sh
**용도**: Supabase 데이터베이스 성능 모니터링

**실행 방법**:
```bash
bash scripts/monitor-performance.sh
```

**기능**:
- 데이터베이스 크기 확인
- 활성 연결 수 모니터링
- 인덱스 사용률 분석
- RLS 함수 성능 측정
- VACUUM 필요 테이블 감지

**출력 예시**:
```bash
🔍 Supabase Performance Monitor
================================

📊 Database Health Summary
------------------------
📊 Database Size: 245 MB
🔌 Active Connections: 12
🧹 Tables Needing VACUUM: 0
📈 New Indexes Usage: ✅ Active

📈 New Index Usage
------------------------
  idx_invitations_invited_by: 1543 scans - High Usage
  idx_patient_schedules_created_by: 892 scans - High Usage
  idx_patient_schedules_nurse_id: 2341 scans - High Usage

⚡ RLS Helper Function Performance
------------------------
  is_user_active_and_approved: 45231 calls, 0.0234ms avg
  is_clinical_staff: 12543 calls, 0.0198ms avg
  has_role: 8765 calls, 0.0156ms avg

✅ Monitoring complete!
```

## 🔧 스크립트 추가 가이드

새로운 스크립트를 추가할 때:

1. **실행 권한 부여**:
```bash
chmod +x scripts/your-script.sh
```

2. **Shebang 추가**:
```bash
#!/bin/bash
set -e  # 에러 발생 시 즉시 종료
```

3. **명확한 출력**:
```bash
echo "🔍 작업 시작..."
echo "✅ 작업 완료"
echo "❌ 에러 발생"
```

4. **에러 처리**:
```bash
if [ $? -ne 0 ]; then
  echo "❌ 작업 실패"
  exit 1
fi
```

5. **문서화**:
- 스크립트 상단에 주석으로 용도 설명
- 이 README에 사용법 추가

## 📋 권장 스크립트 구조

```bash
#!/bin/bash
# Script Purpose: 간단한 설명
# Usage: ./scripts/script-name.sh [options]
# Requirements: 필요한 도구 (예: supabase CLI)

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONFIG_VAR="value"

# Functions
function main() {
  echo "🚀 Starting..."

  # 작업 수행

  echo -e "${GREEN}✅ Completed${NC}"
}

# Run main function
main "$@"
```

## 🔒 보안 주의사항

**절대 하지 말 것**:
- ❌ API 키나 시크릿 하드코딩
- ❌ 환경변수를 스크립트에 직접 저장
- ❌ 민감한 로그 출력

**올바른 방법**:
- ✅ 환경변수 사용: `${SUPABASE_SECRET_KEY}`
- ✅ `.env` 파일 참조
- ✅ 민감 정보는 마스킹 처리

## 🤝 기여 가이드

새 스크립트를 추가하거나 수정할 때:

1. 테스트 후 커밋
2. README 업데이트
3. Pre-commit hook 통과 확인

---

**마지막 업데이트**: 2025-11-13
