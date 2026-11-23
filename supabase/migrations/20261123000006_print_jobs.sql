-- 299 RELAY — print jobs: documents, print options, and treating 'print' like 'buy'
-- (purchase advance, receipt, item cap). Function bodies below are the live
-- definitions with every buy-only check widened to ('buy', 'print').

-- ─── Data ───────────────────────────────────────────────────────────────────
alter table public.requests drop constraint requests_check;
alter table public.requests add constraint requests_budget_matches_type check ((type in ('buy', 'print')) = (item_budget > 0));
alter table public.requests add column print_options jsonb;
alter table public.trips alter column job_types set default array['buy','pick_up','drop_off','print']::public.request_type[];

create table public.request_files (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  path        text not null unique,
  name        text not null,
  size_bytes  bigint,
  pages       integer check (pages > 0),
  created_at  timestamptz not null default now()
);
create index request_files_request_idx on public.request_files (request_id);
alter table public.request_files enable row level security;
grant select on public.request_files to authenticated;
-- File names and page counts are visible to whoever can see the request (feed
-- preview); the documents themselves are protected by the storage policy below.
create policy request_files_read on public.request_files for select to authenticated using (
  exists (select 1 from public.requests r where r.id = request_id)
);

-- ─── Storage: documents readable by the requester and the traveler on the job ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 20971520, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "own folder upload" on storage.objects;
create policy "own folder upload" on storage.objects for insert to authenticated with check (
  bucket_id in ('avatars', 'id-documents', 'receipts', 'job-photos', 'request-photos', 'documents')
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "documents read" on storage.objects for select to authenticated using (
  bucket_id = 'documents' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.request_files f
                 join public.jobs j on j.request_id = f.request_id and j.status <> 'cancelled'
                where f.path = objects.name and auth.uid() = j.traveler_id)  -- objects.name: request_files has its own "name"
  )
);

-- ─── Functions ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_job(p_request uuid, p_trip uuid DEFAULT NULL::uuid)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me     public.profiles := private.me_verified();
  v_req  public.requests;
  v_trip public.trips;
  v_job  public.jobs;
  v_code text;
begin
  update requests set status = 'accepted'
   where id = p_request and status = 'posted' and deadline > now() and campus_id = me.campus_id
  returning * into v_req;
  if not found then
    perform private.err('already_taken', 'Someone else took this one');
  end if;
  if v_req.requester_id = me.id then perform private.err('own_request', 'you cannot carry your own request'); end if;

  -- A request sent to a specific trip can only be accepted by that trip's traveler.
  if v_req.target_trip_id is not null then
    p_trip := v_req.target_trip_id;
  end if;

  if p_trip is not null then
    select * into v_trip from trips where id = p_trip for update;
    if not found or v_trip.traveler_id <> me.id then perform private.err('trip_not_found'); end if;
    if v_trip.status <> 'live' or v_trip.slots_taken >= v_trip.capacity then
      perform private.err('trip_full', 'your trip has no free slots');
    end if;
    update trips set slots_taken = slots_taken + 1,
                     status = case when slots_taken + 1 >= capacity then 'full' else 'live' end::trip_status
     where id = p_trip;
  end if;

  if v_req.type in ('buy', 'print') then
    if v_req.item_budget > private.item_cap(me) then
      perform private.err('over_item_cap', format('your item cap is %s', private.naira(private.item_cap(me))));
    end if;
    if exists (select 1 from jobs where traveler_id = me.id and advance_amount > 0 and status = 'accepted') then
      perform private.err('unfinished_advance', 'finish your current buy job before taking another');
    end if;
  end if;

  insert into jobs (campus_id, request_id, requester_id, traveler_id, trip_id, advance_amount)
  values (v_req.campus_id, v_req.id, v_req.requester_id, me.id, p_trip,
          case when v_req.type in ('buy', 'print') then v_req.item_budget else 0 end)
  returning * into v_job;

  insert into job_events (job_id, from_status, to_status, actor_id, note)
  values (v_job.id, null, 'accepted', me.id, 'Accepted');

  -- Purchase advance: the item budget moves to the traveler now so they never front cash.
  if v_job.advance_amount > 0 then
    perform private.transfer(gen_random_uuid(), private.escrow_account(v_req.id), private.user_account(me.id),
                             v_job.advance_amount, 'purchase_advance', v_req.id, v_job.id);
  end if;

  -- pgcrypto bytes, not random(): the code guards money.
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 10000)::text, 4, '0');
  insert into job_handoff_codes (job_id, requester_id, code) values (v_job.id, v_req.requester_id, v_code);

  perform private.system_message(v_job.id, format('%s accepted this job.', split_part(me.full_name, ' ', 1)));
  perform private.notify(v_req.requester_id, 'job_accepted', 'Your request was accepted',
    format('%s is on it. Your handoff code is in the app.', split_part(me.full_name, ' ', 1)), '/jobs/' || v_job.id);
  return v_job;
end $function$
;

CREATE OR REPLACE FUNCTION public.confirm_purchase(p_job uuid, p_receipt_path text, p_receipt_amount bigint)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_req public.requests;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  select * into v_req from requests where id = v_job.request_id;
  if v_req.type not in ('buy', 'print') then perform private.err('not_a_buy_job'); end if;
  if coalesce(p_receipt_path, '') = '' then perform private.err('receipt_required'); end if;
  if p_receipt_amount is null or p_receipt_amount <= 0 then perform private.err('invalid_amount'); end if;
  if p_receipt_amount > v_job.advance_amount then
    perform private.err('over_budget', 'ask the requester to approve the new price in chat first');
  end if;

  -- Unused budget goes back to the requester straight away.
  perform private.transfer(gen_random_uuid(), private.user_account(me.id), private.user_account(v_job.requester_id),
                           v_job.advance_amount - p_receipt_amount, 'unused_budget', v_job.request_id, v_job.id);

  update jobs set receipt_path = p_receipt_path, receipt_amount = p_receipt_amount where id = p_job;
  v_job := private.set_job_status(p_job, 'purchased', me.id, format('Bought for %s', private.naira(p_receipt_amount)));
  perform private.system_message(p_job, format('Item bought for %s. Receipt uploaded.', private.naira(p_receipt_amount)));
  perform private.notify(v_job.requester_id, 'job_purchased', 'Your item was bought',
    format('Receipt: %s.', private.naira(p_receipt_amount)), '/jobs/' || p_job);
  return v_job;
end $function$
;

CREATE OR REPLACE FUNCTION private.quote_fee(p_type request_type, p_from uuid, p_handoff uuid, p_item_budget bigint, p_urgent boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_from_zone text; v_to_zone text; v_fee bigint;
begin
  select zone into v_from_zone from public.places where id = p_from;
  select zone into v_to_zone   from public.places where id = p_handoff;
  if p_type in ('buy', 'print') then
    v_fee := 20000 + ceil(coalesce(p_item_budget, 0) * 0.05 / 100.0)::bigint * 100;
  elsif v_from_zone is not distinct from v_to_zone then
    v_fee := 15000;
  else
    v_fee := 30000;
  end if;
  if p_urgent then
    v_fee := v_fee + 10000;
  end if;
  return v_fee;
end $function$
;

CREATE OR REPLACE FUNCTION public.quote_request(p_type request_type, p_from_place uuid, p_handoff_place uuid, p_item_budget bigint DEFAULT 0, p_urgent boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_fee bigint := private.quote_fee(p_type, p_from_place, p_handoff_place, p_item_budget, p_urgent);
begin
  return jsonb_build_object(
    'suggested_fee', v_fee,
    'item_budget',   case when p_type in ('buy', 'print') then p_item_budget else 0 end,
    'total_hold',    v_fee + case when p_type in ('buy', 'print') then p_item_budget else 0 end,
    'commission',    private.commission(v_fee),
    'traveler_earns', v_fee - private.commission(v_fee)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.start_delivery(p_job uuid)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_type public.request_type;
begin
  select * into v_job from jobs where id = p_job;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  select type into v_type from requests where id = v_job.request_id;
  if v_type in ('buy', 'print') and v_job.status <> 'purchased' then
    perform private.err('purchase_first', 'upload the receipt before heading to the handoff');
  end if;
  v_job := private.set_job_status(p_job, 'in_transit', me.id, 'On the way');
  perform private.notify(v_job.requester_id, 'job_in_transit', 'On the way', 'Have your handoff code ready.', '/jobs/' || p_job);
  return v_job;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_handoff_code(p_job uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me     public.profiles := private.me();
  v_job  public.jobs;
  v_req  public.requests;
  v_real text;
  v_comm bigint;
  v_txn  uuid := gen_random_uuid();
  v_escrow uuid;
  v_left bigint;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  if v_job.status not in ('accepted', 'purchased', 'in_transit') then
    perform private.err('invalid_status_change', format('job is %s', v_job.status));
  end if;
  select * into v_req from requests where id = v_job.request_id;
  if v_req.type in ('buy', 'print') and v_job.status = 'accepted' then
    perform private.err('purchase_first', 'upload the receipt before handing off');
  end if;

  select code into v_real from job_handoff_codes where job_id = p_job;
  if p_code is distinct from v_real then
    update jobs set code_attempts = code_attempts + 1 where id = p_job returning * into v_job;
    if v_job.code_attempts >= 5 then
      perform private.set_job_status(p_job, 'disputed', null, 'Too many wrong handoff codes');
      insert into disputes (job_id, reporter_id, reason, details)
      values (p_job, null, 'code_lockout', 'Locked after 5 wrong handoff codes.');
      perform private.notify(v_job.requester_id, 'dispute_opened', 'Handoff locked',
        'Too many wrong codes were entered. An admin will review this job.', '/jobs/' || p_job);
      perform private.notify(me.id, 'dispute_opened', 'Handoff locked',
        'Too many wrong codes were entered. An admin will review this job.', '/jobs/' || p_job);
      return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked', true);
    end if;
    return jsonb_build_object('ok', false, 'attempts_left', 5 - v_job.code_attempts, 'locked', false);
  end if;

  -- Release the fee: traveler gets fee − commission, platform gets commission.
  v_comm := private.commission(v_req.fee);
  v_escrow := private.escrow_account(v_req.id);
  perform private.transfer(v_txn, v_escrow, private.user_account(me.id), v_req.fee - v_comm, 'delivery_fee', v_req.id, p_job);
  perform private.transfer(v_txn, v_escrow, private.system_account('platform_revenue'), v_comm, 'commission', v_req.id, p_job);
  -- Anything still held (should be zero) returns to the requester.
  select balance into v_left from ledger_accounts where id = v_escrow;
  if v_left > 0 then
    perform private.refund_escrow(v_req.id, p_job, 'escrow_remainder');
  end if;

  v_job := private.set_job_status(p_job, 'completed', me.id, 'Handoff code confirmed');
  update requests set status = 'completed' where id = v_req.id;
  update profiles set jobs_carried = jobs_carried + 1 where id = me.id;
  update profiles set jobs_requested = jobs_requested + 1 where id = v_job.requester_id;
  if v_job.trip_id is not null then
    update trips set slots_taken = slots_taken - 1,
                     status = case when status = 'full' then 'live' else status end
     where id = v_job.trip_id and status in ('live', 'full');
  end if;

  perform private.system_message(p_job, 'Delivered. Thanks for using 299 RELAY.');
  perform private.notify(v_job.requester_id, 'job_completed', 'Delivered', 'Rate your traveler.', '/jobs/' || p_job);
  perform private.notify(me.id, 'job_completed', 'Job complete',
    format('%s added to your wallet.', private.naira(v_req.fee - v_comm)), '/jobs/' || p_job, true);
  return jsonb_build_object('ok', true, 'attempts_left', 5 - v_job.code_attempts, 'locked', false,
                            'earned', v_req.fee - v_comm, 'job', to_jsonb(v_job));
end $function$
;



drop function public.create_request(public.request_type, text, uuid, uuid, timestamptz, bigint, bigint, boolean, text, uuid);
CREATE OR REPLACE FUNCTION public.create_request(p_type request_type, p_items_text text, p_from_place uuid, p_handoff_place uuid, p_deadline timestamp with time zone, p_item_budget bigint DEFAULT 0, p_fee bigint DEFAULT NULL::bigint, p_urgent boolean DEFAULT false, p_photo_path text DEFAULT NULL::text, p_trip uuid DEFAULT NULL::uuid, p_files jsonb DEFAULT NULL::jsonb, p_print_options jsonb DEFAULT NULL::jsonb)
 RETURNS requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  me        public.profiles := private.me_verified();
  v_campus  public.campuses;
  v_from    public.places;
  v_handoff public.places;
  v_trip    public.trips;
  v_quote   bigint;
  v_fee     bigint;
  v_budget  bigint := case when p_type in ('buy', 'print') then coalesce(p_item_budget, 0) else 0 end;
  v_flags   text[];
  v_req     public.requests;
  v_local   time;
  v_file    jsonb;
begin
  select * into v_campus from campuses where id = me.campus_id;

  select * into v_from from places where id = p_from_place and campus_id = me.campus_id and active;
  if not found then perform private.err('invalid_place', 'pickup place not found on your campus'); end if;
  select * into v_handoff from places where id = p_handoff_place and campus_id = me.campus_id and active;
  if not found then perform private.err('invalid_place', 'handoff place not found on your campus'); end if;
  if not v_handoff.is_handoff_point then
    perform private.err('not_a_handoff_point', 'handoffs happen only at listed public points');
  end if;

  if p_deadline <= now() + interval '15 minutes' then
    perform private.err('deadline_too_soon', 'deadline must be at least 15 minutes away');
  end if;
  if p_deadline > now() + interval '7 days' then
    perform private.err('deadline_too_far', 'deadline must be within 7 days');
  end if;
  v_local := (p_deadline at time zone v_campus.timezone)::time;
  if v_local > v_campus.handoff_curfew or v_local < time '06:00' then
    perform private.err('after_curfew', format('handoffs must be between 06:00 and %s', to_char(v_campus.handoff_curfew, 'HH24:MI')));
  end if;

  if p_type in ('buy', 'print') and v_budget <= 0 then
    perform private.err('budget_required', 'buy requests need an item budget');
  end if;
  if v_budget > private.item_cap(me) then
    perform private.err('over_item_cap', format('your item cap is %s', private.naira(private.item_cap(me))));
  end if;

  v_quote := private.quote_fee(p_type, p_from_place, p_handoff_place, v_budget, p_urgent);
  v_fee := coalesce(p_fee, v_quote);
  if v_fee < v_quote then
    perform private.err('fee_below_suggested', format('minimum fee is %s', private.naira(v_quote)));
  end if;
  if v_fee > 500000 then
    perform private.err('fee_too_high', 'fee cannot exceed ₦5,000');
  end if;

  if p_trip is not null then
    select * into v_trip from trips
     where id = p_trip and campus_id = me.campus_id and status = 'live'
       and leaves_at > now() and leaves_at < p_deadline;
    if not found then perform private.err('trip_unavailable', 'that trip is no longer taking requests'); end if;
    if v_trip.traveler_id = me.id then perform private.err('own_trip'); end if;
    if not (p_type = any (v_trip.job_types)) then
      perform private.err('trip_job_type', 'this traveler is not taking that kind of job');
    end if;
  end if;

  select array_agg(k.keyword) into v_flags
    from prohibited_keywords k
   where lower(p_items_text) ~ ('\m' || k.keyword || '\M');

  -- Print jobs carry 1-10 uploaded documents from the caller's own folder.
  if p_type = 'print' then
    if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) not between 1 and 10 then
      perform private.err('files_required', 'attach 1 to 10 documents to print');
    end if;
    for v_file in select * from jsonb_array_elements(p_files) loop
      if split_part(v_file ->> 'path', '/', 1) <> me.id::text
         or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = v_file ->> 'path') then
        perform private.err('invalid_upload_path', 'a document was not uploaded');
      end if;
    end loop;
  elsif p_files is not null then
    perform private.err('files_not_allowed');
  end if;

  insert into requests (campus_id, requester_id, type, items_text, photo_path, from_place_id, handoff_place_id,
                        deadline, item_budget, fee, urgent, target_trip_id, flagged_keywords, status, print_options)
  values (me.campus_id, me.id, p_type, trim(p_items_text), p_photo_path, p_from_place, p_handoff_place,
          p_deadline, v_budget, v_fee, p_urgent, p_trip, v_flags,
          (case when v_flags is null then 'posted' else 'review' end)::request_status,
          case when p_type = 'print' then p_print_options end)
  returning * into v_req;

  if p_type = 'print' then
    insert into request_files (request_id, path, name, size_bytes, pages)
    select v_req.id, f ->> 'path', left(coalesce(f ->> 'name', 'document'), 200),
           nullif(f ->> 'size', '')::bigint, nullif(f ->> 'pages', '')::int
      from jsonb_array_elements(p_files) f;
  end if;

  -- Hold budget + fee in this request's escrow.
  perform private.transfer(gen_random_uuid(), private.user_account(me.id), private.escrow_account(v_req.id),
                           v_budget + v_fee, 'request_hold', v_req.id);

  if v_req.status = 'review' then
    perform private.notify(me.id, 'request_review', 'Your request is being reviewed',
      'It mentions something that may not be allowed. An admin will check it shortly.', '/requests/' || v_req.id);
  elsif p_trip is not null then
    perform private.notify(v_trip.traveler_id, 'trip_request', 'New request for your trip',
      format('%s to %s · earn %s', initcap(replace(p_type::text, '_', ' ')), v_handoff.name,
             private.naira(v_fee - private.commission(v_fee))), '/requests/' || v_req.id);
  else
    perform private.notify_matching_travelers(v_req);
  end if;

  return v_req;
end $function$

;

grant execute on function public.create_request(public.request_type, text, uuid, uuid, timestamptz, bigint, bigint, boolean, text, uuid, jsonb, jsonb) to authenticated;

-- Migrations run as a role that ALTER DEFAULT PRIVILEGES doesn't cover, so a
-- recreated function is executable by PUBLIC again. Revoke explicitly.
revoke execute on function public.create_request(public.request_type, text, uuid, uuid, timestamptz, bigint, bigint, boolean, text, uuid, jsonb, jsonb) from public, anon;
