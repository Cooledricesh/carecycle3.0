# 🔴 QUICK REFERENCE: Error Check Commands

## 📋 Copy-Paste Commands

### 🟢 START OF TASK
```bash
# Create baseline (MANDATORY)
echo "=== BASELINE $(date) ===" > .errors-baseline.txt
npm run lint 2>&1 | tee -a .errors-baseline.txt
echo "---" >> .errors-baseline.txt
npx tsc --noEmit 2>&1 | tee -a .errors-baseline.txt
```

### 🟡 DURING WORK
```bash
# After each file change
npx eslint src/path/to/file.tsx
npx tsc --noEmit --incremental

# Quick full check
npm run lint 2>&1 | grep -c "error"
npx tsc --noEmit 2>&1 | grep -c "error"
```

### 🔴 BEFORE COMMIT
```bash
# Full validation (MANDATORY)
npm run lint
npx tsc --noEmit

# Compare with baseline
echo "=== FINAL CHECK $(date) ==="
echo "Lint errors:"
npm run lint 2>&1 | grep -c "error"
echo "TypeScript errors:"
npx tsc --noEmit 2>&1 | grep -c "error"
```

## ⚡ Quick Fixes

### Auto-fix safe issues
```bash
npx eslint --fix .
```

### Find specific error types
```bash
# Unused variables
npx eslint . 2>&1 | grep "no-unused-vars"

# Missing types
npx tsc --noEmit 2>&1 | grep "implicitly has an 'any' type"

# Import errors
npx eslint . 2>&1 | grep "import/"
```

### Fix by directory
```bash
# Fix components
npx eslint --fix src/components/

# Fix specific file
npx eslint --fix src/components/MyComponent.tsx
```

## 🚨 ERROR CATEGORIES

### MUST FIX NOW (Block commit)
- ❌ New TypeScript errors
- ❌ New lint errors
- ❌ Import failures
- ❌ Undefined variables
- ❌ Type mismatches

### SHOULD FIX NOW (In touched files)
- ⚠️ Unused variables
- ⚠️ Console.logs
- ⚠️ Missing return types
- ⚠️ any types

### CAN DEFER (Document with TODO)
- 💡 Complex refactors
- 💡 Third-party type issues
- 💡 Legacy code in untouched files

## 📊 Error Report Template

```markdown
## Error Status
- Baseline: ___ lint, ___ TS errors
- Current: ___ lint, ___ TS errors
- Delta: ___ (must be ≤ 0)

## Fixed
- ✅ [error type] in [file]

## Remaining (pre-existing)
- ⏸️ [error type] in [file] - TODO #___
```

## 🎯 Success Criteria

✅ **PASS** if ALL true:
- [ ] No new errors vs baseline
- [ ] npm run lint succeeds or shows only baseline errors
- [ ] npx tsc --noEmit succeeds or shows only baseline errors
- [ ] All touched files are cleaner

❌ **FAIL** if ANY true:
- [ ] New errors introduced
- [ ] Used @ts-ignore
- [ ] Used eslint-disable without justification
- [ ] Claimed "unrelated" without baseline proof

## 💀 FORBIDDEN PATTERNS

```typescript
// ❌ NEVER DO THIS
// @ts-ignore
// @ts-nocheck
// eslint-disable-next-line
/* eslint-disable */

// ✅ ALWAYS DO THIS
// TODO: Fix type issue (ISSUE-123)
// Documented in .errors-baseline.txt
```

## 🔄 Recovery Commands

```bash
# If you messed up
git stash
npm run lint  # Verify clean
git stash pop

# Nuclear option
git reset --hard HEAD
git clean -fd
```

## 📌 REMEMBER

1. **Baseline FIRST** - No work without baseline
2. **Check OFTEN** - After every file save
3. **Fix IMMEDIATELY** - New errors = stop everything
4. **Document ALWAYS** - If can't fix, document why
5. **Leave it BETTER** - Reduce total errors

---

**Print this and keep it visible while coding!**