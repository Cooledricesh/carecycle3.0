# Phase 3: Data Isolation Implementation Specification

**Created**: 2025-01-07
**Status**: Ready for Implementation
**Estimated Effort**: 3-4 hours for experienced developer

## 📋 Overview

This document provides a complete, step-by-step guide to completing Phase 3 of the multitenancy implementation. Follow this guide to update all services, hooks, and components to properly filter data by `organization_id`.

---

## 🎯 Implementation Goals

1. **Add `organizationId` parameter** to all `scheduleService` and `scheduleServiceEnhanced` methods
2. **Filter all database queries** by `organization_id`
3. **Update all hooks** to pass `organizationId` from `useAuth().profile.organization_id`
4. **Update all components** to use new service signatures
5. **Update React Query keys** to include `organizationId`
6. **Validate** that no data leaks across organizations

---

## 📚 Reference Pattern

The `patientService.ts` has been successfully updated and serves as the reference implementation. Use this pattern for all changes:

```typescript
// ✅ CORRECT PATTERN (from patientService.ts):

async getAll(
  organizationId: string,              // ← Required parameter
  supabase?: SupabaseClient,
  userContext?: { ... }
): Promise<Patient[]> {
  const client = supabase || createClient()

  const { data } = await client
    .from('patients')
    .select('*')
    .eq('is_active', true)
    .eq('organization_id', organizationId)  // ← Filter by organization

  return data
}
```

---

## 🔧 Part 1: Update scheduleService.ts (18 methods)

**File**: `/src/services/scheduleService.ts`

### Method-by-Method Changes

#### 1. `create()`

**BEFORE**:
```typescript
async create(input: ScheduleCreateInput, supabase?: SupabaseClient): Promise<Schedule>
```

**AFTER**:
```typescript
async create(input: ScheduleCreateInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule>
```

**Changes Required**:
```typescript
// In existence check (line ~29):
const { data: existingSchedule } = await client
  .from('schedules')
  .select('id')
  .eq('patient_id', validated.patientId)
  .eq('item_id', validated.itemId)
  .eq('status', 'active')
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .maybeSingle()

// In insert (line ~59):
const { data, error } = await (client as any)
  .from('schedules')
  .insert({
    ...snakeData,
    next_due_date: nextDueDate,
    status: 'active',
    organization_id: organizationId  // ← ADD THIS LINE
  })
```

---

#### 2. `createWithCustomItem()`

**BEFORE**:
```typescript
async createWithCustomItem(input: ScheduleCreateWithCustomItemInput, supabase?: SupabaseClient): Promise<Schedule>
```

**AFTER**:
```typescript
async createWithCustomItem(input: ScheduleCreateWithCustomItemInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule>
```

**Changes Required**:
```typescript
// In existence check (line ~140):
const { data: existingSchedule } = await client
  .from('schedules')
  .select('id')
  .eq('patient_id', validatedInput.patientId)
  .eq('item_id', itemId)
  .eq('status', 'active')
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .maybeSingle()

// In insert (line ~165):
const { data, error } = await (client as any)
  .from('schedules')
  .insert({
    patient_id: validatedInput.patientId,
    item_id: itemId,
    interval_weeks: validatedInput.intervalWeeks,
    start_date: validatedInput.startDate,
    next_due_date: validatedInput.nextDueDate,
    status: 'active',
    organization_id: organizationId,  // ← ADD THIS LINE
    notes: validatedInput.notes,
    priority: 0,
    requires_notification: true,
    notification_days_before: validatedInput.notificationDaysBefore ?? 7,
    created_by: userId,
    assigned_nurse_id: userId
  })
```

---

#### 3. `getTodayChecklist()`

**BEFORE**:
```typescript
async getTodayChecklist(filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**AFTER**:
```typescript
async getTodayChecklist(organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**Changes Required**:
```typescript
// In query (line ~232):
const { data, error } = await client
  .from('schedules')
  .select(`
    *,
    patients (*),
    items (*)
  `)
  .eq('status', 'active')
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .lte('next_due_date', today)
  .order('priority', { ascending: false })
  .order('next_due_date', { ascending: true })
```

---

#### 4. `getUpcomingSchedules()`

**BEFORE**:
```typescript
async getUpcomingSchedules(daysAhead: number = 7, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**AFTER**:
```typescript
async getUpcomingSchedules(daysAhead: number = 7, organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**Changes Required**:
```typescript
// In query (line ~321):
const { data, error } = await client
  .from('schedules')
  .select(`
    *,
    patients (*),
    items (*)
  `)
  .eq('status', 'active')
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .gte('next_due_date', pastDate)
  .lte('next_due_date', futureDate)
  .order('next_due_date', { ascending: true })
```

---

#### 5. `getByPatientId()`

**BEFORE**:
```typescript
async getByPatientId(patientId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**AFTER**:
```typescript
async getByPatientId(patientId: string, organizationId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**Changes Required**:
```typescript
// In query (line ~401):
const { data, error } = await client
  .from('schedules')
  .select(`
    *,
    patients (*),
    items (*)
  `)
  .eq('patient_id', patientId)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .order('next_due_date', { ascending: true })
```

---

#### 6. `getById()`

**BEFORE**:
```typescript
async getById(id: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails | null>
```

**AFTER**:
```typescript
async getById(id: string, organizationId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails | null>
```

**Changes Required**:
```typescript
// In query (line ~430):
const { data, error } = await client
  .from('schedules')
  .select(`
    *,
    patients (*),
    items (*)
  `)
  .eq('id', id)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .single()
```

---

#### 7. `update()`

**BEFORE**:
```typescript
async update(id: string, input: ScheduleUpdateInput, supabase?: SupabaseClient): Promise<Schedule>
```

**AFTER**:
```typescript
async update(id: string, input: ScheduleUpdateInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule>
```

**Changes Required**:
```typescript
// In query (line ~464):
const { data, error } = await client
  .from('schedules')
  .update(snakeData)
  .eq('id', id)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .select()
  .single()
```

---

#### 8. `updateStatus()`

**BEFORE**:
```typescript
async updateStatus(id: string, status: 'active' | 'paused' | 'completed' | 'cancelled', supabase?: SupabaseClient): Promise<void>
```

**AFTER**:
```typescript
async updateStatus(id: string, status: 'active' | 'paused' | 'completed' | 'cancelled', organizationId: string, supabase?: SupabaseClient): Promise<void>
```

**Changes Required**:
```typescript
// In schedule fetch (line ~488):
const { data: schedule, error: fetchError } = await client
  .from('schedules')
  .select('*')
  .eq('id', id)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .single()

// In status update (line ~517):
const { error } = await client
  .from('schedules')
  .update({ status })
  .eq('id', id)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
```

---

#### 9. `pauseSchedule()`

**BEFORE**:
```typescript
async pauseSchedule(id: string, options?: { reason?: string; notifyAssignedNurse?: boolean }, supabase?: SupabaseClient): Promise<void>
```

**AFTER**:
```typescript
async pauseSchedule(id: string, organizationId: string, options?: { reason?: string; notifyAssignedNurse?: boolean }, supabase?: SupabaseClient): Promise<void>
```

**Changes Required**:
Pass `organizationId` to `stateManager.pauseSchedule()` if the manager supports it, or add validation check:
```typescript
// Add validation before pausing:
const schedule = await this.getById(id, organizationId, client)
if (!schedule) throw new Error('스케줄을 찾을 수 없습니다')

await stateManager.pauseSchedule(id, options)
```

---

#### 10. `resumeSchedule()`

**BEFORE**:
```typescript
async resumeSchedule(id: string, options: { ... }, supabase?: SupabaseClient): Promise<void>
```

**AFTER**:
```typescript
async resumeSchedule(id: string, organizationId: string, options: { ... }, supabase?: SupabaseClient): Promise<void>
```

**Changes Required**:
Same pattern as `pauseSchedule()`:
```typescript
const schedule = await this.getById(id, organizationId, client)
if (!schedule) throw new Error('스케줄을 찾을 수 없습니다')

await stateManager.resumeSchedule(id, options)
```

---

#### 11. `delete()`

**BEFORE**:
```typescript
async delete(id: string, supabase?: SupabaseClient): Promise<void>
```

**AFTER**:
```typescript
async delete(id: string, organizationId: string, supabase?: SupabaseClient): Promise<void>
```

**Changes Required**:
```typescript
// In query (line ~557):
const { error } = await client
  .from('schedules')
  .update({ status: 'cancelled' })
  .eq('id', id)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
```

---

#### 12. `getOverdueSchedules()`

**BEFORE**:
```typescript
async getOverdueSchedules(supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**AFTER**:
```typescript
async getOverdueSchedules(organizationId: string, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**Changes Required**:
```typescript
// In query (line ~574):
const { data, error } = await client
  .from('schedules')
  .select(`
    *,
    patients (*),
    items (*)
  `)
  .eq('status', 'active')
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .lt('next_due_date', today)
  .order('next_due_date', { ascending: true })
```

---

#### 13. `getAllSchedules()`

**BEFORE**:
```typescript
async getAllSchedules(filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**AFTER**:
```typescript
async getAllSchedules(organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**Changes Required**:
```typescript
// In query (line ~608):
let query = client
  .from('schedules')
  .select(`
    *,
    patients (*),
    items (*)
  `)
  .in('status', ['active', 'paused'])
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
```

---

#### 14. `editSchedule()`

**BEFORE**:
```typescript
async editSchedule(scheduleId: string, input: ScheduleEditInput, supabase?: SupabaseClient): Promise<Schedule>
```

**AFTER**:
```typescript
async editSchedule(scheduleId: string, input: ScheduleEditInput, organizationId: string, supabase?: SupabaseClient): Promise<Schedule>
```

**Changes Required**:
```typescript
// In schedule fetch (line ~739):
const { data: currentSchedule, error: fetchError } = await client
  .from('schedules')
  .select('start_date')
  .eq('id', scheduleId)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .single()

// In update (line ~840):
const { data, error } = await client
  .from('schedules')
  .update(updateData)
  .eq('id', scheduleId)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .select()
  .single()
```

---

#### 15. `markAsCompleted()`

**BEFORE**:
```typescript
async markAsCompleted(scheduleId: string, input: { ... }, supabase?: SupabaseClient): Promise<void>
```

**AFTER**:
```typescript
async markAsCompleted(scheduleId: string, input: { ... }, organizationId: string, supabase?: SupabaseClient): Promise<void>
```

**Changes Required**:
```typescript
// In schedule fetch (line ~890):
const { data: schedule, error: scheduleError } = await client
  .from('schedules')
  .select('*, items(*)')
  .eq('id', scheduleId)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
  .single()

// In update (line ~986):
const { error: updateError } = await client
  .from('schedules')
  .update({
    next_due_date: format(nextDueDate, 'yyyy-MM-dd'),
    last_executed_date: input.executedDate
  })
  .eq('id', scheduleId)
  .eq('organization_id', organizationId)  // ← ADD THIS LINE
```

---

#### 16. `getCalendarSchedules()`

**BEFORE**:
```typescript
async getCalendarSchedules(startDate: string, endDate: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**AFTER**:
```typescript
async getCalendarSchedules(startDate: string, endDate: string, organizationId: string, filters?: ScheduleFilter, supabase?: SupabaseClient): Promise<ScheduleWithDetails[]>
```

**Changes Required**:
```typescript
// Update RPC call (line ~1009):
const { data, error } = await client.rpc('get_calendar_schedules', {
  p_start_date: startDate,
  p_end_date: endDate,
  p_organization_id: organizationId,  // ← ADD THIS LINE
  p_user_id: null
})
```

**⚠️ NOTE**: You may need to update the database RPC function `get_calendar_schedules` to accept and filter by `p_organization_id`. Check if migration is needed.

---

## 🔧 Part 2: Update scheduleServiceEnhanced.ts (3 methods)

**File**: `/src/services/scheduleServiceEnhanced.ts`

### Method 1: `getFilteredSchedules()`

**BEFORE**:
```typescript
async getFilteredSchedules(
  filters: FilterOptions,
  userContext: UserContext,
  supabase?: SupabaseClient<Database>
): Promise<{ ... }>
```

**AFTER**:
```typescript
async getFilteredSchedules(
  filters: FilterOptions,
  userContext: UserContext & { organizationId: string },  // ← Add organizationId to UserContext
  supabase?: SupabaseClient<Database>
): Promise<{ ... }>
```

**Changes Required**:
```typescript
// The FilterStrategyFactory.create() should pass organizationId to strategies
// Each strategy's buildQuery() should filter by organization_id

// Example for direct query (not RPC):
// If the strategy uses direct query, add:
.eq('organization_id', userContext.organizationId)
```

**⚠️ NOTE**: This method uses `FilterStrategyFactory` which may need updates. Check `/src/services/filters/` directory for strategy implementations.

---

### Method 2: `getTodayChecklist()`

**BEFORE**:
```typescript
async getTodayChecklist(
  showAll: boolean,
  userContext: UserContext,
  supabase?: SupabaseClient<Database>
): Promise<any[]>
```

**AFTER**:
```typescript
async getTodayChecklist(
  showAll: boolean,
  userContext: UserContext & { organizationId: string },
  supabase?: SupabaseClient<Database>
): Promise<any[]>
```

**Changes Required**:
```typescript
// In query (line ~253):
let query = client
  .from('schedules')
  .select(`
    id,
    patient_id,
    item_id,
    next_due_date,
    interval_weeks,
    notes,
    status,
    created_at,
    updated_at,
    patients!inner (
      id,
      name,
      care_type,
      doctor_id,
      patient_number
    ),
    items!inner (
      id,
      name,
      category
    )
  `)
  .lte('next_due_date', today)
  .eq('status', 'active')
  .eq('organization_id', userContext.organizationId)  // ← ADD THIS LINE
```

---

### Method 3: `getFilterStatistics()`

**BEFORE**:
```typescript
async getFilterStatistics(
  userContext: UserContext,
  supabase?: SupabaseClient<Database>
): Promise<FilterStatistics | null>
```

**AFTER**:
```typescript
async getFilterStatistics(
  userContext: UserContext & { organizationId: string },
  supabase?: SupabaseClient<Database>
): Promise<FilterStatistics | null>
```

**Changes Required**:
```typescript
// Update RPC call (line ~401):
const { data, error } = await client.rpc('get_filter_statistics', {
  p_user_id: userContext.userId,
  p_organization_id: userContext.organizationId  // ← ADD THIS LINE
})
```

**⚠️ NOTE**: The database RPC function `get_filter_statistics` may need to be updated to accept `p_organization_id`. Check if migration is needed.

---

## 🎣 Part 3: Update Hooks (8 files)

All hooks follow the same pattern: Import `useAuth()`, extract `profile.organization_id`, pass to service methods, and include in query keys.

### Hook 1: `/src/hooks/useSchedules.ts`

**Pattern to Apply**:
```typescript
import { useAuth } from '@/providers/auth-provider-simple'
import { scheduleService } from '@/services/scheduleService'

export function useSchedules() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['schedules', profile?.organization_id],  // ← Add org ID
    queryFn: () => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return scheduleService.getTodayChecklist(profile.organization_id)  // ← Pass org ID
    },
    enabled: !!profile?.organization_id  // ← Don't run without org
  })
}

export function useScheduleMutation() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ScheduleCreateInput) => {
      if (!profile?.organization_id) {
        throw new Error('Organization ID not available')
      }
      return scheduleService.create(input, profile.organization_id)  // ← Pass org ID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules', profile?.organization_id] })  // ← Include org ID
    }
  })
}
```

---

### Hook 2: `/src/hooks/usePatients.ts`

**Status**: ✅ Already partially updated

**Verification Needed**: Check if all queries include `profile.organization_id` and all query keys have organization ID.

---

### Hook 3: `/src/hooks/useCalendarSchedules.ts`

**Apply Pattern**:
```typescript
const { profile } = useAuth()

return useQuery({
  queryKey: ['calendar', profile?.organization_id, startDate, endDate],
  queryFn: () => {
    if (!profile?.organization_id) throw new Error('Organization ID not available')
    return scheduleService.getCalendarSchedules(startDate, endDate, profile.organization_id)
  },
  enabled: !!profile?.organization_id
})
```

---

### Hook 4: `/src/hooks/useFilterStatistics.ts`

**Apply Pattern**:
```typescript
const { profile } = useAuth()

return useQuery({
  queryKey: ['filterStats', profile?.organization_id, profile?.id],
  queryFn: () => {
    if (!profile?.organization_id || !profile?.id) throw new Error('Context not available')
    return scheduleServiceEnhanced.getFilterStatistics({
      userId: profile.id,
      role: profile.role,
      careType: profile.care_type,
      organizationId: profile.organization_id
    })
  },
  enabled: !!(profile?.organization_id && profile?.id)
})
```

---

### Hook 5-8: Similar Pattern

Apply the same pattern to:
- `/src/hooks/useScheduleState.ts`
- `/src/hooks/useFilteredSchedules.ts`
- `/src/hooks/useScheduleCompletion.ts`
- `/src/hooks/useItemMutations.ts`

---

## 🧩 Part 4: Update Components (5 files)

Most components should use hooks (which already handle `organizationId`). Only update components that make direct service calls.

### Component 1: `/src/app/(protected)/dashboard/schedules/page.tsx`

**Check for**:
- Direct `scheduleService.*` calls
- If using hooks, verify hooks are updated

**Pattern**:
```typescript
const { profile } = useAuth()

// If direct call:
const handleCreate = async (input: ScheduleCreateInput) => {
  if (!profile?.organization_id) return
  await scheduleService.create(input, profile.organization_id)
}
```

---

### Component 2-5: Similar Approach

Check and update:
- `/src/app/(protected)/dashboard/dashboard-content.tsx`
- `/src/components/schedules/schedule-create-modal.tsx`
- `/src/components/schedules/schedule-edit-modal.tsx`
- `/src/components/calendar/calendar-view.tsx`

---

## ✅ Part 5: Validation Checklist

After implementation, verify:

### Service Layer
- [ ] All `scheduleService` methods have `organizationId` parameter (18 methods)
- [ ] All `scheduleServiceEnhanced` methods have `organizationId` in `userContext` (3 methods)
- [ ] All database queries include `.eq('organization_id', organizationId)`
- [ ] All RPC function calls pass `p_organization_id`

### Hooks Layer
- [ ] All hooks import `useAuth()`
- [ ] All hooks extract `profile.organization_id`
- [ ] All hooks pass `organizationId` to service methods
- [ ] All query keys include `organizationId`
- [ ] All hooks have `enabled: !!profile?.organization_id`

### Component Layer
- [ ] Components use hooks (preferred)
- [ ] Direct service calls pass `profile.organization_id`
- [ ] No hardcoded organization IDs

### Testing
- [ ] `npm run lint` passes (no new errors)
- [ ] `npx tsc --noEmit` passes (no new errors)
- [ ] Manual test: Create data in Org A, verify Org B cannot see it
- [ ] Manual test: Switch between organizations, verify correct data shows

---

## 🚨 Database Migration Check

**Required Database Changes**:

1. **RPC Function**: `get_calendar_schedules`
   - Add parameter: `p_organization_id uuid`
   - Add filter: `WHERE s.organization_id = p_organization_id`

2. **RPC Function**: `get_filter_statistics`
   - Add parameter: `p_organization_id uuid`
   - Add filter to all subqueries: `WHERE organization_id = p_organization_id`

3. **Verify All Tables Have `organization_id`**:
   - `schedules` ✅ (should already exist from Phase 1)
   - `schedule_executions` ✅ (should already exist)
   - `items` ✅ (should already exist)
   - `patients` ✅ (should already exist)

---

## 📝 Implementation Order

**Recommended sequence**:

1. **Day 1: Services** (2-3 hours)
   - Update `scheduleService.ts` (18 methods)
   - Update `scheduleServiceEnhanced.ts` (3 methods)
   - Run `npm run lint` and `npx tsc --noEmit`

2. **Day 1-2: Hooks** (1 hour)
   - Update all 8 hooks
   - Test with lint and type check

3. **Day 2: Components** (1 hour)
   - Update 5 components
   - Test with lint and type check

4. **Day 2: Database** (30 mins)
   - Update RPC functions if needed
   - Test queries manually

5. **Day 2: Validation** (30 mins)
   - Complete checklist above
   - Manual testing with multiple organizations

---

## 🐛 Common Pitfalls

1. **Forgetting to add filter to existence checks**
   - Duplicate checks MUST filter by organization_id
   - Example: checking for existing schedule before creating

2. **RPC functions not updated**
   - All RPC calls need `p_organization_id` parameter
   - Database functions must accept and use the parameter

3. **Query keys missing organizationId**
   - This causes cache pollution between organizations
   - Always include: `['resource', organizationId, ...]`

4. **Missing enabled guard**
   - Hooks should have: `enabled: !!profile?.organization_id`
   - Prevents queries from running without organization context

5. **Hard-coded organization IDs**
   - Never use hard-coded UUIDs
   - Always derive from `useAuth().profile.organization_id`

---

## 📚 Additional Resources

- Reference Implementation: `/src/services/patientService.ts`
- Auth Context: `/src/providers/auth-provider-simple.tsx`
- Database Schema: `/docs/db/dbschema.md`
- Implementation Status: `/MULTITENANCY_IMPLEMENTATION_STATUS.md`

---

## 🎉 Success Criteria

**Phase 3 is complete when**:

1. All 18 `scheduleService` methods filter by `organization_id` ✅
2. All 3 `scheduleServiceEnhanced` methods filter by `organization_id` ✅
3. All 8 hooks pass `organizationId` from `useAuth()` ✅
4. All 5 components use updated signatures ✅
5. `npm run lint` passes with no new errors ✅
6. `npx tsc --noEmit` passes with no new errors ✅
7. Manual testing confirms data isolation ✅

---

**Document Version**: 1.0
**Last Updated**: 2025-01-07
**Next Phase**: Phase 4 - Testing & Validation
