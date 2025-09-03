#!/bin/bash

echo "🔒 Git 히스토리에서 민감한 데이터 제거 스크립트"
echo "================================================"
echo ""
echo "⚠️  경고: 이 작업은 Git 히스토리를 다시 작성합니다!"
echo "실행 전에 백업을 만드는 것을 권장합니다."
echo ""
read -p "계속하시겠습니까? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "작업 취소됨"
    exit 1
fi

# BFG 설치 확인
if ! command -v bfg &> /dev/null; then
    echo "BFG를 설치합니다..."
    if command -v brew &> /dev/null; then
        brew install bfg
    else
        echo "❌ BFG가 설치되어 있지 않습니다. 다음 명령으로 설치하세요:"
        echo "brew install bfg"
        echo "또는"
        echo "wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
        exit 1
    fi
fi

# 리포지토리 백업
echo "📦 리포지토리 백업 중..."
cp -r .git .git.backup

# BFG로 파일 제거
echo "🗑️  create-admin.js 파일을 히스토리에서 제거 중..."
bfg --delete-files create-admin.js --no-blob-protection

# Git 정리
echo "🧹 Git 정리 중..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ 로컬 히스토리 정리 완료!"
echo ""
echo "⚠️  다음 단계:"
echo "1. 변경사항 확인: git log --all --full-history"
echo "2. 강제 푸시 실행: git push --force-with-lease origin --all"
echo "3. GitHub에서 캐시 정리 요청:"
echo "   https://github.com/YOUR_USERNAME/YOUR_REPO/settings"
echo "   → 'Danger Zone' → 'Contact GitHub Support'"
echo ""
echo "📝 팀원들에게 알림:"
echo "   모든 팀원은 다음 명령을 실행해야 합니다:"
echo "   git fetch --all"
echo "   git reset --hard origin/main"