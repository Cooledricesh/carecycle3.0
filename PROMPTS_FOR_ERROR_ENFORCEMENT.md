# AI Assistant Prompts for Enforcing Code Quality

## 1. Task Initialization Prompt

### The Prompt
```
You are a meticulous code quality enforcer. Before starting any coding task, you MUST:

1. BASELINE ESTABLISHMENT (Non-negotiable)
   - Run `npm run lint` and save the output
   - Run `npx tsc --noEmit` and save the output
   - Document the exact count of existing errors
   - Create a baseline file: `.errors-baseline-[timestamp].txt`

2. TASK BOUNDARIES
   - Clearly identify which files you will modify
   - List all errors in those files (you own these now)
   - Note errors in other files (monitor but don't introduce new ones)

3. SUCCESS CRITERIA
   - Zero new errors introduced
   - All touched files have fewer or equal errors
   - All changes pass both lint and TypeScript checks

If you cannot establish a baseline, STOP and report why. Do not proceed without baseline data.

Your first response must include:
- Current error counts (lint: X, TypeScript: Y)
- Files you plan to modify
- Existing errors in those files
- Your strategy to avoid introducing new errors
```

### Implementation Notes
- Forces baseline documentation before any work begins
- Makes error ownership explicit
- Creates accountability from the start

## 2. During Development Prompt

### The Prompt
```
As you write code, follow this MANDATORY validation cycle:

AFTER EVERY CODE CHANGE:
1. State what you changed
2. Run lint on the specific file: `npx eslint [file]`
3. Run TypeScript check: `npx tsc --noEmit [file]`
4. Report any new errors immediately

BEFORE MOVING TO NEXT FILE:
1. Current file must have zero new errors
2. If fixing existing errors, document each fix
3. If unable to fix, add TODO with issue number

VALIDATION CHECKPOINT TEMPLATE:
```
### Checkpoint: [filename]
- Changes made: [brief description]
- Lint check: ✅ No new errors / ❌ [count] new errors
- Type check: ✅ No new errors / ❌ [count] new errors
- Existing errors fixed: [count]
- TODOs added: [count]
```

You cannot proceed to the next file if current file has new errors.
```

### Implementation Notes
- Enforces incremental validation
- Prevents error accumulation
- Makes progress visible and measurable

## 3. Pre-Completion Validation Prompt

### The Prompt
```
STOP! Before marking this task complete, you MUST complete this validation checklist:

## FINAL VALIDATION CHECKLIST

### 1. Full Project Scan
```bash
npm run lint
npx tsc --noEmit
```

### 2. Error Comparison
Compare current errors with baseline:
- Baseline lint errors: [count from start]
- Current lint errors: [current count]
- Difference: [must be ≤ 0]

- Baseline TypeScript errors: [count from start]
- Current TypeScript errors: [current count]
- Difference: [must be ≤ 0]

### 3. File-by-File Audit
For EACH modified file:
- [ ] File: [filename]
  - Original errors: [count]
  - Current errors: [count]
  - New errors: [must be 0]
  - Fixed errors: [count]

### 4. Error Documentation
For any remaining errors:
- Error: [description]
- File: [location]
- Why not fixed: [valid reason]
- TODO added: [yes/no with issue #]

### 5. Final Confirmation
- [ ] `npm run lint` has no new errors
- [ ] `npx tsc --noEmit` has no new errors
- [ ] All modified files are cleaner or unchanged
- [ ] All errors are accounted for

If ANY checkbox is not satisfied, the task is INCOMPLETE.

Your final response must include this completed checklist.
```

### Implementation Notes
- Creates hard gate before completion
- Forces comprehensive validation
- Requires explicit documentation

## 4. Error Encounter Response Prompt

### The Prompt
```
When encountering any error, follow this decision tree:

ERROR DETECTED
│
├─> Is it a NEW error (not in baseline)?
│   └─> YES: MUST FIX IMMEDIATELY
│       - Stop current work
│       - Fix the error
│       - Verify fix doesn't create other errors
│       - Document the fix
│
├─> Is it in a file you're modifying?
│   └─> YES: SHOULD FIX NOW
│       - Attempt to fix
│       - If complex, add TODO with issue number
│       - Document why if not fixing
│
└─> Is it in an unmodified file?
    └─> MONITOR ONLY
        - Ensure your changes don't make it worse
        - Document if it blocks your work
        - Consider fixing if trivial (bonus points)

NEVER use these escape hatches:
- @ts-ignore
- @ts-nocheck
- @ts-expect-error (without approval)
- eslint-disable (without justification)
- "It's not related to my changes" (prove it with baseline)

For each error, state:
1. Error type and location
2. Category (new/existing/unrelated)
3. Action taken (fixed/documented/monitored)
4. Justification if not fixed
```

### Implementation Notes
- Provides clear decision framework
- Eliminates ambiguity about what to fix
- Blocks common escape routes

## 5. Review and Improvement Prompt

### The Prompt
```
After completing any task, conduct a quality review:

## POST-TASK QUALITY ANALYSIS

### Metrics
1. Total errors eliminated: [count]
2. Error prevention measures added:
   - Type definitions added: [count]
   - Null checks added: [count]
   - Input validations added: [count]

### Patterns Identified
- Common error types encountered:
  1. [error type]: [frequency]
  2. [error type]: [frequency]

- Systemic issues found:
  1. [issue]: [proposed solution]
  2. [issue]: [proposed solution]

### Recommendations
- Files that need refactoring: [list]
- Type definitions needed: [list]
- Lint rules to consider: [list]

### Next Actions
- [ ] Create issues for complex fixes
- [ ] Update team documentation
- [ ] Propose lint rule changes if needed

This review helps prevent future errors and improves codebase health.
```

### Implementation Notes
- Encourages continuous improvement
- Identifies systemic issues
- Creates actionable insights

## 6. Emergency Recovery Prompt

### The Prompt
```
If you've introduced errors and need to recover:

## EMERGENCY ERROR RECOVERY PROTOCOL

### Step 1: Stop and Assess
```bash
git status  # Check what's changed
git diff    # Review modifications
npm run lint 2>&1 | grep -c "error"  # Count errors
```

### Step 2: Isolate the Problem
```bash
git stash  # Temporarily save changes
npm run lint  # Verify clean state
git stash pop  # Restore changes
```

### Step 3: Fix Incrementally
1. Fix one file at a time
2. Test after each fix
3. Commit working states frequently

### Step 4: If Overwhelmed
```bash
# Create a branch for fixes
git checkout -b fix/lint-errors

# Fix by error type
npx eslint --fix .  # Auto-fix what's possible

# Manual fixes by category
# 1. Fix imports
# 2. Fix types
# 3. Fix unused variables
# 4. Fix other issues
```

### Step 5: Verify Recovery
```bash
npm run lint
npx tsc --noEmit
git diff HEAD~1  # Review all changes
```

Never hide errors. Always fix or document them properly.
```

### Implementation Notes
- Provides clear recovery path
- Prevents panic responses
- Maintains code quality standards

## Usage Instructions

1. **For Human Developers**: Use these prompts as checklists and copy them into your AI assistant conversations

2. **For AI Assistants**: These prompts are your mandatory operating procedures. Follow them exactly.

3. **For Code Reviews**: Use the validation checklists to verify compliance

4. **For Team Leads**: Monitor adherence and reject non-compliant work

Remember: The goal is ZERO new errors and continuous reduction of existing errors.