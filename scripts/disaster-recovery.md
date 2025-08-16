# Healthcare Scheduler - Disaster Recovery Runbook

## Overview
This runbook provides step-by-step procedures for disaster recovery of the Healthcare Scheduler database system.

**RTO (Recovery Time Objective):** 2 hours
**RPO (Recovery Point Objective):** 15 minutes

## Emergency Contacts
- Database Administrator: [Your Contact]
- System Administrator: [Your Contact] 
- Application Owner: [Your Contact]
- Supabase Support: support@supabase.com

## Pre-Disaster Preparation

### 1. Backup Strategy
- **Automated Backups:** Supabase provides automatic daily backups
- **Point-in-Time Recovery:** Available for the last 7 days
- **Manual Backups:** Run before major updates
- **Backup Verification:** Test restore monthly

### 2. Monitoring Setup
```sql
-- Run this query daily to monitor database health
SELECT * FROM public.database_health;

-- Monitor performance metrics
SELECT * FROM public.performance_metrics;

-- Check audit logs for suspicious activity
SELECT * FROM public.audit_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption
**Symptoms:** Query errors, data inconsistency, application crashes

**Recovery Steps:**
1. **Immediate Actions (0-15 minutes)**
   - Stop all application traffic
   - Identify the scope of corruption
   - Contact Supabase support

2. **Assessment (15-30 minutes)**
   ```sql
   -- Check database integrity
   \copy (SELECT * FROM public.profiles) TO 'profiles_backup.csv' CSV HEADER;
   \copy (SELECT * FROM public.patient_schedules) TO 'schedules_backup.csv' CSV HEADER;
   
   -- Verify data consistency
   SELECT COUNT(*) FROM public.profiles;
   SELECT COUNT(*) FROM public.patient_schedules;
   ```

3. **Recovery (30-120 minutes)**
   - Restore from latest backup via Supabase dashboard
   - Re-run migrations if necessary
   - Verify data integrity

### Scenario 2: Data Loss
**Symptoms:** Missing records, unauthorized deletions

**Recovery Steps:**
1. **Immediate Actions (0-10 minutes)**
   - Check audit logs for deletion events
   ```sql
   SELECT * FROM public.audit_logs 
   WHERE operation = 'DELETE' 
   AND timestamp >= NOW() - INTERVAL '24 hours';
   ```

2. **Data Recovery (10-60 minutes)**
   - Use point-in-time recovery to restore to before data loss
   - Export critical data before restore
   - Restore from backup and merge changes

### Scenario 3: Security Breach
**Symptoms:** Unauthorized access, suspicious activity in logs

**Recovery Steps:**
1. **Immediate Actions (0-5 minutes)**
   - Revoke all API keys
   - Disable user access
   - Document the incident

2. **Investigation (5-30 minutes)**
   ```sql
   -- Check recent audit activity
   SELECT * FROM public.audit_logs 
   WHERE timestamp >= NOW() - INTERVAL '7 days'
   ORDER BY timestamp DESC;
   
   -- Check for unauthorized admin access
   SELECT * FROM public.profiles 
   WHERE role = 'admin' 
   AND updated_at >= NOW() - INTERVAL '7 days';
   ```

3. **Recovery (30-120 minutes)**
   - Reset all user passwords
   - Generate new API keys
   - Review and update RLS policies
   - Restore clean data if compromised

### Scenario 4: Complete System Failure
**Symptoms:** Total service unavailability

**Recovery Steps:**
1. **Emergency Setup (0-30 minutes)**
   - Create new Supabase project
   - Deploy database schema from migrations
   - Restore latest backup

2. **Data Recovery (30-90 minutes)**
   ```bash
   # Apply all migrations
   supabase db reset
   
   # Restore data
   psql -h your-db-host -U postgres -d postgres -f backup.sql
   ```

3. **Verification (90-120 minutes)**
   - Test critical application functions
   - Verify user authentication
   - Check data integrity

## Recovery Verification Checklist

### Post-Recovery Testing
- [ ] User authentication works
- [ ] Profile data is intact
- [ ] Schedule data is complete
- [ ] RLS policies are functioning
- [ ] All indexes are present
- [ ] Audit logs are working
- [ ] Application functions normally

### Data Integrity Verification
```sql
-- Verify profile integrity
SELECT 
    COUNT(*) as total_profiles,
    COUNT(DISTINCT id) as unique_profiles,
    COUNT(*) FILTER (WHERE email IS NOT NULL) as profiles_with_email
FROM public.profiles;

-- Verify schedule integrity
SELECT 
    COUNT(*) as total_schedules,
    COUNT(*) FILTER (WHERE nurse_id IS NOT NULL) as assigned_schedules,
    COUNT(*) FILTER (WHERE scheduled_date >= CURRENT_DATE) as future_schedules
FROM public.patient_schedules;

-- Check foreign key integrity
SELECT ps.id, ps.nurse_id
FROM public.patient_schedules ps
LEFT JOIN public.profiles p ON ps.nurse_id = p.id
WHERE ps.nurse_id IS NOT NULL AND p.id IS NULL;
```

## Prevention Measures

### 1. Regular Backups
```bash
# Manual backup script (run weekly)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h your-host -U postgres database_name > backup_$DATE.sql
```

### 2. Monitoring Alerts
Set up alerts for:
- High connection count (>80% of limit)
- Long-running queries (>30 seconds)
- Failed authentication attempts
- Unusual data deletion patterns

### 3. Security Measures
- Regular password rotation
- API key rotation every 90 days
- Regular RLS policy audits
- User access reviews

### 4. Testing Schedule
- **Monthly:** Backup restoration test
- **Quarterly:** Disaster recovery drill
- **Annually:** Full disaster recovery simulation

## Recovery Time Breakdown

| Scenario | Detection | Assessment | Recovery | Verification | Total |
|----------|-----------|------------|----------|--------------|-------|
| Data Corruption | 5 min | 15 min | 60 min | 30 min | 110 min |
| Data Loss | 5 min | 10 min | 45 min | 20 min | 80 min |
| Security Breach | 5 min | 25 min | 75 min | 15 min | 120 min |
| System Failure | 5 min | 10 min | 90 min | 15 min | 120 min |

## Contact Information
- **Supabase Dashboard:** https://app.supabase.com
- **Project URL:** https://xlhtmakvxbdjnpvtzdqh.supabase.co
- **Documentation:** https://supabase.com/docs

## Post-Incident Actions
1. Document lessons learned
2. Update recovery procedures
3. Review and improve monitoring
4. Conduct team debriefing
5. Update emergency contacts