#!/bin/bash
# Database Health Check Script for Schedule Management System
# Run this script daily for operational monitoring

set -e

# Configuration
DB_URL="${SUPABASE_DB_URL:-postgresql://localhost:5432/postgres}"
ALERT_THRESHOLD_OVERDUE=10
ALERT_THRESHOLD_COMPLETION_RATE=70
LOG_FILE="/var/log/schedule-health-check.log"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Health check function
check_database_health() {
    log "Starting database health check..."
    
    # Check database connectivity
    if ! psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
        log "${RED}ERROR: Cannot connect to database${NC}"
        exit 1
    fi
    
    log "${GREEN}Database connection: OK${NC}"
    
    # Run operational health checks
    psql "$DB_URL" -t -c "SELECT * FROM check_operational_health();" | while IFS='|' read -r level message value; do
        level=$(echo "$level" | xargs)
        message=$(echo "$message" | xargs)
        value=$(echo "$value" | xargs)
        
        case "$level" in
            "CRITICAL")
                log "${RED}CRITICAL: $message (Value: $value)${NC}"
                # Send critical alert (implement your notification system)
                ;;
            "WARNING")
                log "${YELLOW}WARNING: $message (Value: $value)${NC}"
                # Send warning alert
                ;;
            "INFO")
                log "${GREEN}INFO: $message (Value: $value)${NC}"
                ;;
        esac
    done
    
    # Check performance metrics
    log "Performance Metrics:"
    psql "$DB_URL" -t -c "SELECT metric, value, unit FROM schedule_performance_metrics;" | while IFS='|' read -r metric value unit; do
        metric=$(echo "$metric" | xargs)
        value=$(echo "$value" | xargs)
        unit=$(echo "$unit" | xargs)
        log "  $metric: $value $unit"
    done
    
    log "Health check completed successfully"
}

# Backup validation
check_backup_integrity() {
    log "Validating backup integrity..."
    
    # Run backup function and check results
    backup_result=$(psql "$DB_URL" -t -c "SELECT * FROM backup_schedule_data();")
    log "Backup validation: $backup_result"
}

# Connection pool monitoring
check_connection_pool() {
    log "Checking connection pool status..."
    
    # Check active connections
    active_connections=$(psql "$DB_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
    max_connections=$(psql "$DB_URL" -t -c "SHOW max_connections;")
    
    usage_percent=$(( active_connections * 100 / max_connections ))
    
    if [ "$usage_percent" -gt 80 ]; then
        log "${RED}WARNING: High connection pool usage: $usage_percent%${NC}"
    else
        log "${GREEN}Connection pool usage: $usage_percent%${NC}"
    fi
}

# Main execution
main() {
    log "=== Database Health Check Started ==="
    
    check_database_health
    check_backup_integrity
    check_connection_pool
    
    # Run maintenance if it's the right time (e.g., 2 AM)
    current_hour=$(date +%H)
    if [ "$current_hour" = "02" ]; then
        log "Running automated maintenance..."
        psql "$DB_URL" -c "SELECT maintain_schedule_tables();"
    fi
    
    log "=== Database Health Check Completed ==="
}

# Error handling
trap 'log "Health check failed with error"; exit 1' ERR

# Run main function
main "$@"