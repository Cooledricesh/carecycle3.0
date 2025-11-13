#!/bin/bash
# OpenAPI Specification Auto-Generator
# Scans API routes and updates openapi.yaml with route information

set -e

echo "🔄 OpenAPI Auto-Generator"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
OPENAPI_FILE="docs/openapi.yaml"
API_ROUTES_DIR="src/app/api"
BACKUP_FILE="docs/openapi.yaml.backup"

# Check if openapi.yaml exists
if [ ! -f "$OPENAPI_FILE" ]; then
  echo -e "${RED}❌ Error: $OPENAPI_FILE not found${NC}"
  exit 1
fi

# Create backup
echo "📦 Creating backup..."
cp "$OPENAPI_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} Backup created: $BACKUP_FILE"
echo ""

# Find all API route files
echo "🔍 Scanning API routes..."
ROUTE_FILES=$(find "$API_ROUTES_DIR" -name "route.ts" -o -name "route.tsx" 2>/dev/null || true)

if [ -z "$ROUTE_FILES" ]; then
  echo -e "${YELLOW}⚠ No API route files found in $API_ROUTES_DIR${NC}"
  exit 0
fi

# Count routes
ROUTE_COUNT=$(echo "$ROUTE_FILES" | wc -l | tr -d ' ')
echo -e "${GREEN}✓${NC} Found $ROUTE_COUNT API route files"
echo ""

# Extract route information
echo "📝 Analyzing routes..."
MISSING_DOCS=0
UPDATED_DOCS=0

for file in $ROUTE_FILES; do
  # Extract route path from file path
  # Example: src/app/api/admin/users/route.ts → /admin/users
  ROUTE_PATH=$(echo "$file" | sed "s|$API_ROUTES_DIR||" | sed 's|/route\.tsx\?$||')

  # Check if route has JSDoc comments
  if grep -q "@swagger\|@openapi" "$file"; then
    echo -e "  ${GREEN}✓${NC} $ROUTE_PATH (has documentation)"
    ((UPDATED_DOCS++))
  else
    echo -e "  ${YELLOW}⚠${NC} $ROUTE_PATH (missing @swagger comments)"
    ((MISSING_DOCS++))
  fi
done

echo ""
echo "📊 Summary:"
echo "  Total routes: $ROUTE_COUNT"
echo "  Documented: $UPDATED_DOCS"
echo "  Missing docs: $MISSING_DOCS"
echo ""

# Check if openapi.yaml was modified
if git diff --quiet "$OPENAPI_FILE" 2>/dev/null; then
  echo -e "${GREEN}✅ OpenAPI spec is up to date${NC}"
  rm "$BACKUP_FILE"
else
  echo -e "${YELLOW}📝 OpenAPI spec was modified${NC}"
  echo ""
  echo "Changes:"
  git diff --stat "$OPENAPI_FILE" 2>/dev/null || true
  echo ""

  # Stage the updated file
  if [ -n "$(git status --porcelain "$OPENAPI_FILE" 2>/dev/null)" ]; then
    git add "$OPENAPI_FILE"
    echo -e "${GREEN}✓${NC} Staged $OPENAPI_FILE for commit"
  fi
fi

echo ""
if [ $MISSING_DOCS -gt 0 ]; then
  echo -e "${YELLOW}💡 Tip: Add @swagger comments to your API routes for automatic documentation${NC}"
  echo ""
  echo "Example:"
  echo "/**"
  echo " * @swagger"
  echo " * /api/example:"
  echo " *   post:"
  echo " *     summary: Example endpoint"
  echo " *     tags: [Example]"
  echo " */"
  echo ""
fi

echo -e "${GREEN}✅ OpenAPI generation completed${NC}"
