#!/bin/bash

# Comprehensive Integration Testing Script
# For Minor Update Plan Validation

echo "========================================="
echo "COMPREHENSIVE INTEGRATION TEST SUITE"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test result tracking
TESTS_PASSED=0
TESTS_FAILED=0
CRITICAL_ISSUES=0

# Function to print test section header
print_section() {
    echo ""
    echo "========================================="
    echo "$1"
    echo "========================================="
    echo ""
}

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        if [ "$3" == "critical" ]; then
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
        fi
    fi
}

# 1. Unit Tests
print_section "1. UNIT TESTS (Vitest)"
npm test -- --run --reporter=verbose 2>&1 | tee test-output.log
TEST_EXIT_CODE=${PIPESTATUS[0]}
print_result $TEST_EXIT_CODE "Unit test suite execution"

# 2. TypeScript Compilation
print_section "2. TYPESCRIPT COMPILATION CHECK"
npx tsc --noEmit 2>&1 | tee tsc-output.log
TSC_EXIT_CODE=${PIPESTATUS[0]}
print_result $TSC_EXIT_CODE "TypeScript compilation check" "critical"

# 3. Linting
print_section "3. ESLINT CODE QUALITY CHECK"
npm run lint 2>&1 | tee lint-output.log
LINT_EXIT_CODE=${PIPESTATUS[0]}
print_result $LINT_EXIT_CODE "ESLint code quality check"

# 4. Check for critical patterns
print_section "4. CODE PATTERN ANALYSIS"

# Check for hardcoded API keys
echo "Checking for hardcoded API keys..."
if grep -r "sb_publishable_\|sb_secret_\|eyJ" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules src/ 2>/dev/null; then
    print_result 1 "No hardcoded API keys" "critical"
else
    print_result 0 "No hardcoded API keys"
fi

# Check for direct Supabase imports
echo "Checking for direct Supabase client imports..."
if grep -r "from '@supabase/supabase-js'" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules src/ 2>/dev/null | grep -v "lib/supabase"; then
    print_result 1 "No direct Supabase imports (should use helpers)"
else
    print_result 0 "No direct Supabase imports (should use helpers)"
fi

# Check for camelCase in data access (should be snake_case)
echo "Checking for camelCase violations in data fields..."
CAMEL_CASE_COUNT=$(grep -r "\.patientName\|\.nextDueDate\|\.intervalWeeks\|\.itemCategory" --include="*.tsx" --exclude-dir=node_modules src/components/ 2>/dev/null | wc -l)
if [ $CAMEL_CASE_COUNT -gt 0 ]; then
    print_result 1 "Data fields use snake_case (found $CAMEL_CASE_COUNT camelCase violations)"
else
    print_result 0 "Data fields use snake_case"
fi

# 5. Database Schema Validation
print_section "5. DATABASE SCHEMA VALIDATION"

# Check migration files exist
MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)
echo "Found $MIGRATION_COUNT migration files"
if [ $MIGRATION_COUNT -gt 0 ]; then
    print_result 0 "Migration files present"
else
    print_result 1 "Migration files present" "critical"
fi

# Check for key migrations from minor update plan
echo "Checking for Phase 2 migrations..."
DEPARTMENTS_MIGRATION=$(grep -l "CREATE TABLE departments\|CREATE TABLE.*departments" supabase/migrations/*.sql 2>/dev/null | wc -l)
POLICIES_MIGRATION=$(grep -l "CREATE TABLE organization_policies\|CREATE TABLE.*organization_policies" supabase/migrations/*.sql 2>/dev/null | wc -l)
METADATA_MIGRATION=$(grep -l "ALTER TABLE schedule_executions ADD COLUMN metadata\|metadata JSONB" supabase/migrations/*.sql 2>/dev/null | wc -l)

if [ $DEPARTMENTS_MIGRATION -gt 0 ]; then
    print_result 0 "Departments table migration exists"
else
    print_result 1 "Departments table migration exists"
fi

if [ $POLICIES_MIGRATION -gt 0 ]; then
    print_result 0 "Organization policies table migration exists"
else
    print_result 1 "Organization policies table migration exists"
fi

if [ $METADATA_MIGRATION -gt 0 ]; then
    print_result 0 "Schedule executions metadata migration exists"
else
    print_result 1 "Schedule executions metadata migration exists"
fi

# 6. Security Checks
print_section "6. SECURITY AUDIT"

# Check for SQL injection patterns
echo "Checking for potential SQL injection vulnerabilities..."
SQL_INJECTION_COUNT=$(grep -r ".*\${.*}.*FROM\|.*\+.*SELECT" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules src/ 2>/dev/null | wc -l)
if [ $SQL_INJECTION_COUNT -gt 0 ]; then
    print_result 1 "No SQL injection patterns (found $SQL_INJECTION_COUNT potential issues)" "critical"
else
    print_result 0 "No SQL injection patterns"
fi

# Check for XSS vulnerabilities (dangerouslySetInnerHTML)
echo "Checking for XSS vulnerabilities..."
XSS_COUNT=$(grep -r "dangerouslySetInnerHTML" --include="*.tsx" --exclude-dir=node_modules src/ 2>/dev/null | wc -l)
if [ $XSS_COUNT -gt 0 ]; then
    print_result 1 "No XSS vulnerabilities (found $XSS_COUNT dangerouslySetInnerHTML usages)"
else
    print_result 0 "No XSS vulnerabilities"
fi

# 7. Component Structure Validation
print_section "7. COMPONENT STRUCTURE VALIDATION"

# Check for Phase 1 components
echo "Checking for Phase 1 UI components..."
ORGANIZATION_SEARCH=$(ls src/components/**/organization-search*.tsx 2>/dev/null | wc -l)
DEPARTMENT_FILTER=$(ls src/components/**/department-filter*.tsx 2>/dev/null | wc -l)

if [ $ORGANIZATION_SEARCH -gt 0 ]; then
    print_result 0 "Organization search component exists"
else
    print_result 1 "Organization search component exists"
fi

if [ $DEPARTMENT_FILTER -gt 0 ]; then
    print_result 0 "Department filter component exists"
else
    print_result 1 "Department filter component exists"
fi

# Check for validation schemas
echo "Checking for Zod validation schemas..."
ZOD_SCHEMA_COUNT=$(grep -r "z\.object\|z\.string\|z\.number" --include="*.ts" --exclude-dir=node_modules src/lib/validations/ 2>/dev/null | wc -l)
if [ $ZOD_SCHEMA_COUNT -gt 10 ]; then
    print_result 0 "Zod validation schemas present ($ZOD_SCHEMA_COUNT definitions)"
else
    print_result 1 "Sufficient Zod validation schemas"
fi

# 8. API Endpoint Validation
print_section "8. API ENDPOINT STRUCTURE"

# Check for departments API
DEPARTMENTS_API=$(ls src/app/api/**/departments/**/route.ts 2>/dev/null | wc -l)
POLICIES_API=$(ls src/app/api/**/policies/**/route.ts 2>/dev/null | wc -l)

if [ $DEPARTMENTS_API -gt 0 ]; then
    print_result 0 "Departments CRUD API endpoints exist"
else
    print_result 1 "Departments CRUD API endpoints exist"
fi

if [ $POLICIES_API -gt 0 ]; then
    print_result 0 "Organization policies API endpoints exist"
else
    print_result 1 "Organization policies API endpoints exist"
fi

# 9. Generate Summary Report
print_section "TEST SUMMARY REPORT"

echo "Total Tests Run: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}Critical Issues: $CRITICAL_ISSUES${NC}"
echo ""

# Determine overall status
if [ $CRITICAL_ISSUES -gt 0 ]; then
    echo -e "${RED}========================================="
    echo "OVERALL STATUS: NOT READY FOR PRODUCTION"
    echo "=========================================${NC}"
    echo "Critical issues must be resolved before deployment."
    exit 1
elif [ $TESTS_FAILED -gt 5 ]; then
    echo -e "${YELLOW}========================================="
    echo "OVERALL STATUS: NEEDS IMPROVEMENT"
    echo "=========================================${NC}"
    echo "Please address failing tests before deployment."
    exit 1
else
    echo -e "${GREEN}========================================="
    echo "OVERALL STATUS: READY FOR PRODUCTION"
    echo "=========================================${NC}"
    echo "All critical checks passed. Minor issues should be addressed."
    exit 0
fi
