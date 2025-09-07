/**
 * Type extensions for Supabase PostgREST client
 * 
 * This file extends the Supabase types to include methods that are available
 * at runtime but not yet in the official type definitions.
 */

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

declare module '@supabase/postgrest-js' {
  interface PostgrestFilterBuilder<
    Schema,
    Row,
    Result,
    RelationName,
    Relationships
  > {
    /**
     * Attach an AbortSignal to cancel the request
     * @param signal - The AbortSignal to attach to the request
     */
    abortSignal(signal: AbortSignal): this
  }
}

// Export empty object to make this a module
export {}