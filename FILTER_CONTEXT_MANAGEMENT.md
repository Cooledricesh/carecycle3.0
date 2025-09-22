# 🎯 Role-Based Filter Context Management Implementation Guide

## 📋 Executive Summary

This document provides comprehensive recommendations for implementing complex filter state management across the medical scheduling application, with focus on role-based filtering, multi-tab synchronization, and session persistence.

## 🏗️ Architecture Overview

### Core Components

1. **FilterPersistence** (`/lib/filters/filter-persistence.ts`)
   - Multi-level storage hierarchy (URL → Session → Local)
   - BroadcastChannel API for multi-tab sync
   - Version migration system
   - State validation and sanitization

2. **RoleBasedFilterManager** (`/lib/filters/role-based-filters.ts`)
   - Role-specific filter initialization
   - View mode toggling (my/all)
   - Filter validation per role
   - Preset management

3. **FilterProviderEnhanced** (`/providers/filter-provider-enhanced.tsx`)
   - Orchestrates all filter operations
   - Optimistic updates with rollback
   - Debounced URL synchronization
   - Error recovery

4. **FilterRecoveryManager** (`/lib/filters/filter-recovery.ts`)
   - Handles edge cases and failures
   - Conflict resolution
   - Quota management
   - Retry queue

## 🔄 State Flow Diagram

```
User Action → FilterProvider → Validation
                ↓                    ↓
         Optimistic Update    (if invalid)
                ↓              Rollback
         URL Sync (debounced)
                ↓
         Storage Persistence
                ↓
         BroadcastChannel → Other Tabs
                ↓
         Query Invalidation
```

## 💾 Persistence Strategy

### Storage Hierarchy (Priority Order)

1. **URL Parameters** (Highest)
   - For sharing and bookmarking
   - Survives page refresh
   - Example: `?careTypes=외래,입원&showAll=false&viewMode=my`

2. **Session Storage**
   - Tab-specific state
   - Lost on tab close
   - Key: `filters_session_{role}_{userId}`

3. **Local Storage**
   - Cross-session persistence
   - 30-day expiry
   - Key: `filters_local_{role}_{userId}`

4. **Role-Based Defaults** (Lowest)
   - Fallback when no persisted state
   - Based on user role and context

### Multi-Tab Synchronization

```javascript
// Automatic sync using BroadcastChannel
const channel = new BroadcastChannel(`filters_sync_${userId}`)

// Sender tab
channel.postMessage({
  type: 'FILTER_CHANGE',
  filters: newFilters,
  timestamp: new Date().toISOString()
})

// Receiver tabs
channel.onmessage = (event) => {
  if (event.data.type === 'FILTER_CHANGE') {
    updateLocalFilters(event.data.filters)
    invalidateQueries()
  }
}
```

## 🎭 Role-Based Behavior

### Doctor Role
```typescript
// Default filters
{
  doctorId: userId,      // See only their patients
  showAll: false,        // Start with "my patients"
  viewMode: 'my',
  careTypes: []          // No care type filtering
}

// Toggle behavior
"내 환자" ↔ "전체 환자"
```

### Nurse Role
```typescript
// Default filters
{
  department: userCareType,  // See department patients
  careTypes: [userCareType], // Match their department
  showAll: false,           // Start with department view
  viewMode: 'my'
}

// Toggle behavior
"{부서} 환자" ↔ "전체 환자"
```

### Admin Role
```typescript
// Default filters
{
  showAll: true,         // Always see all
  viewMode: 'all',
  careTypes: []          // Full filter control
}

// No toggle - always see all
```

## 🚨 Edge Cases & Recovery

### 1. Storage Quota Exceeded
```typescript
// Automatic cleanup of old states
FilterRecoveryManager.handleQuotaExceeded()
// → Removes states older than 30 days
// → Compacts current state
```

### 2. Conflicting Multi-Tab Updates
```typescript
// Last-write-wins with intelligent merge
FilterRecoveryManager.resolveConflict(local, remote)
// → Single values: Use remote (newer)
// → Arrays: Union of both
// → User settings: Keep local
```

### 3. Role Change Mid-Session
```typescript
// Clear role-specific filters
FilterRecoveryManager.handleRoleChange(oldRole, newRole)
// → Reset to new role defaults
// → Clear storage
// → Notify user
```

### 4. Corrupted State Recovery
```typescript
// Salvage valid fields or reset
FilterRecoveryManager.recoverFromCorruption(corrupted)
// → Extract valid fields
// → Validate recovered state
// → Fallback to defaults if needed
```

### 5. Network Sync Failure
```typescript
// Queue for retry with exponential backoff
FilterRecoveryManager.recoverFromSyncFailure(filters)
// → Add to retry queue
// → Process queue on reconnection
// → Max 3 attempts
```

## 🔧 Implementation Steps

### Phase 1: Core Infrastructure (2 hours)
1. ✅ Implement FilterPersistence class
2. ✅ Implement RoleBasedFilterManager
3. ✅ Create FilterProviderEnhanced
4. ✅ Add FilterRecoveryManager

### Phase 2: Integration (1 hour)
1. Replace FilterProvider with FilterProviderEnhanced
2. Update filter-types.ts with new fields
3. Modify service layer to respect showAll flag
4. Update UI components

### Phase 3: Testing (1 hour)
1. Test multi-tab synchronization
2. Test role-based initialization
3. Test persistence across sessions
4. Test edge case recovery

### Phase 4: UI Polish (30 minutes)
1. Add loading states during sync
2. Show sync indicators
3. Add filter summary text
4. Implement preset quick selections

## 🎯 Key Implementation Decisions

### 1. Optimistic Updates
- **Why**: Instant UI feedback
- **Implementation**: Apply changes immediately, rollback on error
- **Trade-off**: Complexity vs UX

### 2. Debounced URL Sync
- **Why**: Prevent history spam
- **Implementation**: 300ms debounce
- **Trade-off**: Slight delay vs performance

### 3. BroadcastChannel API
- **Why**: Native browser API for multi-tab communication
- **Implementation**: Automatic with fallback
- **Trade-off**: Browser support (93%+)

### 4. Version Migration
- **Why**: Handle schema changes gracefully
- **Implementation**: Semantic versioning with migration functions
- **Trade-off**: Complexity vs future-proofing

### 5. Role-Based Defaults
- **Why**: Smart initial state per user type
- **Implementation**: Factory pattern based on role
- **Trade-off**: Customization vs simplicity

## 📊 Performance Considerations

### Query Invalidation Strategy
```typescript
// Specific invalidation instead of global
queryClient.invalidateQueries({
  queryKey: ['schedules', userId, filters]
})
```

### Debouncing
- URL sync: 300ms
- Storage persistence: Immediate
- Query invalidation: 500ms

### Caching
- Filter state: 5 minutes stale time
- User profile: 10 minutes
- Presets: Static (no refetch)

## 🔐 Security Considerations

1. **User Context Validation**
   - Always validate userId matches auth
   - Sanitize filter inputs
   - Validate role permissions

2. **Storage Security**
   - No sensitive data in localStorage
   - User-scoped storage keys
   - Clear on logout

3. **URL Parameter Sanitization**
   - Whitelist allowed parameters
   - Validate enum values
   - Escape special characters

## 📈 Monitoring & Analytics

### Key Metrics to Track
1. Filter change frequency
2. Most used filter combinations
3. Sync failures and recovery success rate
4. Storage quota usage
5. Multi-tab sync latency

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('DEBUG_FILTERS', 'true')

// Export current state
filterProvider.exportFilterState()
```

## 🚀 Migration Path

### From Current to Enhanced System

1. **Backward Compatibility**
   - Read old filter format
   - Auto-migrate on first load
   - Preserve URL parameters

2. **Gradual Rollout**
   - Feature flag for enhanced provider
   - A/B testing with subset of users
   - Monitor error rates

3. **Rollback Plan**
   - Keep old provider code
   - Feature flag to disable
   - Clear enhanced storage keys

## 📝 Testing Checklist

### Unit Tests
- [ ] Filter validation logic
- [ ] Role-based initialization
- [ ] Storage operations
- [ ] Migration functions
- [ ] Recovery strategies

### Integration Tests
- [ ] Multi-tab synchronization
- [ ] URL parameter sync
- [ ] Storage persistence
- [ ] Query invalidation
- [ ] Role switching

### E2E Tests
- [ ] Doctor workflow
- [ ] Nurse workflow
- [ ] Admin workflow
- [ ] Multi-tab scenarios
- [ ] Session recovery

## 🎉 Benefits of This Architecture

1. **Seamless User Experience**
   - Filters persist across sessions
   - Instant synchronization between tabs
   - Smart defaults based on role

2. **Developer Experience**
   - Clean separation of concerns
   - Comprehensive error recovery
   - Easy to extend and maintain

3. **Performance**
   - Optimistic updates for instant feedback
   - Efficient query invalidation
   - Debounced expensive operations

4. **Reliability**
   - Automatic recovery from failures
   - Conflict resolution
   - Version migration support

5. **Flexibility**
   - Easy to add new filter types
   - Role-specific customization
   - Progressive enhancement

## 📚 Additional Resources

- [BroadcastChannel API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
- [Web Storage API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [URL API MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL)
- [React Query Optimistic Updates](https://tanstack.com/query/latest/docs/guides/optimistic-updates)

## 🤝 Support

For questions or issues with the filter system:
1. Check debug logs: `localStorage.getItem('DEBUG_FILTERS')`
2. Export current state: `filterProvider.exportFilterState()`
3. Review recovery logs in console
4. Contact: [Development Team]

---

*Last Updated: 2025-09-21*
*Version: 1.0.0*