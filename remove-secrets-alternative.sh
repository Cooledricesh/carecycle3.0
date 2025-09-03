#!/bin/bash

# ============================================================================
# SAFE GIT FILTER-BRANCH SCRIPT FOR REMOVING SENSITIVE DATA
# ============================================================================
# 
# Purpose: Safely remove sensitive files from Git history with multiple
#          safety checks and recovery options.
#
# Safety Features:
#   - Requires explicit confirmation with token (YES-REMOVE-SECRETS)
#   - Prevents running on dirty working tree
#   - Protects main/master branches (requires --force flag)
#   - Creates recovery tag before operation
#   - Provides multiple backup recommendations
#   - Preserves original refs for recovery
#   - Validates Git repository existence
#
# Usage:
#   ./remove-secrets-alternative.sh           # Normal mode
#   ./remove-secrets-alternative.sh --force   # Force mode for protected branches
#
# Recovery:
#   - Use recovery tag: git reset --hard [RECOVERY_TAG]
#   - Use original refs: git reset --hard refs/original/refs/heads/[BRANCH]
#
# ============================================================================

# Enable strict error handling
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Script configuration
FORCE_FLAG="${1:-}"
PROTECTED_BRANCHES=("main" "master" "production" "release")
FILE_TO_REMOVE="create-admin.js"

# Function to print colored output
print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Header
echo -e "${BOLD}🔒 Git filter-branch를 사용한 민감 데이터 제거${NC}"
echo "=============================================="
echo ""

# Check if running inside a git repository
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    print_error "This script must be run inside a Git repository"
    exit 1
fi

print_success "Git repository detected"

# Check if working tree is clean
if [[ -n $(git status --porcelain) ]]; then
    print_error "Working tree is not clean. Please commit or stash your changes first."
    echo "Run 'git status' to see uncommitted changes"
    exit 1
fi

print_success "Working tree is clean"

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if on protected branch
for protected in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$CURRENT_BRANCH" == "$protected" ]]; then
        if [[ "$FORCE_FLAG" != "--force" ]]; then
            print_error "You are on a protected branch: $CURRENT_BRANCH"
            echo "Protected branches require explicit force flag."
            echo "Usage: $0 --force"
            echo ""
            echo "It's strongly recommended to:"
            echo "  1. Create a new branch first: git checkout -b cleanup-secrets"
            echo "  2. Run this script on the new branch"
            echo "  3. Test thoroughly before merging"
            exit 1
        else
            print_warning "Force flag detected. Proceeding on protected branch: $CURRENT_BRANCH"
        fi
    fi
done

# Check if file exists in history
if ! git log --oneline --follow -- "$FILE_TO_REMOVE" &>/dev/null; then
    print_warning "File '$FILE_TO_REMOVE' not found in Git history"
    echo "The file may have already been removed or never existed."
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled."
        exit 0
    fi
fi

# Display backup instructions
echo ""
echo -e "${BOLD}📦 BACKUP RECOMMENDATIONS${NC}"
echo "================================"
echo ""
print_info "Before proceeding, it's HIGHLY recommended to create a backup:"
echo ""
echo "  Option 1 - Create a Git bundle (recommended):"
echo "    git bundle create ../repo-backup-$(date +%Y%m%d-%H%M%S).bundle --all"
echo ""
echo "  Option 2 - Clone to another directory:"
echo "    git clone --mirror . ../repo-backup-$(date +%Y%m%d-%H%M%S)"
echo ""
echo "  Option 3 - Push to a backup branch:"
echo "    git push origin HEAD:backup-before-cleanup-$(date +%Y%m%d)"
echo ""
print_warning "Git filter-branch will keep original refs in .git/refs/original/"
print_warning "but it's safer to have an external backup."
echo ""

# Ask user to confirm they've created a backup
read -p "Have you created a backup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Please create a backup before proceeding."
    echo "This operation will rewrite Git history and cannot be easily undone."
    exit 1
fi

# Show what will be done
echo ""
echo -e "${BOLD}📋 OPERATION SUMMARY${NC}"
echo "================================"
echo ""
echo "This script will:"
echo "  1. Remove '$FILE_TO_REMOVE' from ALL commits in history"
echo "  2. Rewrite ALL commit hashes"
echo "  3. Clean up Git references and garbage collect"
echo ""
print_warning "This is a DESTRUCTIVE operation that will:"
echo "  • Change ALL commit SHAs in the repository"
echo "  • Require force-pushing to remote repositories"
echo "  • Break any existing pull requests"
echo "  • Affect all collaborators who must re-clone"
echo ""

# Final confirmation with specific token
CONFIRM_TOKEN="YES-REMOVE-SECRETS"
echo -e "${BOLD}${RED}⚠️  FINAL CONFIRMATION REQUIRED ⚠️${NC}"
echo ""
echo "To proceed with this destructive operation, type exactly: $CONFIRM_TOKEN"
read -p "Confirmation: " USER_CONFIRM

if [[ "$USER_CONFIRM" != "$CONFIRM_TOKEN" ]]; then
    print_error "Confirmation token did not match."
    echo "Operation cancelled for safety."
    exit 1
fi

# Create a tag for recovery point
RECOVERY_TAG="before-filter-branch-$(date +%Y%m%d-%H%M%S)"
print_info "Creating recovery tag: $RECOVERY_TAG"
git tag "$RECOVERY_TAG"

# Perform the filter-branch operation
echo ""
print_info "Starting git filter-branch operation..."
echo ""

git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch $FILE_TO_REMOVE" \
  --prune-empty --tag-name-filter cat -- --all

# Check if filter-branch succeeded
if [[ $? -eq 0 ]]; then
    print_success "Git filter-branch completed successfully"
else
    print_error "Git filter-branch failed"
    echo "You can recover using: git reset --hard $RECOVERY_TAG"
    exit 1
fi

# Show original refs location
echo ""
print_info "Original refs are preserved in: .git/refs/original/"
echo "You can recover the original state with:"
echo "  git reset --hard refs/original/refs/heads/$CURRENT_BRANCH"
echo ""

# Ask before cleaning up
read -p "Do you want to clean up refs and run garbage collection? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Cleaning up..."
    
    # Remove the original refs backup
    rm -rf .git/refs/original/
    
    # Expire all reflog entries
    git reflog expire --expire=now --all
    
    # Garbage collect aggressively
    git gc --prune=now --aggressive
    
    print_success "Cleanup completed"
else
    print_info "Skipping cleanup. Original refs remain in .git/refs/original/"
fi

# Final instructions
echo ""
echo -e "${BOLD}📝 NEXT STEPS${NC}"
echo "================================"
echo ""
print_warning "To push changes to remote repository:"
echo ""
echo "  1. Verify the changes:"
echo "     git log --oneline --graph"
echo "     git status"
echo ""
echo "  2. Force push to remote (⚠️  DESTRUCTIVE):"
echo "     git push origin --force --all"
echo "     git push origin --force --tags"
echo ""
echo "  3. Notify all collaborators to:"
echo "     • Backup their local changes"
echo "     • Delete their local repository"
echo "     • Re-clone from remote"
echo ""
print_info "Recovery tag created: $RECOVERY_TAG"
print_info "To undo everything locally: git reset --hard $RECOVERY_TAG"
echo ""
print_success "Script completed. Please review changes before pushing."