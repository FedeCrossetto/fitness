-- ════════════════════════════════════════════════════════════════
-- 0047 — Anuncios programables del coach (chat 1:1 y grupos)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  trainer_id    uuid not null references auth.users(id) on delete cascade,
  title         text,
  content       text not null,
  target_type   text not null check (target_type in ('all_clients', 'groups', 'clients')),
  target_ids    uuid[] not null default '{}',
  send_at       timestamptz not null default now(),
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'sent', 'failed', 'cancelled')),
  sent_at       timestamptz,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_announcements_trainer on public.announcements(trainer_id, created_at desc);
create index if not exists idx_announcements_due on public.announcements(send_at)
  where status = 'scheduled';

drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.handle_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "announcements: trainer all" on public.announcements;
create policy "announcements: trainer all" on public.announcements
  for all using (trainer_id = auth.uid())
  with check (trainer_id = auth.uid());

-- ── Entrega a chats ──

create or replace function public.deliver_announcement(p_announcement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.announcements%rowtype;
  v_client record;
  v_group_id uuid;
begin
  select * into v_row
  from public.announcements
  where id = p_announcement_id;

  if not found then
    return false;
  end if;

  if auth.uid() is distinct from v_row.trainer_id and not private.is_admin() then
    raise exception 'not allowed';
  end if;

  if v_row.status <> 'scheduled' then
    return false;
  end if;

  if v_row.target_type = 'all_clients' then
    for v_client in
      select id
      from public.profiles
      where trainer_id = v_row.trainer_id
        and client_status = 'active'
    loop
      insert into public.messages (client_id, content, sender_role, read)
      values (v_client.id, v_row.content, 'trainer', false);
    end loop;

  elsif v_row.target_type = 'clients' then
    for v_client in
      select p.id
      from public.profiles p
      where p.id = any(v_row.target_ids)
        and p.trainer_id = v_row.trainer_id
        and p.client_status = 'active'
    loop
      insert into public.messages (client_id, content, sender_role, read)
      values (v_client.id, v_row.content, 'trainer', false);
    end loop;

  elsif v_row.target_type = 'groups' then
    foreach v_group_id in array v_row.target_ids
    loop
      if exists (
        select 1
        from public.communities c
        where c.id = v_group_id
          and c.trainer_id = v_row.trainer_id
          and c.is_active
      ) then
        insert into public.community_messages (community_id, sender_id, content, kind)
        values (v_group_id, v_row.trainer_id, v_row.content, 'system');
      end if;
    end loop;
  end if;

  update public.announcements
  set status = 'sent',
      sent_at = now(),
      updated_at = now(),
      error_message = null
  where id = p_announcement_id;

  return true;
exception when others then
  update public.announcements
  set status = 'failed',
      error_message = SQLERRM,
      updated_at = now()
  where id = p_announcement_id;
  return false;
end;
$$;

grant execute on function public.deliver_announcement(uuid) to authenticated;

create or replace function public.process_due_announcements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select id
    from public.announcements
    where status = 'scheduled'
      and send_at <= now()
      and (auth.uid() is null or trainer_id = auth.uid())
    order by send_at asc
    limit 50
  loop
    if public.deliver_announcement(v_row.id) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.process_due_announcements() to authenticated;
