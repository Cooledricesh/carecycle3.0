-- Healthcare Scheduler Database Monitoring and Backup Setup
-- Migration: Database operational excellence and monitoring

-- Create audit log table for important operations
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    user_role TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Enable RLS on audit_logs (admins only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Index for audit logs
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_operation ON public.audit_logs(operation);

-- RLS Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to log profile changes
CREATE OR REPLACE FUNCTION public.audit_profiles_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_profile public.profiles;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();
    
    -- Log the operation
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_role
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) 
             WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) 
             ELSE NULL END,
        auth.uid(),
        user_profile.email,
        user_profile.role::TEXT
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log schedule changes
CREATE OR REPLACE FUNCTION public.audit_schedules_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_profile public.profiles;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = auth.uid();
    
    -- Log the operation
    INSERT INTO public.audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        user_email,
        user_role
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) 
             WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) 
             ELSE NULL END,
        auth.uid(),
        user_profile.email,
        user_profile.role::TEXT
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers
CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_profiles_changes();

CREATE TRIGGER audit_schedules_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.patient_schedules
    FOR EACH ROW EXECUTE FUNCTION public.audit_schedules_changes();

-- Database monitoring views (for admins)
CREATE OR REPLACE VIEW public.database_health AS
SELECT 
    'Active Users' as metric,
    COUNT(*) as value,
    'users' as unit
FROM public.profiles WHERE is_active = true
UNION ALL
SELECT 
    'Total Schedules Today' as metric,
    COUNT(*) as value,
    'appointments' as unit
FROM public.patient_schedules WHERE scheduled_date = CURRENT_DATE
UNION ALL
SELECT 
    'Pending Schedules' as metric,
    COUNT(*) as value,
    'appointments' as unit
FROM public.patient_schedules WHERE status = 'scheduled' AND scheduled_date >= CURRENT_DATE;

-- Performance monitoring view
CREATE OR REPLACE VIEW public.performance_metrics AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- Function to get database statistics (admin only)
CREATE OR REPLACE FUNCTION public.get_db_stats()
RETURNS TABLE(
    metric TEXT,
    value BIGINT,
    description TEXT
) AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;
    
    RETURN QUERY
    SELECT 
        'connection_count'::TEXT,
        COUNT(*)::BIGINT,
        'Current active connections'::TEXT
    FROM pg_stat_activity
    WHERE state = 'active'
    
    UNION ALL
    
    SELECT 
        'database_size'::TEXT,
        pg_database_size(current_database())::BIGINT,
        'Database size in bytes'::TEXT
    
    UNION ALL
    
    SELECT 
        'total_profiles'::TEXT,
        COUNT(*)::BIGINT,
        'Total user profiles'::TEXT
    FROM public.profiles
    
    UNION ALL
    
    SELECT 
        'total_schedules'::TEXT,
        COUNT(*)::BIGINT,
        'Total patient schedules'::TEXT
    FROM public.patient_schedules;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;