import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FilterPersistence } from '../filter-persistence'
import type { ScheduleFilter } from '../filter-types'

// Mock browser APIs
const createMockStorage = () => {
  const storage: Record<string, string> = {}
  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value
    },
    removeItem: (key: string) => {
      delete storage[key]
    },
    clear: () => {
      Object.keys(storage).forEach(key => delete storage[key])
    }
  }
}

describe('FilterPersistence', () => {
  let persistence: FilterPersistence
  let mockSessionStorage: ReturnType<typeof createMockStorage>
  let mockLocalStorage: ReturnType<typeof createMockStorage>

  const testUserId = 'user-123'
  const testUserRole = 'doctor'

  const sampleFilter: ScheduleFilter = {
    careTypes: ['외래', '입원'],
    doctorId: 'doctor-1',
    department: null,
    dateRange: null,
    includeInactive: false,
    showAll: false,
    viewMode: 'my'
  }

  beforeEach(() => {
    // Setup mock storage
    mockSessionStorage = createMockStorage()
    mockLocalStorage = createMockStorage()

    // Mock global storage objects
    global.sessionStorage = mockSessionStorage as any
    global.localStorage = mockLocalStorage as any

    // Mock BroadcastChannel as a class
    class MockBroadcastChannel {
      public postMessage = vi.fn()
      public addEventListener = vi.fn()
      public removeEventListener = vi.fn()
      public close = vi.fn()
      public name: string

      constructor(name: string) {
        this.name = name
      }
    }

    global.BroadcastChannel = MockBroadcastChannel as any

    persistence = new FilterPersistence(testUserId, testUserRole)
  })

  afterEach(() => {
    persistence.destroy()
    mockSessionStorage.clear()
    mockLocalStorage.clear()
  })

  describe('saveFilters', () => {
    it('should save filters to both session and local storage', async () => {
      // Act
      await persistence.saveFilters(sampleFilter)

      // Assert
      const sessionKey = `filters_session_${testUserRole}_${testUserId}`
      const localKey = `filters_local_${testUserRole}_${testUserId}`

      expect(mockSessionStorage.getItem(sessionKey)).toBeTruthy()
      expect(mockLocalStorage.getItem(localKey)).toBeTruthy()
    })

    it('should include version and timestamp in saved data', async () => {
      // Act
      await persistence.saveFilters(sampleFilter)

      // Assert
      const localKey = `filters_local_${testUserRole}_${testUserId}`
      const saved = JSON.parse(mockLocalStorage.getItem(localKey)!)

      expect(saved.version).toBe('v1.0.0')
      expect(saved.timestamp).toBeTruthy()
      expect(new Date(saved.timestamp)).toBeInstanceOf(Date)
    })

    it('should save filter data correctly', async () => {
      // Act
      await persistence.saveFilters(sampleFilter)

      // Assert
      const localKey = `filters_local_${testUserRole}_${testUserId}`
      const saved = JSON.parse(mockLocalStorage.getItem(localKey)!)

      expect(saved.filters).toEqual(sampleFilter)
    })

    it('should include metadata with modifiedBy', async () => {
      // Act
      await persistence.saveFilters(sampleFilter, { modifiedBy: 'system' })

      // Assert
      const localKey = `filters_local_${testUserRole}_${testUserId}`
      const saved = JSON.parse(mockLocalStorage.getItem(localKey)!)

      expect(saved.metadata.lastModifiedBy).toBe('system')
      expect(saved.metadata.syncedAt).toBeTruthy()
    })

    it('should skip session storage when skipSession option is true', async () => {
      // Act
      await persistence.saveFilters(sampleFilter, { skipSession: true })

      // Assert
      const sessionKey = `filters_session_${testUserRole}_${testUserId}`
      const localKey = `filters_local_${testUserRole}_${testUserId}`

      expect(mockSessionStorage.getItem(sessionKey)).toBeNull()
      expect(mockLocalStorage.getItem(localKey)).toBeTruthy()
    })

    it('should skip local storage when skipLocal option is true', async () => {
      // Act
      await persistence.saveFilters(sampleFilter, { skipLocal: true })

      // Assert
      const sessionKey = `filters_session_${testUserRole}_${testUserId}`
      const localKey = `filters_local_${testUserRole}_${testUserId}`

      expect(mockSessionStorage.getItem(sessionKey)).toBeTruthy()
      expect(mockLocalStorage.getItem(localKey)).toBeNull()
    })
  })

  describe('loadFilters', () => {
    it('should load filters from session storage when preferSession is true', async () => {
      // Arrange: Save to both storages
      await persistence.saveFilters(sampleFilter)

      // Act
      const loaded = await persistence.loadFilters({ preferSession: true })

      // Assert
      expect(loaded).toEqual(sampleFilter)
    })

    it('should load filters from local storage when session is empty', async () => {
      // Arrange: Save only to local storage
      await persistence.saveFilters(sampleFilter, { skipSession: true })

      // Act
      const loaded = await persistence.loadFilters()

      // Assert
      expect(loaded).toEqual(sampleFilter)
    })

    it('should return null when no filters are saved', async () => {
      // Act
      const loaded = await persistence.loadFilters()

      // Assert
      expect(loaded).toBeNull()
    })

    it('should return null for stale filters (older than 30 days)', async () => {
      // Arrange: Create old timestamp (31 days ago)
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 31)

      const staleData = {
        version: 'v1.0.0',
        timestamp: oldDate.toISOString(),
        filters: sampleFilter
      }

      const localKey = `filters_local_${testUserRole}_${testUserId}`
      mockLocalStorage.setItem(localKey, JSON.stringify(staleData))

      // Act
      const loaded = await persistence.loadFilters()

      // Assert
      expect(loaded).toBeNull()
    })

    it('should validate data with schema before returning', async () => {
      // Arrange: Invalid data (missing required fields)
      const invalidData = {
        version: 'v1.0.0',
        timestamp: new Date().toISOString(),
        filters: {
          careTypes: 'invalid' // Should be array
        }
      }

      const localKey = `filters_local_${testUserRole}_${testUserId}`
      mockLocalStorage.setItem(localKey, JSON.stringify(invalidData))

      // Act
      const loaded = await persistence.loadFilters()

      // Assert
      expect(loaded).toBeNull()
    })
  })

  describe('clearFilters', () => {
    beforeEach(async () => {
      await persistence.saveFilters(sampleFilter)
    })

    it('should clear both session and local storage by default', () => {
      // Act
      persistence.clearFilters('all')

      // Assert
      const sessionKey = `filters_session_${testUserRole}_${testUserId}`
      const localKey = `filters_local_${testUserRole}_${testUserId}`

      expect(mockSessionStorage.getItem(sessionKey)).toBeNull()
      expect(mockLocalStorage.getItem(localKey)).toBeNull()
    })

    it('should clear only session storage when scope is session', () => {
      // Act
      persistence.clearFilters('session')

      // Assert
      const sessionKey = `filters_session_${testUserRole}_${testUserId}`
      const localKey = `filters_local_${testUserRole}_${testUserId}`

      expect(mockSessionStorage.getItem(sessionKey)).toBeNull()
      expect(mockLocalStorage.getItem(localKey)).toBeTruthy()
    })

    it('should clear only local storage when scope is local', () => {
      // Act
      persistence.clearFilters('local')

      // Assert
      const sessionKey = `filters_session_${testUserRole}_${testUserId}`
      const localKey = `filters_local_${testUserRole}_${testUserId}`

      expect(mockSessionStorage.getItem(sessionKey)).toBeTruthy()
      expect(mockLocalStorage.getItem(localKey)).toBeNull()
    })
  })

  describe('Version Migration', () => {
    it('should migrate v0 filters to v1', async () => {
      // Arrange: Old format without version
      const oldFormatData = {
        careTypes: ['외래'],
        doctorId: 'doctor-1',
        department: null,
        dateRange: null,
        includeInactive: false
      }

      const localKey = `filters_local_${testUserRole}_${testUserId}`
      mockLocalStorage.setItem(localKey, JSON.stringify(oldFormatData))

      // Act
      const loaded = await persistence.loadFilters()

      // Assert
      expect(loaded).toBeTruthy()
      expect(loaded?.careTypes).toEqual(['외래'])
      expect(loaded?.showAll).toBe(false) // New field should have default value
      expect(loaded?.viewMode).toBe('my') // New field should have default value
    })

    it('should reject incompatible major versions', async () => {
      // Arrange: Future version
      const futureVersionData = {
        version: 'v2.0.0',
        timestamp: new Date().toISOString(),
        filters: sampleFilter
      }

      const localKey = `filters_local_${testUserRole}_${testUserId}`
      mockLocalStorage.setItem(localKey, JSON.stringify(futureVersionData))

      // Act
      const loaded = await persistence.loadFilters()

      // Assert
      expect(loaded).toBeNull()
    })
  })

  describe('BroadcastChannel Multi-Tab Sync', () => {
    it('should broadcast filter changes to other tabs', async () => {
      // Arrange
      const mockBroadcastChannel = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      }

      // @ts-expect-error - Mock the private broadcastChannel
      persistence['broadcastChannel'] = mockBroadcastChannel

      // Act
      await persistence.saveFilters(sampleFilter)

      // Assert
      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FILTER_CHANGE',
          filters: sampleFilter,
          userId: testUserId,
          role: testUserRole
        })
      )
    })

    it('should listen for filter changes from other tabs', () => {
      // Arrange
      const mockCallback = vi.fn()

      // Act
      const cleanup = persistence.onFilterChange(mockCallback)

      // Simulate message from another tab
      const mockEvent = {
        data: {
          type: 'FILTER_CHANGE',
          filters: sampleFilter,
          userId: testUserId,
          role: testUserRole
        }
      } as MessageEvent

      // Get the addEventListener call
      const mockBroadcastChannel = persistence['broadcastChannel'] as any
      const addEventListenerCall = mockBroadcastChannel.addEventListener.mock.calls[0]
      const handler = addEventListenerCall[1]

      // Call the handler with mock event
      handler(mockEvent)

      // Assert
      expect(mockCallback).toHaveBeenCalledWith(sampleFilter)

      // Cleanup
      cleanup()
    })

    it('should not trigger callback for messages from other users', () => {
      // Arrange
      const mockCallback = vi.fn()
      persistence.onFilterChange(mockCallback)

      // Act: Simulate message from different user
      const mockEvent = {
        data: {
          type: 'FILTER_CHANGE',
          filters: sampleFilter,
          userId: 'other-user',
          role: testUserRole
        }
      } as MessageEvent

      const mockBroadcastChannel = persistence['broadcastChannel'] as any
      const handler = mockBroadcastChannel.addEventListener.mock.calls[0][1]
      handler(mockEvent)

      // Assert
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('exportState', () => {
    it('should export current filter state as JSON', async () => {
      // Arrange
      await persistence.saveFilters(sampleFilter)

      // Act
      const exported = persistence.exportState()
      const parsed = JSON.parse(exported)

      // Assert
      expect(parsed.userId).toBe(testUserId)
      expect(parsed.role).toBe(testUserRole)
      expect(parsed.session).toBeTruthy()
      expect(parsed.local).toBeTruthy()
      expect(parsed.timestamp).toBeTruthy()
    })
  })

  describe('destroy', () => {
    it('should close broadcast channel on destroy', () => {
      // Arrange
      const mockBroadcastChannel = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      }

      // @ts-expect-error - Mock the private broadcastChannel
      persistence['broadcastChannel'] = mockBroadcastChannel

      // Act
      persistence.destroy()

      // Assert
      expect(mockBroadcastChannel.close).toHaveBeenCalled()
    })
  })
})
