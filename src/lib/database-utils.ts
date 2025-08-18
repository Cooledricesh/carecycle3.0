'use client'

/**
 * Database to Application Type Conversion Utilities
 * Handles snake_case to camelCase conversion and encrypted field handling
 */

// Convert snake_case to camelCase
export function toCamelCase<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj

  return Object.keys(obj).reduce((result, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
    result[camelKey] = toCamelCase(obj[key])
    return result
  }, {} as any)
}

// Convert camelCase to snake_case
export function toSnakeCase<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj

  return Object.keys(obj).reduce((result, key) => {
    const snakeKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
    result[snakeKey] = toSnakeCase(obj[key])
    return result
  }, {} as any)
}

// Database Row to Application Type Converters
export function convertPatientRow(row: any): any {
  if (!row) return null
  
  return {
    id: row.id,
    hospitalId: row.hospital_id,
    patientNumber: row.patient_number, // Will be decrypted by view
    name: row.name, // Will be decrypted by view
    department: row.department,
    isActive: row.is_active,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function convertScheduleRow(row: any): any {
  if (!row) return null
  
  return {
    id: row.id,
    patientId: row.patient_id,
    itemId: row.item_id,
    intervalDays: row.interval_days,
    startDate: row.start_date,
    endDate: row.end_date,
    lastExecutedDate: row.last_executed_date,
    nextDueDate: row.next_due_date,
    status: row.status,
    assignedNurseId: row.assigned_nurse_id,
    notes: row.notes,
    priority: row.priority,
    requiresNotification: row.requires_notification,
    notificationDaysBefore: row.notification_days_before,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function convertItemRow(row: any): any {
  if (!row) return null
  
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    defaultIntervalDays: row.default_interval_days,
    description: row.description,
    instructions: row.instructions,
    preparationNotes: row.preparation_notes,
    requiresNotification: row.requires_notification,
    notificationDaysBefore: row.notification_days_before,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function convertExecutionRow(row: any): any {
  if (!row) return null
  
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    plannedDate: row.planned_date,
    executedDate: row.executed_date,
    executedTime: row.executed_time,
    status: row.status,
    executedBy: row.executed_by,
    notes: row.notes,
    skippedReason: row.skipped_reason,
    isRescheduled: row.is_rescheduled,
    originalDate: row.original_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Application Type to Database Row Converters
export function toPatientInsert(data: any): any {
  return {
    patient_number: data.patientNumber, // Will be encrypted by database
    name: data.name, // Will be encrypted by database
    department: data.department,
    is_active: data.isActive ?? true,
    metadata: data.metadata ?? {},
  }
}

export function toScheduleInsert(data: any): any {
  return {
    patient_id: data.patientId,
    item_id: data.itemId,
    interval_days: data.intervalDays,
    start_date: data.startDate,
    end_date: data.endDate,
    next_due_date: data.startDate, // Initially same as start date
    assigned_nurse_id: data.assignedNurseId,
    notes: data.notes,
    priority: data.priority ?? 0,
    requires_notification: data.requiresNotification ?? (data.intervalDays >= 28),
    notification_days_before: data.notificationDaysBefore ?? 7,
  }
}

export function toItemInsert(data: any): any {
  return {
    code: data.code,
    name: data.name,
    category: data.category,
    default_interval_days: data.defaultIntervalDays ?? 28,
    description: data.description,
    instructions: data.instructions,
    preparation_notes: data.preparationNotes,
    requires_notification: data.requiresNotification ?? false,
    notification_days_before: data.notificationDaysBefore ?? 7,
    is_active: data.isActive ?? true,
    sort_order: data.sortOrder ?? 0,
    metadata: data.metadata ?? {},
  }
}

export function toExecutionUpdate(data: any): any {
  return {
    executed_date: data.executedDate,
    executed_time: data.executedTime,
    status: data.status,
    notes: data.notes,
    skipped_reason: data.skippedReason,
  }
}