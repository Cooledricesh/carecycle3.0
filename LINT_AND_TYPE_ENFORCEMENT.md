# 🚨 MANDATORY: Lint and TypeScript Error Enforcement Protocol 🚨

## ⛔ ZERO TOLERANCE POLICY FOR CODE QUALITY ERRORS ⛔

### The Problem We're Solving
Errors are being dismissed as "unrelated to current changes" leading to:
- Accumulating technical debt
- Broken builds in production
- Degraded developer experience
- Hidden bugs that surface later

### 🔴 ABSOLUTE REQUIREMENTS - NO EXCEPTIONS

## 1. Pre-Work Validation (ALWAYS START HERE)

```bash
# MANDATORY: Run before ANY code changes
npm run lint
npx tsc --noEmit

# Document baseline errors
echo "=== BASELINE ERRORS $(date) ===" > .errors-baseline.txt
npm run lint 2>&1 | tee -a .errors-baseline.txt
npx tsc --noEmit 2>&1 | tee -a .errors-baseline.txt
```

**⚠️ If you skip this step, your work is invalid**

## 2. During Development Workflow

### After EVERY file save:
```bash
# Quick check on changed files only
npx eslint [changed-file.ts]
npx tsc --noEmit --incremental
```

### Before EVERY commit attempt:
```bash
# Full project validation
npm run lint
npx tsc --noEmit
```

## 3. Error Classification System

### Category A: MUST FIX IMMEDIATELY
- **New Errors**: Any error that didn't exist in baseline
- **Type Errors**: All TypeScript compilation failures
- **Import Errors**: Missing imports, circular dependencies
- **Undefined Variables**: Reference errors
- **Security Issues**: Any security-related lint rule

### Category B: FIX IN SAME PR
- **Unused Variables**: In files you're modifying
- **Console Statements**: Remove or convert to proper logging
- **Formatting Issues**: In files you're touching
- **Simple Type Annotations**: Missing return types, parameter types

### Category C: DOCUMENT AND TRACK
- **Complex Refactors**: Requiring architectural changes
- **Third-party Type Issues**: External library problems
- **Legacy Code Issues**: In untouched files

## 4. The Enforcement Checklist

### ✅ MANDATORY CHECKLIST (Copy this for EVERY task)

```markdown
## Pre-Implementation Checks
- [ ] Baseline errors documented in `.errors-baseline.txt`
- [ ] Current error count: _____ lint, _____ TypeScript

## Implementation Phase
- [ ] No new lint errors introduced
- [ ] No new TypeScript errors introduced
- [ ] All imports verified
- [ ] No 'any' types added without TODO comment

## Pre-Commit Validation
- [ ] `npm run lint` passes or has ONLY documented baseline errors
- [ ] `npx tsc --noEmit` succeeds or has ONLY documented baseline errors
- [ ] Error comparison shows no increase from baseline

## Error Resolution Summary
- Fixed: _____ errors
- Pre-existing (documented): _____ errors
- New TODOs added: _____ (with issue numbers)
```

## 5. Error Resolution Commands

### Quick Fixes
```bash
# Auto-fix safe lint issues
npx eslint --fix .

# Type-check specific file
npx tsc --noEmit src/components/MyComponent.tsx

# Find unused exports
npx ts-prune

# Check for circular dependencies
npx madge --circular --extensions ts,tsx src/
```

### Error Analysis
```bash
# Count errors by type
npm run lint 2>&1 | grep error | cut -d: -f4 | sort | uniq -c | sort -rn

# Find all 'any' types
grep -r "any" --include="*.ts" --include="*.tsx" src/ | grep -v "// TODO"

# List files with errors
npm run lint 2>&1 | grep error | cut -d: -f1 | sort | uniq
```

## 6. Common Errors and MANDATORY Fixes

### TypeScript Errors

```typescript
// ❌ NEVER: Ignore with @ts-ignore
// @ts-ignore
const data = someFunction();

// ✅ ALWAYS: Fix the type or document why
const data = someFunction() as KnownType; // TODO: Fix function return type (ISSUE-123)
```

### Unused Variables

```typescript
// ❌ NEVER: Leave unused variables
const unused = "some value";

// ✅ ALWAYS: Remove or prefix with underscore if intentional
const _intentionallyUnused = "for future use"; // TODO: Implement in ISSUE-124
```

### Import Errors

```typescript
// ❌ NEVER: Use require or dynamic imports without types
const module = require('some-module');

// ✅ ALWAYS: Use proper typed imports
import { SpecificExport } from 'some-module';
```

## 7. Progressive Error Reduction Strategy

### Week 1: Stop the Bleeding
- No new errors allowed
- Document all existing errors

### Week 2: Low-Hanging Fruit
- Fix all unused variables
- Remove all console.logs
- Add missing return types

### Week 3: Type Safety
- Replace 'any' with proper types
- Fix all import issues
- Add missing null checks

### Week 4: Complete Cleanup
- Achieve zero lint errors
- Achieve zero TypeScript errors
- Enable strict mode

## 8. Enforcement Prompts for AI Assistants

### Starting Any Task
```
Before I begin, I will:
1. Run `npm run lint` and document current errors
2. Run `npx tsc --noEmit` and document type errors
3. Save baseline to compare against later
4. Not proceed until baseline is established
```

### During Development
```
After each file modification, I will:
1. Run lint on the specific file
2. Fix ALL errors in that file, not just "related" ones
3. Verify no new errors in other files
4. Document any errors I cannot fix with reason and TODO
```

### Before Completion
```
I cannot consider this task complete until:
1. npm run lint shows no new errors
2. npx tsc --noEmit shows no new errors
3. All errors are either fixed or documented with issue numbers
4. The error checklist is completed and included in my response
```

## 9. REJECTION Criteria

Your work will be REJECTED if:
- 🚫 You add new lint errors without fixing them
- 🚫 You add new TypeScript errors without fixing them
- 🚫 You use @ts-ignore, @ts-nocheck, or eslint-disable without approval
- 🚫 You claim errors are "unrelated" without proof from baseline
- 🚫 You skip the validation checklist
- 🚫 You increase the total error count

## 10. The Golden Rules

1. **Every error matters** - No error is too small to fix
2. **Leave it better** - Fix more than you break
3. **Document everything** - If you can't fix it, document why
4. **No surprises** - All errors must be accounted for
5. **Continuous improvement** - Each PR should reduce total errors

## 11. Emergency Procedures

### If You Accidentally Introduced Errors

```bash
# Revert to last known good state
git stash
npm run lint  # Verify clean state
git stash pop

# Fix incrementally
# Fix one file at a time
# Test after each fix
```

### If Baseline Has Too Many Errors

```bash
# Create error fixing branch
git checkout -b fix/reduce-lint-errors

# Fix by category
npx eslint --fix src/components/  # Auto-fix what's safe
npx eslint src/components/        # Manual fix rest

# Commit in small chunks
git add -p  # Partial adds
git commit -m "fix: resolve lint errors in components"
```

## 12. Reporting Template

### Use This Format in Every Response

```markdown
## Code Quality Report

### Baseline Status
- Initial lint errors: [count]
- Initial TypeScript errors: [count]

### Changes Made
- Files modified: [list]
- Lines changed: [count]

### Final Status
- Final lint errors: [count] ([+/-] from baseline)
- Final TypeScript errors: [count] ([+/-] from baseline)

### Errors Fixed
1. [Error type] in [file]: [description]
2. ...

### Remaining Errors (Pre-existing)
1. [Error type] in [file]: [reason not fixed]
2. ...

### Validation Confirmation
✅ npm run lint: [PASS/FAIL]
✅ npx tsc --noEmit: [PASS/FAIL]
```

## REMEMBER: "Unrelated to my changes" is NOT an acceptable excuse!

Every error in a file you touch becomes your responsibility.