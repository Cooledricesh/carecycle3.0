#!/bin/bash

# 🔍 Supabase Legacy Keys Detection Script
# This script detects any remaining legacy key references in the codebase

echo "🔍 Supabase Legacy Keys Detection Started..."
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize counters
LEGACY_COUNT=0
ERROR_COUNT=0

# Function to check for legacy patterns
check_legacy_pattern() {
    local pattern="$1"
    local description="$2"
    local files
    
    echo -e "\n${BLUE}📋 Checking for: ${description}${NC}"
    
    # Search for the pattern, excluding this script and certain directories
    files=$(grep -r "$pattern" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=.next \
        --exclude="*.log" \
        --exclude="check-legacy-keys.sh" \
        --exclude="SUPABASE_NEW_API_KEYS_REFERENCE.md" \
        --exclude="emergency-security-measures.md" \
        2>/dev/null || true)
    
    if [ -n "$files" ]; then
        echo -e "${RED}❌ Found legacy pattern: ${pattern}${NC}"
        echo "$files"
        LEGACY_COUNT=$((LEGACY_COUNT + 1))
        ERROR_COUNT=$((ERROR_COUNT + 1))
    else
        echo -e "${GREEN}✅ No legacy pattern found${NC}"
    fi
}

# Function to check for new key patterns
check_new_pattern() {
    local pattern="$1"
    local description="$2"
    local files
    
    echo -e "\n${BLUE}📋 Checking for: ${description}${NC}"
    
    # Search for the new pattern
    files=$(grep -r "$pattern" src/ 2>/dev/null || true)
    
    if [ -n "$files" ]; then
        echo -e "${GREEN}✅ Found new pattern: ${pattern}${NC}"
        echo "Count: $(echo "$files" | wc -l) occurrences"
    else
        echo -e "${YELLOW}⚠️  No new pattern found - might need implementation${NC}"
    fi
}

# Check for legacy environment variable patterns
echo -e "${YELLOW}🔍 Phase 1: Legacy Environment Variables${NC}"
check_legacy_pattern "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Legacy Anonymous Key"
check_legacy_pattern "SUPABASE_SERVICE_ROLE_KEY" "Legacy Service Role Key"

# Check for legacy import patterns
echo -e "\n${YELLOW}🔍 Phase 2: Legacy Import Patterns${NC}"
check_legacy_pattern "createClient.*supabase-js" "Direct @supabase/supabase-js imports"
check_legacy_pattern "process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY" "Direct anon key usage"
check_legacy_pattern "process\.env\.SUPABASE_SERVICE_ROLE_KEY" "Direct service role key usage"

# Check for legacy comments and documentation
echo -e "\n${YELLOW}🔍 Phase 3: Legacy Documentation${NC}"
check_legacy_pattern "anon.*key" "References to 'anon key'"
check_legacy_pattern "service.*role.*key" "References to 'service role key'"

# Check for new patterns (should exist)
echo -e "\n${YELLOW}🔍 Phase 4: New Key System Verification${NC}"
check_new_pattern "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "New Publishable Key"
check_new_pattern "SUPABASE_SECRET_KEY" "New Secret Key"
check_new_pattern "createServiceClient" "New Service Client Pattern"

# Check specific files that should be updated
echo -e "\n${YELLOW}🔍 Phase 5: Critical File Verification${NC}"

critical_files=(
    "src/lib/supabase/client.ts"
    "src/lib/supabase/server.ts"
    "src/lib/supabase/middleware.ts"
    "src/app/auth/callback/route.ts"
    ".env.example"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "\n${BLUE}📄 Checking critical file: $file${NC}"
        
        # Check if file contains legacy patterns
        if grep -q "SUPABASE_ANON_KEY\|SUPABASE_SERVICE_ROLE_KEY" "$file" 2>/dev/null; then
            echo -e "${RED}❌ File contains legacy keys${NC}"
            ERROR_COUNT=$((ERROR_COUNT + 1))
        else
            echo -e "${GREEN}✅ File is clean of legacy keys${NC}"
        fi
        
        # Check if file contains new patterns (for core files)
        case "$file" in
            "src/lib/supabase/"*)
                if grep -q "PUBLISHABLE_KEY\|SECRET_KEY" "$file" 2>/dev/null; then
                    echo -e "${GREEN}✅ File uses new key system${NC}"
                else
                    echo -e "${YELLOW}⚠️  File might need new key system${NC}"
                fi
                ;;
        esac
    else
        echo -e "${RED}❌ Critical file missing: $file${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
done

# Environment file specific checks
echo -e "\n${YELLOW}🔍 Phase 6: Environment Files Check${NC}"

env_files=(".env" ".env.local" ".env.example")

for env_file in "${env_files[@]}"; do
    if [ -f "$env_file" ]; then
        echo -e "\n${BLUE}📄 Checking environment file: $env_file${NC}"
        
        # Check for legacy keys in env files
        if grep -q "SUPABASE_ANON_KEY\|SUPABASE_SERVICE_ROLE_KEY" "$env_file" 2>/dev/null; then
            # Check if they are commented out or empty
            if grep "^#.*SUPABASE_ANON_KEY\|^SUPABASE_ANON_KEY=\"\"\|^#.*SUPABASE_SERVICE_ROLE_KEY\|^SUPABASE_SERVICE_ROLE_KEY=\"\"" "$env_file" >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Legacy keys are properly disabled${NC}"
            else
                echo -e "${RED}❌ Active legacy keys found${NC}"
                ERROR_COUNT=$((ERROR_COUNT + 1))
            fi
        else
            echo -e "${GREEN}✅ No legacy keys found${NC}"
        fi
        
        # Check for new keys
        if grep -q "PUBLISHABLE_KEY\|SECRET_KEY" "$env_file" 2>/dev/null; then
            echo -e "${GREEN}✅ New key system variables present${NC}"
        else
            echo -e "${YELLOW}⚠️  New key system variables missing${NC}"
        fi
    fi
done

# Final report
echo -e "\n========================================================"
echo -e "${BLUE}📊 MIGRATION REPORT${NC}"
echo "========================================================"

if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: Complete migration to new Supabase API Key system!${NC}"
    echo -e "${GREEN}✅ Zero legacy key references found${NC}"
    echo -e "${GREEN}✅ All critical files updated${NC}"
    echo -e "${GREEN}✅ Environment variables properly configured${NC}"
    exit 0
else
    echo -e "${RED}❌ INCOMPLETE: Found $ERROR_COUNT issues that need attention${NC}"
    echo -e "${RED}⚠️  Please fix the above issues before proceeding${NC}"
    echo ""
    echo -e "${YELLOW}📋 Recommended actions:${NC}"
    echo "1. Update any remaining legacy key references"
    echo "2. Ensure all environment variables use new key names"
    echo "3. Update documentation and comments"
    echo "4. Run this script again to verify fixes"
    exit 1
fi