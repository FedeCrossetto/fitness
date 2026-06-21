-- ════════════════════════════════════════════════════════════════
-- 0043 — Trofeos: 1 por día con todas las metas diarias completadas
-- ════════════════════════════════════════════════════════════════

create table if not exists public.user_trophy_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_user_trophy_days_user_date
  on public.user_trophy_days(user_id, date desc);

alter table public.user_trophy_days enable row level security;

drop policy if exists "trophy_days: own select" on public.user_trophy_days;
create policy "trophy_days: own select" on public.user_trophy_days
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "trophy_days: trainer reads clients" on public.user_trophy_days;
create policy "trophy_days: trainer reads clients" on public.user_trophy_days
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_trophy_days.user_id
        and p.trainer_id = auth.uid()
    )
  );

-- Otorga trofeo cuando todas las metas del día están completas (idempotente).
create or replace function public.try_award_trophy_day(p_user_id uuid, p_date date)
returns boolean as $$
declare
  v_total int;
  v_done int;
begin
  select count(*)::int, count(*) filter (where completed)::int
  into v_total, v_done
  from public.daily_goals
  where user_id = p_user_id
    and date = p_date;

  if v_total = 0 or v_done < v_total then
    return false;
  end if;

  insert into public.user_trophy_days (user_id, date)
  values (p_user_id, p_date)
  on conflict (user_id, date) do nothing;

  return true;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.try_award_trophy_day(uuid, date) to authenticated, service_role;

create or replace function public.trigger_award_trophy_on_goal_change()
returns trigger as $$
begin
  perform public.try_award_trophy_day(
    coalesce(new.user_id, old.user_id),
    coalesce(new.date, old.date)
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_daily_goal_trophy_award on public.daily_goals;
create trigger on_daily_goal_trophy_award
  after insert or update of completed on public.daily_goals
  for each row
  execute function public.trigger_award_trophy_on_goal_change();

-- Trofeos retroactivos para días que ya tenían todas las metas completas
insert into public.user_trophy_days (user_id, date)
select user_id, date
from public.daily_goals
group by user_id, date
having count(*) > 0
   and count(*) = count(*) filter (where completed)
on conflict (user_id, date) do nothing;
