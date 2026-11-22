-- 299 RELAY — row-level security, grants, storage, realtime, schedules.
--
-- Rule: clients READ through RLS and WRITE through RPCs. Direct table writes
-- are granted only where noted (own profile fields, chat text, admin places).

-- ─── Small client RPCs ──────────────────────────────────────────────────────
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare me public.profiles := private.me(); n integer;
begin
  update notifications set read_at = now()
   where profile_id = me.id and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.register_device(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me public.profiles := private.me();
begin
  insert into devices (profile_id, platform, push_token) values (me.id, p_platform, p_token)
  on conflict (push_token) do update set profile_id = excluded.profile_id, platform = excluded.platform, last_seen = now();
end $$;

create or replace function public.unregister_device(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from devices where push_token = p_token and profile_id = auth.uid();
$$;

-- Public card for other students on the same campus: first name, last initial,
-- photo, rating, counts. Owned by postgres, so it reads past profiles RLS.
create or replace view public.public_profiles with (security_barrier) as
select p.id,
       p.campus_id,
       split_part(p.full_name, ' ', 1) as first_name,
       case when position(' ' in trim(p.full_name)) > 0
            then upper(left(split_part(trim(p.full_name), ' ', -1), 1)) end as last_initial,
       p.photo_path,
       p.hostel,
       p.rating_avg,
       p.rating_count,
       p.jobs_carried,
       p.jobs_requested,
       p.status = 'verified' as verified,
       p.created_at
  from public.profiles p
 where p.campus_id = public.my_campus();

-- ─── Grants ─────────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on all tables in schema public to authenticated;
grant select on public.campuses to anon;                                         -- sign-up campus picker
grant select on public.public_profiles to authenticated;

grant update (hostel, photo_path, women_only) on public.profiles to authenticated;
grant insert on public.messages to authenticated;
grant insert, update on public.places, public.prohibited_keywords, public.campuses to authenticated;  -- RLS: admins only
grant delete on public.prohibited_keywords to authenticated;

-- User RPCs
grant execute on function
  public.is_admin(), public.my_campus(),
  public.quote_request(public.request_type, uuid, uuid, bigint, boolean),
  public.create_request(public.request_type, text, uuid, uuid, timestamptz, bigint, bigint, boolean, text, uuid),
  public.cancel_request(uuid),
  public.release_job(uuid),
  public.create_trip(uuid, uuid, timestamptz, timestamptz, smallint, public.request_type[], text),
  public.cancel_trip(uuid),
  public.accept_job(uuid, uuid),
  public.confirm_purchase(uuid, text, bigint),
  public.start_delivery(uuid),
  public.propose_substitute(uuid, text, bigint, text),
  public.respond_substitute(uuid, boolean),
  public.submit_handoff_code(uuid, text),
  public.rate_job(uuid, smallint, text[], text, bigint),
  public.open_dispute(uuid, text, text, text[]),
  public.submit_verification(text, text, text, text),
  public.request_withdrawal(bigint),
  public.mark_notifications_read(uuid[]),
  public.register_device(text, text),
  public.unregister_device(text),
  -- admin RPCs check the role themselves
  public.resolve_dispute(uuid, public.dispute_resolution, bigint, bigint, uuid, text),
  public.review_verification(uuid, boolean, text),
  public.admin_set_profile_status(uuid, public.profile_status, text),
  public.admin_review_request(uuid, boolean, text)
to authenticated;

-- RLS helpers are evaluated for anon too (campus list at sign-up); both return false/null without a session.
grant execute on function public.is_admin(), public.my_campus() to anon;

-- Service-role RPCs (Edge Functions only)
grant execute on function
  public.svc_create_payment(uuid, bigint, text, text),
  public.svc_confirm_payment(text, uuid, bigint, text, jsonb),
  public.svc_fail_payment(text, jsonb),
  public.svc_save_bank_account(uuid, text, text, text, text, text),
  public.svc_settle_payout(text, boolean, text, text)
to service_role;

-- New functions must not be callable by clients until granted on purpose.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy campuses_read  on public.campuses for select to anon, authenticated using (active or public.is_admin());
create policy campuses_admin on public.campuses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy places_read  on public.places for select to authenticated using (campus_id = public.my_campus() or public.is_admin());
create policy places_admin on public.places for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy keywords_admin on public.prohibited_keywords for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_self  on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy verifications_read on public.verifications for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy trips_read on public.trips for select to authenticated
  using (campus_id = public.my_campus() or public.is_admin());

create policy requests_read on public.requests for select to authenticated using (
  requester_id = auth.uid()
  or public.is_admin()
  or (campus_id = public.my_campus() and status = 'posted'
      and (target_trip_id is null
           or exists (select 1 from public.trips t where t.id = target_trip_id and t.traveler_id = auth.uid())))
  or exists (select 1 from public.jobs j where j.request_id = requests.id and j.traveler_id = auth.uid())
);

create policy jobs_read on public.jobs for select to authenticated
  using (auth.uid() in (requester_id, traveler_id) or public.is_admin());

create policy codes_read on public.job_handoff_codes for select to authenticated using (requester_id = auth.uid());

create policy job_events_read on public.job_events for select to authenticated using (
  public.is_admin() or exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.requester_id, j.traveler_id))
);

create policy messages_read on public.messages for select to authenticated using (
  public.is_admin() or exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.requester_id, j.traveler_id))
);
create policy messages_send on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and kind in ('text', 'photo')
  and substitute_amount is null and decision is null
  and exists (select 1 from public.jobs j
               where j.id = job_id and auth.uid() in (j.requester_id, j.traveler_id)
                 and (j.status in ('accepted', 'purchased', 'in_transit', 'disputed')
                      or (j.status = 'completed' and j.completed_at > now() - interval '48 hours')))
);

create policy wallets_read on public.wallets for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy ledger_accounts_read on public.ledger_accounts for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy ledger_entries_read on public.ledger_entries for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.ledger_accounts a where a.id = account_id and a.kind = 'user_available' and a.profile_id = auth.uid())
);
create policy payments_read on public.payments for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy payouts_read on public.payouts for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy bank_accounts_read on public.bank_accounts for select to authenticated using (profile_id = auth.uid() or public.is_admin());

create policy ratings_read on public.ratings for select to authenticated
  using (auth.uid() in (rater_id, rated_id) or public.is_admin());

create policy disputes_read on public.disputes for select to authenticated using (
  public.is_admin() or exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.requester_id, j.traveler_id))
);

create policy notifications_read on public.notifications for select to authenticated using (profile_id = auth.uid());
create policy devices_read on public.devices for select to authenticated using (profile_id = auth.uid());
create policy audit_read on public.admin_audit for select to authenticated using (public.is_admin());

-- ─── Storage ────────────────────────────────────────────────────────────────
-- Paths: <bucket>/<uploader uid>/<anything>. Receipts and job photos use
-- <uid>/<job id>/<file> so job participants can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',        'avatars',        true,  2097152, array['image/jpeg','image/png','image/webp']),
  ('id-documents',   'id-documents',   false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('receipts',       'receipts',       false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('job-photos',     'job-photos',     false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('request-photos', 'request-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "own folder upload" on storage.objects for insert to authenticated with check (
  bucket_id in ('avatars', 'id-documents', 'receipts', 'job-photos', 'request-photos')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "own folder replace" on storage.objects for update to authenticated using (
  bucket_id in ('avatars') and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "avatars read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "id documents read" on storage.objects for select to authenticated using (
  bucket_id = 'id-documents' and public.is_admin()
);
create policy "job files read" on storage.objects for select to authenticated using (
  bucket_id in ('receipts', 'job-photos') and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.jobs j
                where j.id::text = (storage.foldername(name))[2]
                  and auth.uid() in (j.requester_id, j.traveler_id))
  )
);
create policy "request photos read" on storage.objects for select to authenticated using (
  bucket_id = 'request-photos'
);

-- ─── Realtime ───────────────────────────────────────────────────────────────
alter publication supabase_realtime add table
  public.requests, public.trips, public.jobs, public.messages, public.notifications, public.wallets;

-- ─── Push/email dispatch ────────────────────────────────────────────────────
-- Each new notification calls the `dispatch-notification` Edge Function, if
-- the Vault holds `project_url` and `service_role_key` (set per environment).
create extension if not exists pg_net with schema extensions;

create or replace function private.dispatch_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return new;
  end if;
  perform net.http_post(
    url     := v_url || '/functions/v1/dispatch-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := jsonb_build_object('notification_id', new.id)
  );
  return new;
end $$;

create trigger notifications_dispatch after insert on public.notifications
  for each row execute function private.dispatch_notification();

-- ─── Schedules ──────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
select cron.schedule('relay-timeouts',     '*/5 * * * *', $$select private.run_timeouts()$$);
select cron.schedule('relay-ledger-check', '0 3 * * *',   $$select private.run_daily_ledger_check()$$);
