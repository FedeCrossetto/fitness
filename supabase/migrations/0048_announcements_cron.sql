-- ════════════════════════════════════════════════════════════════
-- 0048 — Cron para anuncios programados (cada minuto)
-- Requiere extensión pg_cron habilitada en Supabase (Dashboard → Database → Extensions).
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_cron with schema extensions;

do $cron$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'process-due-announcements'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
exception
  when undefined_table then null;
end $cron$;

select cron.schedule(
  'process-due-announcements',
  '* * * * *',
  $$select public.process_due_announcements();$$
);
