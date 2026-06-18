-- ════════════════════════════════════════════════════════════════
-- 0028 — Push automático al insertar mensaje del entrenador (pg_net)
-- ════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;

-- Secreto compartido trigger ↔ edge function (solo service_role lee la tabla).
create table if not exists public.push_webhook_config (
  name text primary key,
  secret text not null
);

alter table public.push_webhook_config enable row level security;

insert into public.push_webhook_config (name, secret)
values (
  'messages',
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
)
on conflict (name) do nothing;

create or replace function public.trigger_push_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_url text := 'https://lddadlaqvvqelbftvgpd.supabase.co/functions/v1/push-new-message';
begin
  if new.sender_role is distinct from 'trainer' then
    return new;
  end if;

  select secret into v_secret
  from public.push_webhook_config
  where name = 'messages';

  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', new.id,
        'client_id', new.client_id,
        'content', new.content,
        'sender_role', new.sender_role
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists on_message_push on public.messages;
create trigger on_message_push
  after insert on public.messages
  for each row
  execute function public.trigger_push_new_message();
