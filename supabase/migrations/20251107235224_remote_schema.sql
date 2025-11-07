drop extension if exists "pg_net";

create extension if not exists "pg_trgm" with schema "public";

drop policy "System can insert schedule logs" on "public"."schedule_logs";

create or replace view "public"."dashboard_summary" as  WITH today_stats AS (
         SELECT count(*) FILTER (WHERE (se.status = 'completed'::public.execution_status)) AS completed_count,
            count(*) FILTER (WHERE (se.status = 'planned'::public.execution_status)) AS planned_count,
            count(*) FILTER (WHERE (se.status = 'overdue'::public.execution_status)) AS overdue_count,
            count(*) AS total_count
           FROM (public.schedule_executions se
             JOIN public.schedules s ON ((se.schedule_id = s.id)))
          WHERE ((se.planned_date = CURRENT_DATE) AND (s.status = 'active'::public.schedule_status))
        ), upcoming_week AS (
         SELECT count(DISTINCT s.id) AS upcoming_schedules
           FROM public.schedules s
          WHERE (((s.next_due_date >= (CURRENT_DATE + 1)) AND (s.next_due_date <= (CURRENT_DATE + 7))) AND (s.status = 'active'::public.schedule_status))
        )
 SELECT ts.completed_count,
    ts.planned_count,
    ts.overdue_count,
    ts.total_count,
    uw.upcoming_schedules,
    round(
        CASE
            WHEN (ts.total_count > 0) THEN (((ts.completed_count)::numeric / (ts.total_count)::numeric) * (100)::numeric)
            ELSE (0)::numeric
        END, 2) AS completion_rate
   FROM today_stats ts,
    upcoming_week uw;



  create policy "System can insert schedule logs"
  on "public"."schedule_logs"
  as permissive
  for insert
  to anon, authenticated
with check (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


