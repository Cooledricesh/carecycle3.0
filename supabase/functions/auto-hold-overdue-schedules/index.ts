// ============================================================================
// Supabase Edge Function: Auto-hold overdue schedules
// Purpose: Automatically set status='paused' for schedules overdue by X days
// Trigger: Run daily at midnight via cron job
// Phase: 2.2.3
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 100 // Process 100 schedules at a time to avoid DB overload

serve(async (req) => {
  try {
    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[Auto-hold] Starting auto-hold process...')

    // STEP 1: Fetch all organization policies with auto-hold enabled
    const { data: policies, error: policiesError } = await supabase
      .from('organization_policies')
      .select('organization_id, auto_hold_overdue_days')
      .not('auto_hold_overdue_days', 'is', null)
      .gt('auto_hold_overdue_days', 0)

    if (policiesError) {
      console.error('[Auto-hold] Error fetching policies:', policiesError)
      return new Response(JSON.stringify({ error: 'Failed to fetch policies' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!policies || policies.length === 0) {
      console.log('[Auto-hold] No policies with auto-hold enabled')
      return new Response(JSON.stringify({ message: 'No policies to process' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Auto-hold] Found ${policies.length} organizations with auto-hold enabled`)

    let totalUpdated = 0

    // STEP 2: Process each organization
    for (const policy of policies) {
      const { organization_id, auto_hold_overdue_days } = policy
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - auto_hold_overdue_days)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      console.log(
        `[Auto-hold] Processing org ${organization_id}, cutoff: ${cutoffDateStr} (${auto_hold_overdue_days} days)`
      )

      // STEP 3: Find overdue schedules in batches (with organization filtering)
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const { data: overdueSchedules, error: schedulesError } = await supabase
          .from('schedules')
          .select(`
            id,
            patient_id,
            item_id,
            next_due_date,
            patients!inner(organization_id)
          `)
          .in('status', ['active'])
          .lt('next_due_date', cutoffDateStr)
          .eq('patients.organization_id', organization_id)
          .limit(BATCH_SIZE)
          .range(offset, offset + BATCH_SIZE - 1)

        if (schedulesError) {
          console.error(`[Auto-hold] Error fetching schedules for org ${organization_id}:`, schedulesError)
          break
        }

        if (!overdueSchedules || overdueSchedules.length === 0) {
          hasMore = false
          break
        }

        console.log(`[Auto-hold] Found ${overdueSchedules.length} overdue schedules in batch`)

        // STEP 4: Update schedules to 'paused' status
        const scheduleIds = overdueSchedules.map((s: { id: string }) => s.id)

        const { error: updateError } = await supabase
          .from('schedules')
          .update({ status: 'paused' })
          .in('id', scheduleIds)

        if (updateError) {
          console.error(`[Auto-hold] Error updating schedules:`, updateError)
        } else {
          totalUpdated += overdueSchedules.length
          console.log(`[Auto-hold] Updated ${overdueSchedules.length} schedules to 'paused'`)
        }

        // STEP 5: Log audit trail
        for (const schedule of overdueSchedules) {
          const { error: auditError } = await supabase.from('audit_logs').insert({
            table_name: 'schedules',
            operation: 'UPDATE',
            record_id: schedule.id,
            old_values: { status: 'active' },
            new_values: { status: 'paused' },
            user_id: null, // System action
            user_email: 'system@auto-hold',
            user_name: 'Auto-hold System',
            user_role: 'system',
            organization_id: organization_id, // Required field
            timestamp: new Date().toISOString(),
          })
          if (auditError) {
            console.error('Audit log failed:', { scheduleId: schedule.id, error: auditError })
          }
        }

        // Check if we need to fetch more
        if (overdueSchedules.length < BATCH_SIZE) {
          hasMore = false
        } else {
          offset += BATCH_SIZE
        }
      }
    }

    console.log(`[Auto-hold] Process complete. Total schedules updated: ${totalUpdated}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auto-hold process completed',
        organizations_processed: policies.length,
        total_schedules_updated: totalUpdated,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    console.error('[Auto-hold] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
