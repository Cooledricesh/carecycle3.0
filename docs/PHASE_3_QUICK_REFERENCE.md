# Phase 3 Quick Reference Guide

**For**: Developers implementing multitenancy data isolation
**Time to Read**: 2 minutes

---

## 🎯 What You're Doing

Adding `organizationId` parameter to all schedule-related services, hooks, and components to ensure data isolation between organizations.

---

## 📋 Checklist

### Services (2 files)

- [ ] `/src/services/scheduleService.ts` - Update 18 methods
  - [ ] Add `organizationId` parameter to all methods
  - [ ] Add `.eq('organization_id', organizationId)` to all queries

- [ ] `/src/services/scheduleServiceEnhanced.ts` - Update 3 methods
  - [ ] Add `organizationId` to `UserContext` type
  - [ ] Filter queries by organization_id

### Hooks (8 files)

- [ ] `/src/hooks/useSchedules.ts`
- [ ] `/src/hooks/usePatients.ts` (verify completeness)
- [ ] `/src/hooks/useCalendarSchedules.ts`
- [ ] `/src/hooks/useFilterStatistics.ts`
- [ ] `/src/hooks/useScheduleState.ts`
- [ ] `/src/hooks/useFilteredSchedules.ts`
- [ ] `/src/hooks/useScheduleCompletion.ts`
- [ ] `/src/hooks/useItemMutations.ts`

**Pattern for All Hooks**:
```typescript
import { useProfile } from '@/hooks/useProfile'

const { data: profile } = useProfile()

useQuery({
  queryKey: ['resource', profile?.organization_id, ...],
  queryFn: () => service.method(profile!.organization_id, ...),
  enabled: !!profile?.organization_id
})
```

### Components (5 files)

- [ ] `/src/app/(protected)/dashboard/schedules/page.tsx`
- [ ] `/src/app/(protected)/dashboard/dashboard-content.tsx`
- [ ] `/src/components/schedules/schedule-create-modal.tsx`
- [ ] `/src/components/schedules/schedule-edit-modal.tsx`
- [ ] `/src/components/calendar/calendar-view.tsx`

**Pattern**: Use hooks (preferred), or pass `profile.organization_id` to direct service calls

### Database (if needed)

- [ ] Update `get_calendar_schedules` RPC to accept `p_organization_id`
- [ ] Update `get_filter_statistics` RPC to accept `p_organization_id`

---

## 🔧 Copy-Paste Patterns

### Service Method Signature

```typescript
// BEFORE:
async methodName(param1, supabase?: SupabaseClient)

// AFTER:
async methodName(param1, organizationId: string, supabase?: SupabaseClient)
```

### Database Query Filter

```typescript
// Add to every query:
.eq('organization_id', organizationId)
```

### Hook Implementation

```typescript
import { useProfile } from '@/hooks/useProfile'

export function useMyHook() {
  const { data: profile } = useProfile()

  return useQuery({
    queryKey: ['myResource', profile?.organization_id],
    queryFn: () => {
      if (!profile?.organization_id) throw new Error('Organization ID not available')
      return myService.myMethod(profile.organization_id)
    },
    enabled: !!profile?.organization_id
  })
}
```

### Component Usage

```typescript
// Preferred: Use hooks
const { data } = useSchedules()

// If direct call is needed:
const { data: profile } = useProfile()
await scheduleService.create(input, profile!.organization_id)
```

---

## ✅ Validation Commands

```bash
# Run these after each section:
npm run lint
npx tsc --noEmit

# If errors, fix before continuing
```

---

## 🚨 Common Mistakes

1. ❌ Forgetting `.eq('organization_id', organizationId)` in queries
2. ❌ Not adding `organizationId` to query keys
3. ❌ Missing `enabled: !!profile?.organization_id` in hooks
4. ❌ Not updating RPC function calls with new parameter

---

## 📚 Full Details

See `/docs/PHASE_3_IMPLEMENTATION_SPEC.md` for complete method-by-method guide.

---

## 🎉 Done Criteria

- All services have `organizationId` parameter ✅
- All queries filter by `organization_id` ✅
- All hooks pass `organizationId` from `useAuth()` ✅
- All query keys include `organizationId` ✅
- `npm run lint` passes ✅
- `npx tsc --noEmit` passes ✅
- Manual test confirms data isolation ✅
