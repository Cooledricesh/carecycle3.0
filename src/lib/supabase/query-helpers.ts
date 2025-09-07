/**
 * Helper functions for working with Supabase PostgREST queries
 * These helpers provide type-safe wrappers for features that aren't yet
 * fully typed in the Supabase SDK.
 */

/**
 * Interface for PostgREST query builders that support AbortSignal
 */
interface PostgRESTQueryWithAbortSignal<T = any> {
  abortSignal(signal: AbortSignal): T
  select(): T
  single(): T
  [key: string]: any
}

/**
 * Type guard to check if a query builder supports AbortSignal
 */
export function supportsAbortSignal<T>(
  query: any
): query is PostgRESTQueryWithAbortSignal<T> {
  return (
    query &&
    typeof query === 'object' &&
    typeof query.abortSignal === 'function'
  )
}

/**
 * Safely attach an AbortSignal to a PostgREST query
 * @param query - The base query builder
 * @param signal - Optional AbortSignal to attach
 * @returns The query builder with AbortSignal attached if supported
 */
export function attachAbortSignal<T extends { select(): any }>(
  query: T,
  signal?: AbortSignal
): T {
  if (!signal) {
    return query
  }

  if (supportsAbortSignal(query)) {
    // Type-safe cast since we've verified with the type guard
    return query.abortSignal(signal) as T
  }

  // If AbortSignal is not supported, return the original query
  // This ensures backward compatibility
  console.warn('AbortSignal is not supported by this query builder')
  return query
}

/**
 * Execute a PostgREST query with optional AbortSignal support
 * @param baseQuery - The base query builder (after from().update().eq() etc.)
 * @param signal - Optional AbortSignal to cancel the request
 * @param finalizers - Functions to call on the query (e.g., select, single)
 */
export async function executeQueryWithSignal<T>(
  baseQuery: any,
  signal: AbortSignal | undefined,
  finalizers: {
    select?: boolean
    single?: boolean
  } = {}
): Promise<{ data: T | null; error: any }> {
  // Attach AbortSignal if supported
  let query = attachAbortSignal(baseQuery, signal)
  
  // Apply finalizers
  if (finalizers.select !== false) {
    query = query.select()
  }
  if (finalizers.single) {
    query = query.single()
  }
  
  return await query
}