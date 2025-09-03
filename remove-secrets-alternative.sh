#!/bin/bash

echo "🔒 Git filter-branch를 사용한 민감 데이터 제거"
echo "=============================================="
echo ""
echo "⚠️  이 작업은 Git 히스토리를 완전히 다시 작성합니다!"
echo ""

# Git filter-branch로 파일 제거
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch create-admin.js" \
  --prune-empty --tag-name-filter cat -- --all

# 정리
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ 완료! 이제 다음 명령을 실행하세요:"
echo ""
echo "git push origin --force --all"
echo "git push origin --force --tags"