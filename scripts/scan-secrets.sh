#!/bin/bash

echo "🔍 Security Scan: Searching for hardcoded secrets in the entire project..."
echo ""

PATTERNS=(
  'sb_secret_[a-zA-Z0-9_]+'
  'sb_publishable_[a-zA-Z0-9_]+'
  'eyJhbGci[A-Za-z0-9+/=]+'
)

EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  ".next"
  "dist"
  "build"
  ".turbo"
  ".swc"
)

EXCLUDE_FILES=(
  "*.md"
  "*.log"
  "*.lock"
  "package-lock.json"
  "yarn.lock"
)

EXCLUDE_ARGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$dir"
done

for file in "${EXCLUDE_FILES[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$file"
done

FOUND_ISSUES=0

for pattern in "${PATTERNS[@]}"; do
  echo "🔎 Searching for pattern: $pattern"

  RESULTS=$(grep -r -n -E "$pattern" . $EXCLUDE_ARGS 2>/dev/null)

  if [ ! -z "$RESULTS" ]; then
    echo "❌ FOUND:"
    echo "$RESULTS"
    echo ""
    FOUND_ISSUES=1
  else
    echo "✅ Clean"
    echo ""
  fi
done

if [ $FOUND_ISSUES -eq 1 ]; then
  echo "🚨 Security issues detected! Please review and fix."
  exit 1
else
  echo "✅ No hardcoded secrets found in the project"
  exit 0
fi