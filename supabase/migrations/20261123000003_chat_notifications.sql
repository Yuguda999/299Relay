-- 299 RELAY — chat presence and new-message notifications.
--
-- The chat screen calls chat_heartbeat() every ~20s while it is open and
-- visible. A new message notifies the other party (inbox + push via the
-- notifications trigger) only if they have not been in that chat in the last
-- 45 seconds, so people reading along are not pinged.

create table public.chat_presence (
  job_id      uuid not null references public.jobs(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  seen_at     timestamptz not null default now(),
  primary key (job_id, profile_id)
);
alter table public.chat_presence enable row level security;
-- No direct client access; written only by chat_heartbeat().

create or replace function public.chat_heartbeat(p_job uuid, p_leaving boolean default false) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me public.profiles := private.me();
begin
  if not exists (select 1 from jobs where id = p_job and me.id in (requester_id, traveler_id)) then
    perform private.err('job_not_found');
  end if;
  if p_leaving then
    delete from chat_presence where job_id = p_job and profile_id = me.id;
    return;
  end if;
  insert into chat_presence (job_id, profile_id, seen_at) values (p_job, me.id, now())
  on conflict (job_id, profile_id) do update set seen_at = now();
  -- Reading the chat clears its unread message alerts.
  update notifications set read_at = now()
   where profile_id = me.id and kind = 'message' and read_at is null and link = '/jobs/' || p_job || '/chat';
end $$;
grant execute on function public.chat_heartbeat(uuid, boolean) to authenticated;

create or replace function private.notify_new_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_job       public.jobs;
  v_recipient uuid;
  v_sender    text;
  v_preview   text;
begin
  -- System lines and price changes already notify on their own.
  if new.kind not in ('text', 'photo') or new.sender_id is null then
    return new;
  end if;
  select * into v_job from public.jobs where id = new.job_id;
  v_recipient := case when new.sender_id = v_job.requester_id then v_job.traveler_id else v_job.requester_id end;

  if exists (select 1 from public.chat_presence
              where job_id = new.job_id and profile_id = v_recipient and seen_at > now() - interval '45 seconds') then
    return new;  -- they're looking at the chat right now
  end if;

  select split_part(full_name, ' ', 1) into v_sender from public.profiles where id = new.sender_id;
  v_preview := case when new.kind = 'photo' then 'Sent a photo' else left(new.body, 140) end;

  insert into public.notifications (profile_id, kind, title, body, link)
  values (v_recipient, 'message', coalesce(v_sender, 'New message'), v_preview, '/jobs/' || new.job_id || '/chat');
  return new;
end $$;

create trigger messages_notify after insert on public.messages
  for each row execute function private.notify_new_message();

-- Realtime UPDATE events (substitute decisions) need the whole row.
alter table public.messages replica identity full;
