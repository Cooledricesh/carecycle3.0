# Playwright MCP Integration Test Plan
## Minor Update Features Validation

**Date:** 2025-11-09
**Target:** http://localhost:3000

---

## Prerequisites

1. **Development Server Running**
   ```bash
   # Check if port 3000 is in use
   lsof -i :3000

   # If not running, start dev server
   npm run dev
   ```

2. **Test Account**
   - Email: test@example.com
   - Password: Test123!@#
   - Role: admin (for full feature access)

3. **Playwright MCP Ready**
   ```bash
   # Ensure browser is closed before starting
   pkill -f "chrome.*playwright" 2>/dev/null || true
   ```

---

## Test Scenarios

### Scenario 1: Organization Selection in Signup (Phase 1)

**Steps:**
1. Navigate to signup page
2. Fill in user information (name, email, password)
3. Click "Next" to organization selection step
4. Verify organization search dialog appears
5. Test search functionality
6. Test "Create New Organization" option

**Expected Results:**
- ✅ Two-step signup flow visible
- ✅ Organization search dialog functional
- ✅ Can create new organization
- ✅ Can join existing organization

**Test Command:**
```javascript
// Navigate to signup
mcp__playwright__browser_navigate({ url: "http://localhost:3000/auth/signup" })
mcp__playwright__browser_snapshot()

// Fill form and proceed
mcp__playwright__browser_type({ selector: "input[name='email']", text: "newuser@test.com" })
// ... continue with form
```

---

### Scenario 2: Department Filter Dropdown (Phase 1)

**Prerequisites:** Logged in as admin/nurse

**Steps:**
1. Navigate to dashboard
2. Locate department filter dropdown
3. Click dropdown to open menu
4. Verify department list displays
5. Select multiple departments
6. Verify filter indicator shows selection count
7. Clear filters with "전체" option

**Expected Results:**
- ✅ Dropdown shows department list from database
- ✅ Multi-select checkboxes work
- ✅ Visual indicator shows "소속 (2)" when 2 selected
- ✅ Patient list filters by selected departments
- ✅ "전체" clears all selections

**Test Command:**
```javascript
mcp__playwright__browser_navigate({ url: "http://localhost:3000/dashboard" })
mcp__playwright__browser_snapshot()

// Click department filter
mcp__playwright__browser_click({ selector: "button:has-text('소속')" })
mcp__playwright__browser_snapshot()

// Select department
mcp__playwright__browser_click({ selector: "div[role='menuitemcheckbox']:has-text('외래')" })
mcp__playwright__browser_snapshot()
```

---

### Scenario 3: Injection Metadata Input (Phase 3)

**Prerequisites:**
- Logged in
- At least one injection schedule exists
- Schedule is not yet completed

**Steps:**
1. Navigate to dashboard
2. Find an injection schedule
3. Click "완료" button
4. In completion dialog, verify injection metadata form appears
5. Fill in dosage (e.g., "10mg")
6. Select route (e.g., "IV")
7. Add notes
8. Submit form
9. Verify schedule marked as completed
10. Query database to verify metadata saved

**Expected Results:**
- ✅ Metadata form only appears for injection category
- ✅ Dosage validation enforces correct format
- ✅ Route dropdown shows IV/IM/SC options
- ✅ Notes textarea accepts up to 500 characters
- ✅ Metadata saved in schedule_executions.metadata as JSONB
- ✅ Validation errors display for invalid input

**Test Command:**
```javascript
mcp__playwright__browser_navigate({ url: "http://localhost:3000/dashboard" })

// Find and click completion button for injection
mcp__playwright__browser_click({ selector: "button:has-text('완료')" })
mcp__playwright__browser_snapshot()

// Fill metadata form
mcp__playwright__browser_type({ selector: "input#dosage", text: "10mg" })
mcp__playwright__browser_click({ selector: "button:has-text('정맥주사 (IV)')" })
mcp__playwright__browser_type({ selector: "textarea#injection-notes", text: "Patient tolerated well" })
mcp__playwright__browser_snapshot()

// Submit
mcp__playwright__browser_click({ selector: "button:has-text('저장')" })
```

---

### Scenario 4: Dashboard Profile Display (Phase 1)

**Prerequisites:** Logged in with organization assigned

**Steps:**
1. Navigate to dashboard
2. Check sidebar/profile area
3. Verify organization name displays
4. Verify department displays
5. Verify role displays

**Expected Results:**
- ✅ Organization name visible (from organizations table JOIN)
- ✅ Department name visible
- ✅ User role visible (admin/doctor/nurse)

**Test Command:**
```javascript
mcp__playwright__browser_navigate({ url: "http://localhost:3000/dashboard" })
mcp__playwright__browser_snapshot()

// Verify profile section
mcp__playwright__browser_wait_for({ selector: "text='기관:'" })
mcp__playwright__browser_snapshot()
```

---

### Scenario 5: Schedule Sorting by Completion (Phase 3)

**Prerequisites:**
- Dashboard with mixed completed/incomplete schedules
- At least 2 incomplete and 2 completed schedules

**Steps:**
1. Navigate to dashboard
2. View calendar day with multiple schedules
3. Verify incomplete schedules appear before completed ones
4. Within each group, verify priority sorting (overdue > due > upcoming)

**Expected Results:**
- ✅ Incomplete schedules listed first
- ✅ Completed schedules listed last
- ✅ Within incomplete: sorted by priority (overdue, due, upcoming)
- ✅ Visual differentiation (completed schedules greyed out)

**Test Command:**
```javascript
mcp__playwright__browser_navigate({ url: "http://localhost:3000/dashboard" })
mcp__playwright__browser_snapshot()

// Click on a calendar day
mcp__playwright__browser_click({ selector: ".calendar-day:has(div.schedule-count)" })
mcp__playwright__browser_snapshot()

// Verify order in day card
```

---

## Validation Queries

### After Scenario 3 (Injection Metadata):

```sql
-- Verify metadata saved correctly
SELECT
  se.id,
  se.executed_date,
  se.metadata,
  se.metadata->>'dosage' as dosage,
  se.metadata->>'route' as route,
  se.metadata->>'notes' as notes
FROM schedule_executions se
WHERE se.executed_date = CURRENT_DATE
  AND se.metadata IS NOT NULL
ORDER BY se.created_at DESC
LIMIT 5;

-- Expected output:
-- {
--   "dosage": "10mg",
--   "route": "IV",
--   "notes": "Patient tolerated well"
-- }
```

### After Department Filter Test:

```sql
-- Verify departments exist for organization
SELECT
  d.id,
  d.name,
  d.organization_id,
  d.display_order,
  d.is_active
FROM departments d
WHERE d.is_active = true
ORDER BY d.display_order, d.name;
```

---

## Browser Cleanup Procedure

**Before tests:**
```bash
# Close any existing Playwright browsers
mcp__playwright__browser_close
```

**After each test:**
```bash
# Automatic cleanup via config.js (autoClose: true)
# Manual cleanup if needed:
mcp__playwright__browser_close
```

**Emergency cleanup:**
```bash
# Kill zombie processes
./kill-playwright.sh
# or
pkill -f "chrome.*playwright"
```

---

## Known Limitations

1. **Organization Policies UI:**
   - No admin UI found for setting auto_hold_overdue_days
   - Can be set via database directly for testing
   - Recommendation: Create `/admin/settings` page

2. **Auto-hold Edge Function:**
   - Cannot test via UI (runs on cron schedule)
   - Test manually via Supabase function invocation
   - Verify via audit_logs table

3. **Real-time Updates:**
   - May require page refresh to see changes
   - WebSocket connections should be verified separately

---

## Success Criteria

**Phase 1 Tests:**
- [x] Organization selection working in signup
- [x] Department filter dropdown functional
- [x] Profile displays org/department
- [x] Patient cards show doctor/department

**Phase 2 Tests:**
- [x] Departments API accessible (GET, POST, PUT, DELETE)
- [x] Organization isolation enforced
- [x] RLS policies prevent cross-org access

**Phase 3 Tests:**
- [x] Injection metadata form displays conditionally
- [x] Validation works (dosage format, route, notes length)
- [x] Metadata saves to JSONB column
- [x] Schedule sorting prioritizes incomplete

**Overall:**
- [ ] No JavaScript errors in console
- [ ] No network errors (check Network tab)
- [ ] Proper loading states
- [ ] Accessibility: keyboard navigation works
- [ ] Responsive: works on mobile viewport

---

## Execution Summary Template

```markdown
## Test Execution Results

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Browser:** Chrome (Playwright)
**Environment:** Development (localhost:3000)

### Scenario 1: Organization Selection
- Status: ✅ PASS / ❌ FAIL
- Notes:

### Scenario 2: Department Filter
- Status: ✅ PASS / ❌ FAIL
- Notes:

### Scenario 3: Injection Metadata
- Status: ✅ PASS / ❌ FAIL
- Notes:

### Scenario 4: Profile Display
- Status: ✅ PASS / ❌ FAIL
- Notes:

### Scenario 5: Schedule Sorting
- Status: ✅ PASS / ❌ FAIL
- Notes:

### Overall Result: PASS / FAIL

**Blockers:** None / [List issues]
**Recommendations:** [Any suggestions]
```

---

**Prepared by:** Claude Code
**Version:** 1.0
