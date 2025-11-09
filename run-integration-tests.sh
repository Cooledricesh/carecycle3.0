#!/bin/bash

# Simple Integration Test Execution Script
# Run all tests and collect results

echo "======================================"
echo "INTEGRATION TEST EXECUTION"
echo "======================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Result tracking
OVERALL_STATUS=0

# 1. TypeScript Compilation
echo "1. TypeScript Compilation Check..."
echo "--------------------------------------"
npx tsc --noEmit
TSC_EXIT=$?
if [ $TSC_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ TypeScript compilation passed${NC}"
else
    echo -e "${RED}✗ TypeScript compilation failed${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 2. ESLint
echo "2. ESLint Code Quality Check..."
echo "--------------------------------------"
npm run lint
LINT_EXIT=$?
if [ $LINT_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ ESLint passed${NC}"
else
    echo -e "${RED}✗ ESLint failed${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 3. Unit Tests
echo "3. Unit Tests (Vitest)..."
echo "--------------------------------------"
npm test -- --run --reporter=verbose
TEST_EXIT=$?
if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
else
    echo -e "${RED}✗ Unit tests failed${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 4. Migration Check
echo "4. Database Migration Files..."
echo "--------------------------------------"
MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "Found $MIGRATION_COUNT migration files"

# Check for key migrations
DEPARTMENTS=$(grep -l "CREATE TABLE.*departments" supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
POLICIES=$(grep -l "CREATE TABLE.*organization_policies" supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
METADATA=$(grep -l "metadata JSONB" supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')

echo "  - Departments table: $DEPARTMENTS migration(s)"
echo "  - Organization policies: $POLICIES migration(s)"
echo "  - Metadata column: $METADATA migration(s)"

if [ $DEPARTMENTS -gt 0 ] && [ $POLICIES -gt 0 ] && [ $METADATA -gt 0 ]; then
    echo -e "${GREEN}✓ All critical migrations present${NC}"
else
    echo -e "${YELLOW}⚠ Some migrations may be missing${NC}"
fi
echo ""

# Final Summary
echo "======================================"
echo "TEST EXECUTION SUMMARY"
echo "======================================"
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}STATUS: ALL TESTS PASSED${NC}"
    echo ""
    echo "The codebase is ready for integration testing."
else
    echo -e "${RED}STATUS: SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the errors above before proceeding."
fi
echo ""

exit $OVERALL_STATUS
