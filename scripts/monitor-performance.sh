#!/bin/bash
# Performance Monitoring Script
# Usage: ./scripts/monitor-performance.sh
# Requirements: supabase CLI installed (brew install supabase/tap/supabase)

set -e

echo "🔍 Supabase Performance Monitor"
echo "================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Error: supabase CLI not installed"
  echo "Install with: brew install supabase/tap/supabase"
  exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
  echo "❌ Error: Not logged into Supabase CLI"
  echo "Run: supabase login"
  exit 1
fi

# Function to run SQL query
run_query() {
  local query="$1"
  supabase db query "$query" --csv 2>/dev/null | tail -n +2
}

echo "📊 Database Health Summary"
echo "------------------------"

# Health metrics query
HEALTH_QUERY="WITH health_metrics AS (
  SELECT 'Database Size' as metric, pg_size_pretty(pg_database_size(current_database())) as value, '📊' as icon
  UNION ALL
  SELECT 'Active Connections', COUNT(*)::text, '🔌'
  FROM pg_stat_activity WHERE state = 'active' AND datname = current_database()
  UNION ALL
  SELECT 'Tables Needing VACUUM', COUNT(*)::text, '🧹'
  FROM pg_stat_user_tables WHERE n_dead_tup::float / NULLIF(n_live_tup, 0)::float > 0.2
  UNION ALL
  SELECT 'New Indexes Usage',
    CASE WHEN SUM(idx_scan) > 100 THEN '✅ Active'
         WHEN SUM(idx_scan) > 10 THEN '🟡 Starting'
         ELSE '🔴 Not Used Yet' END, '📈'
  FROM pg_stat_user_indexes
  WHERE indexrelname IN ('idx_invitations_invited_by', 'idx_patient_schedules_created_by', 'idx_patient_schedules_nurse_id')
)
SELECT icon, metric, value FROM health_metrics;"

run_query "$HEALTH_QUERY" | while IFS=, read -r icon metric value; do
  echo "$icon $metric: $value"
done

echo ""
echo "📈 New Index Usage"
echo "------------------------"

INDEX_QUERY="SELECT indexrelname as index_name, idx_scan as scans,
  CASE WHEN idx_scan = 0 THEN 'Unused'
       WHEN idx_scan < 100 THEN 'Low Usage'
       ELSE 'High Usage' END as status
FROM pg_stat_user_indexes
WHERE indexrelname IN ('idx_invitations_invited_by', 'idx_patient_schedules_created_by', 'idx_patient_schedules_nurse_id')
ORDER BY idx_scan DESC;"

run_query "$INDEX_QUERY" | while IFS=, read -r index_name scans status; do
  echo "  $index_name: $scans scans - $status"
done

echo ""
echo "⚡ RLS Helper Function Performance"
echo "------------------------"

FUNCTION_QUERY="SELECT p.proname as function_name, COALESCE(pg_stat_user_functions.calls, 0) as calls,
  COALESCE(ROUND((pg_stat_user_functions.self_time / NULLIF(pg_stat_user_functions.calls, 0))::numeric, 4), 0) as avg_time_ms
FROM pg_stat_user_functions
JOIN pg_proc p ON p.oid = pg_stat_user_functions.funcid
WHERE p.proname IN ('is_user_active_and_approved', 'is_clinical_staff', 'has_role')
ORDER BY calls DESC;"

run_query "$FUNCTION_QUERY" | while IFS=, read -r function_name calls avg_time_ms; do
  echo "  $function_name: $calls calls, ${avg_time_ms}ms avg"
done

echo ""
echo "✅ Monitoring complete!"
echo ""
echo "💡 Tip: Run this script daily or add to cron:"
echo "   0 9 * * * cd $PWD && ./scripts/monitor-performance.sh >> logs/performance-\$(date +\%Y\%m\%d).log 2>&1"
