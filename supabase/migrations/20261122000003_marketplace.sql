-- 299 RELAY — marketplace RPCs.
--
-- Every money or status change runs here, in one transaction, as SECURITY
-- DEFINER with an explicit caller check. Clients call them via supabase.rpc().
-- Errors are raised with a stable snake_case message (see private.err).

-- ─── Quotes ─────────────────────────────────────────────────────────────────
create or replace function public.quote_request(
  p_type public.request_type,
  p_from_place uuid,
  p_handoff_place uuid,
  p_item_budget bigint default 0,
  p_urgent boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_fee bigint := private.quote_fee(p_type, p_from_place, p_handoff_place, p_item_budget, p_urgent);
begin
  return jsonb_build_object(
    'suggested_fee', v_fee,
    'item_budget',   case when p_type = 'buy' then p_item_budget else 0 end,
    'total_hold',    v_fee + case when p_type = 'buy' then p_item_budget else 0 end,
    'commission',    private.commission(v_fee),
    'traveler_earns', v_fee - private.commission(v_fee)
  );
end $$;

-- ─── Requests ───────────────────────────────────────────────────────────────
create or replace function public.create_request(
  p_type            public.request_type,
  p_items_text      text,
  p_from_place      uuid,
  p_handoff_place   uuid,
  p_deadline        timestamptz,
  p_item_budget     bigint default 0,
  p_fee             bigint default null,   -- null = suggested fee; may be raised, never lowered
  p_urgent          boolean default false,
  p_photo_path      text default null,
  p_trip            uuid default null      -- send straight to this trip
) returns public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  me        public.profiles := private.me_verified();
  v_campus  public.campuses;
  v_from    public.places;
  v_handoff public.places;
  v_trip    public.trips;
  v_quote   bigint;
  v_fee     bigint;
  v_budget  bigint := case when p_type = 'buy' then coalesce(p_item_budget, 0) else 0 end;
  v_flags   text[];
  v_req     public.requests;
  v_local   time;
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

  if p_type = 'buy' and v_budget <= 0 then
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

  insert into requests (campus_id, requester_id, type, items_text, photo_path, from_place_id, handoff_place_id,
                        deadline, item_budget, fee, urgent, target_trip_id, flagged_keywords, status)
  values (me.campus_id, me.id, p_type, trim(p_items_text), p_photo_path, p_from_place, p_handoff_place,
          p_deadline, v_budget, v_fee, p_urgent, p_trip, v_flags,
          (case when v_flags is null then 'posted' else 'review' end)::request_status)
  returning * into v_req;

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
end $$;

-- Travelers with a live trip heading to the pickup place (or its zone), leaving
-- before the deadline, with a free slot and the right job type.
create or replace function private.notify_matching_travelers(r public.requests) returns integer
language plpgsql as $$
declare
  v_place public.places;
  v_count integer;
begin
  select * into v_place from public.places where id = r.from_place_id;
  insert into public.notifications (profile_id, kind, title, body, link)
  select distinct on (t.traveler_id) t.traveler_id, 'route_match',
         'A request on your route',
         format('%s at %s · earn %s', initcap(replace(r.type::text, '_', ' ')), v_place.name,
                private.naira(r.fee - private.commission(r.fee))),
         '/requests/' || r.id
    from public.trips t
    join public.places dest on dest.id = t.to_place_id
    join public.profiles p on p.id = t.traveler_id
   where t.campus_id = r.campus_id
     and t.status = 'live'
     and t.slots_taken < t.capacity
     and t.leaves_at < r.deadline
     and t.back_by > now()
     and t.traveler_id <> r.requester_id
     and r.type = any (t.job_types)
     and (t.to_place_id = r.from_place_id or dest.zone = v_place.zone)
     and p.status = 'verified';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Requester cancels. Before acceptance: full refund. After acceptance but
-- before purchase: the advance is reversed from the traveler and everything
-- returns to the requester. After purchase: open a dispute instead.
create or replace function public.cancel_request(p_request uuid) returns public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_req public.requests;
  v_job public.jobs;
begin
  select * into v_req from requests where id = p_request for update;
  if not found or v_req.requester_id <> me.id then perform private.err('request_not_found'); end if;

  if v_req.status in ('posted', 'review') then
    perform private.refund_escrow(v_req.id, null, 'request_cancelled');
    update requests set status = 'cancelled' where id = v_req.id returning * into v_req;
    return v_req;
  end if;

  if v_req.status = 'accepted' then
    select * into v_job from jobs where request_id = v_req.id and status <> 'cancelled' for update;
    if v_job.status <> 'accepted' then
      perform private.err('too_late_to_cancel', 'the item is already bought; report an issue instead');
    end if;
    perform private.cancel_job_internal(v_job, me.id, 'Cancelled by requester');
    select * into v_req from requests where id = v_req.id;
    return v_req;
  end if;

  perform private.err('cannot_cancel', format('request is %s', v_req.status));
end $$;

-- Return everything left in a request's escrow to the requester.
create or replace function private.refund_escrow(p_request uuid, p_job uuid, p_reason text) returns bigint
language plpgsql as $$
declare
  v_escrow uuid := private.escrow_account(p_request);
  v_left   bigint;
  v_owner  uuid;
begin
  select balance, profile_id into v_left, v_owner from public.ledger_accounts where id = v_escrow for update;
  perform private.transfer(gen_random_uuid(), v_escrow, private.user_account(v_owner), v_left, p_reason, p_request, p_job);
  return v_left;
end $$;

-- Undo an accepted (not yet purchased) job: claw back the advance, refund the
-- requester, free the trip slot.
create or replace function private.cancel_job_internal(v_job public.jobs, p_actor uuid, p_note text) returns void
language plpgsql as $$
declare
  v_txn uuid := gen_random_uuid();
begin
  if v_job.advance_amount > 0 then
    begin
      perform private.transfer(v_txn, private.user_account(v_job.traveler_id), private.escrow_account(v_job.request_id),
                               v_job.advance_amount, 'advance_reversed', v_job.request_id, v_job.id);
    exception when others then
      if sqlerrm = 'insufficient_funds' then
        perform private.err('advance_spent', 'the traveler has already used the advance; report an issue instead');
      end if;
      raise;
    end;
  end if;
  perform private.refund_escrow(v_job.request_id, v_job.id, 'job_cancelled');
  perform private.set_job_status(v_job.id, 'cancelled', p_actor, p_note);
  update public.requests set status = 'cancelled' where id = v_job.request_id;
  if v_job.trip_id is not null then
    update public.trips set slots_taken = slots_taken - 1,
                            status = case when status = 'full' then 'live' else status end
     where id = v_job.trip_id;
  end if;
  perform private.notify(case when p_actor = v_job.requester_id then v_job.traveler_id else v_job.requester_id end,
    'job_cancelled', 'Job cancelled', p_note, '/jobs/' || v_job.id);
end $$;

-- Traveler backs out before buying: the request goes back to the feed and the
-- advance returns to escrow (requester's hold stays in place).
create or replace function public.release_job(p_job uuid) returns public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_req public.requests;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  if v_job.status <> 'accepted' then
    perform private.err('too_late_to_release', 'the job is already under way; report an issue instead');
  end if;

  if v_job.advance_amount > 0 then
    begin
      perform private.transfer(gen_random_uuid(), private.user_account(me.id), private.escrow_account(v_job.request_id),
                               v_job.advance_amount, 'advance_returned', v_job.request_id, v_job.id);
    exception when others then
      if sqlerrm = 'insufficient_funds' then
        perform private.err('advance_spent', 'return the advance to your wallet before releasing this job');
      end if;
      raise;
    end;
  end if;
  perform private.set_job_status(p_job, 'cancelled', me.id, 'Released by traveler');
  if v_job.trip_id is not null then
    update trips set slots_taken = slots_taken - 1, status = case when status = 'full' then 'live' else status end
     where id = v_job.trip_id;
  end if;
  update requests set status = case when deadline > now() then 'posted' else 'expired' end::request_status
   where id = v_job.request_id returning * into v_req;
  if v_req.status = 'expired' then
    perform private.refund_escrow(v_req.id, null, 'request_expired');
  end if;
  perform private.notify(v_job.requester_id, 'job_released', 'Your traveler dropped the job',
    case when v_req.status = 'posted' then 'Your request is back in the feed.' else 'Your money is back in your wallet.' end,
    '/requests/' || v_req.id);
  return v_req;
end $$;

-- ─── Trips ──────────────────────────────────────────────────────────────────
create or replace function public.create_trip(
  p_from_place uuid,
  p_to_place   uuid,
  p_leaves_at  timestamptz,
  p_back_by    timestamptz,
  p_capacity   smallint,
  p_job_types  public.request_type[] default array['buy','pick_up','drop_off']::public.request_type[],
  p_note       text default null
) returns public.trips
language plpgsql security definer set search_path = public, extensions as $$
declare
  me     public.profiles := private.me_verified();
  v_trip public.trips;
  v_n    integer;
begin
  if not exists (select 1 from places where id = p_from_place and campus_id = me.campus_id and active)
     or not exists (select 1 from places where id = p_to_place and campus_id = me.campus_id and active) then
    perform private.err('invalid_place');
  end if;
  if p_leaves_at < now() - interval '5 minutes' or p_leaves_at > now() + interval '7 days' then
    perform private.err('invalid_time', 'departure must be within the next 7 days');
  end if;
  if p_back_by <= p_leaves_at or p_back_by > p_leaves_at + interval '12 hours' then
    perform private.err('invalid_time', 'return must be after departure and within 12 hours');
  end if;
  if coalesce(array_length(p_job_types, 1), 0) = 0 then
    perform private.err('invalid_job_types');
  end if;
  select count(*) into v_n from trips where traveler_id = me.id and status in ('live', 'full');
  if v_n >= 3 then perform private.err('too_many_trips', 'you can have at most 3 open trips'); end if;

  insert into trips (campus_id, traveler_id, from_place_id, to_place_id, leaves_at, back_by, capacity, job_types, note)
  values (me.campus_id, me.id, p_from_place, p_to_place, p_leaves_at, p_back_by, p_capacity, p_job_types, p_note)
  returning * into v_trip;
  return v_trip;
end $$;

-- Cancelling a trip releases its not-yet-started jobs back to the feed.
create or replace function public.cancel_trip(p_trip uuid) returns public.trips
language plpgsql security definer set search_path = public, extensions as $$
declare
  me     public.profiles := private.me();
  v_trip public.trips;
  v_job  public.jobs;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found or v_trip.traveler_id <> me.id then perform private.err('trip_not_found'); end if;
  if v_trip.status not in ('live', 'full') then perform private.err('trip_closed'); end if;
  if exists (select 1 from jobs where trip_id = p_trip and status in ('purchased', 'in_transit', 'disputed')) then
    perform private.err('trip_has_active_jobs', 'finish or hand off jobs already under way first');
  end if;

  for v_job in select * from jobs where trip_id = p_trip and status = 'accepted' loop
    perform public.release_job(v_job.id);
  end loop;
  -- Requests sent to this trip but not accepted go to the open feed.
  update requests set target_trip_id = null where target_trip_id = p_trip and status = 'posted';

  update trips set status = 'cancelled' where id = p_trip returning * into v_trip;
  return v_trip;
end $$;

-- ─── Accepting ──────────────────────────────────────────────────────────────
-- First acceptance wins: the conditional UPDATE on requests is the race guard.
create or replace function public.accept_job(p_request uuid, p_trip uuid default null) returns public.jobs
language plpgsql security definer set search_path = public, extensions as $$
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

  if v_req.type = 'buy' then
    if v_req.item_budget > private.item_cap(me) then
      perform private.err('over_item_cap', format('your item cap is %s', private.naira(private.item_cap(me))));
    end if;
    if exists (select 1 from jobs where traveler_id = me.id and advance_amount > 0 and status = 'accepted') then
      perform private.err('unfinished_advance', 'finish your current buy job before taking another');
    end if;
  end if;

  insert into jobs (campus_id, request_id, requester_id, traveler_id, trip_id, advance_amount)
  values (v_req.campus_id, v_req.id, v_req.requester_id, me.id, p_trip,
          case when v_req.type = 'buy' then v_req.item_budget else 0 end)
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
end $$;

-- ─── Doing the job ──────────────────────────────────────────────────────────
create or replace function public.confirm_purchase(p_job uuid, p_receipt_path text, p_receipt_amount bigint)
returns public.jobs
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_req public.requests;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  select * into v_req from requests where id = v_job.request_id;
  if v_req.type <> 'buy' then perform private.err('not_a_buy_job'); end if;
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
end $$;

create or replace function public.start_delivery(p_job uuid) returns public.jobs
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_type public.request_type;
begin
  select * into v_job from jobs where id = p_job;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  select type into v_type from requests where id = v_job.request_id;
  if v_type = 'buy' and v_job.status <> 'purchased' then
    perform private.err('purchase_first', 'upload the receipt before heading to the handoff');
  end if;
  v_job := private.set_job_status(p_job, 'in_transit', me.id, 'On the way');
  perform private.notify(v_job.requester_id, 'job_in_transit', 'On the way', 'Have your handoff code ready.', '/jobs/' || p_job);
  return v_job;
end $$;

-- Traveler proposes a price change or substitute in chat.
create or replace function public.propose_substitute(p_job uuid, p_body text, p_new_amount bigint, p_photo_path text default null)
returns public.messages
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_msg public.messages;
begin
  select * into v_job from jobs where id = p_job;
  if not found or v_job.traveler_id <> me.id then perform private.err('job_not_found'); end if;
  if v_job.status <> 'accepted' or v_job.advance_amount = 0 then
    perform private.err('invalid_status_change', 'substitutes are only for buy jobs not yet bought');
  end if;
  if p_new_amount is null or p_new_amount <= 0 then perform private.err('invalid_amount'); end if;
  update messages set decision = 'declined' where job_id = p_job and kind = 'substitute' and decision = 'pending';
  insert into messages (job_id, sender_id, kind, body, photo_path, substitute_amount, decision)
  values (p_job, me.id, 'substitute', p_body, p_photo_path, p_new_amount, 'pending')
  returning * into v_msg;
  perform private.notify(v_job.requester_id, 'substitute', 'Price change to approve',
    format('New total for items: %s', private.naira(p_new_amount)), '/jobs/' || p_job);
  return v_msg;
end $$;

-- Requester approves (topping up escrow and the advance if the price rose) or declines.
create or replace function public.respond_substitute(p_message uuid, p_approve boolean) returns public.messages
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_msg public.messages;
  v_job public.jobs;
  v_req public.requests;
  v_diff bigint;
  v_txn uuid := gen_random_uuid();
begin
  select * into v_msg from messages where id = p_message for update;
  if not found or v_msg.kind <> 'substitute' then perform private.err('message_not_found'); end if;
  select * into v_job from jobs where id = v_msg.job_id for update;
  if v_job.requester_id <> me.id then perform private.err('message_not_found'); end if;
  if v_msg.decision <> 'pending' then perform private.err('already_decided'); end if;
  if v_job.status <> 'accepted' then perform private.err('invalid_status_change'); end if;

  if not p_approve then
    update messages set decision = 'declined' where id = p_message returning * into v_msg;
    perform private.system_message(v_job.id, 'Price change declined. You can cancel at no cost.');
    perform private.notify(v_job.traveler_id, 'substitute_declined', 'Price change declined', null, '/jobs/' || v_job.id);
    return v_msg;
  end if;

  select * into v_req from requests where id = v_job.request_id for update;
  v_diff := v_msg.substitute_amount - v_job.advance_amount;
  if v_msg.substitute_amount > private.item_cap(me) then
    perform private.err('over_item_cap');
  end if;
  if v_diff > 0 then
    -- Requester tops up escrow; escrow advances the extra to the traveler.
    perform private.transfer(v_txn, private.user_account(me.id), private.escrow_account(v_req.id), v_diff,
                             'substitute_topup', v_req.id, v_job.id);
    perform private.transfer(v_txn, private.escrow_account(v_req.id), private.user_account(v_job.traveler_id), v_diff,
                             'purchase_advance', v_req.id, v_job.id);
  end if;
  -- A lower price is settled by confirm_purchase returning the unused budget.
  update requests set item_budget = greatest(item_budget, v_msg.substitute_amount) where id = v_req.id;
  update jobs set advance_amount = advance_amount + greatest(v_diff, 0) where id = v_job.id;
  update messages set decision = 'approved' where id = p_message returning * into v_msg;
  perform private.system_message(v_job.id, format('New price approved: %s.', private.naira(v_msg.substitute_amount)));
  perform private.notify(v_job.traveler_id, 'substitute_approved', 'Price change approved', null, '/jobs/' || v_job.id);
  return v_msg;
end $$;

-- Traveler enters the requester's code. Correct: job completes and the fee is
-- released in the same transaction. Returns {ok, attempts_left, job}.
-- Wrong attempts are persisted, so this returns instead of raising.
create or replace function public.submit_handoff_code(p_job uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
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
  if v_req.type = 'buy' and v_job.status = 'accepted' then
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
end $$;

-- ─── Ratings and tips ───────────────────────────────────────────────────────
create or replace function public.rate_job(
  p_job uuid, p_stars smallint, p_tags text[] default '{}', p_comment text default null, p_tip bigint default 0
) returns public.ratings
language plpgsql security definer set search_path = public, extensions as $$
declare
  me      public.profiles := private.me();
  v_job   public.jobs;
  v_rated uuid;
  v_r     public.ratings;
begin
  select * into v_job from jobs where id = p_job;
  if not found or me.id not in (v_job.requester_id, v_job.traveler_id) then perform private.err('job_not_found'); end if;
  if v_job.status <> 'completed' then perform private.err('not_completed', 'rate after the handoff'); end if;
  if v_job.completed_at < now() - interval '7 days' then perform private.err('rating_closed'); end if;
  if coalesce(p_tip, 0) < 0 or coalesce(p_tip, 0) > 200000 then perform private.err('invalid_amount', 'tips are up to ₦2,000'); end if;

  v_rated := case when me.id = v_job.requester_id then v_job.traveler_id else v_job.requester_id end;
  insert into ratings (job_id, rater_id, rated_id, stars, tags, comment, tip_amount)
  values (p_job, me.id, v_rated, p_stars, coalesce(p_tags, '{}'), p_comment, coalesce(p_tip, 0))
  returning * into v_r;

  if v_r.tip_amount > 0 then
    perform private.transfer(gen_random_uuid(), private.user_account(me.id), private.user_account(v_rated),
                             v_r.tip_amount, 'tip', v_job.request_id, p_job);
  end if;

  update profiles p set rating_avg = s.avg, rating_count = s.n
    from (select round(avg(stars)::numeric, 2) avg, count(*) n from ratings where rated_id = v_rated) s
   where p.id = v_rated;

  perform private.notify(v_rated, 'rated', format('You got %s stars', p_stars),
    case when v_r.tip_amount > 0 then format('Plus a %s tip.', private.naira(v_r.tip_amount)) end, '/jobs/' || p_job);
  return v_r;
exception when unique_violation then
  perform private.err('already_rated');
end $$;

-- ─── Disputes ───────────────────────────────────────────────────────────────
create or replace function public.open_dispute(
  p_job uuid, p_reason text, p_details text default null, p_photo_paths text[] default '{}'
) returns public.disputes
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me();
  v_job public.jobs;
  v_d   public.disputes;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or me.id not in (v_job.requester_id, v_job.traveler_id) then perform private.err('job_not_found'); end if;
  if p_reason not in ('no_show', 'wrong_item', 'damaged_item', 'overcharged', 'safety', 'other') then
    perform private.err('invalid_reason');
  end if;
  if v_job.status = 'completed' and v_job.completed_at < now() - interval '48 hours' then
    perform private.err('dispute_window_closed', 'issues must be reported within 48 hours of delivery');
  end if;
  if v_job.status not in ('accepted', 'purchased', 'in_transit', 'completed') then
    perform private.err('invalid_status_change', format('job is %s', v_job.status));
  end if;

  -- A completed job's money is already released; the dispute is recorded for
  -- an admin to adjust from wallets, but the status stays completed.
  if v_job.status <> 'completed' then
    perform private.set_job_status(p_job, 'disputed', me.id, 'Issue reported: ' || p_reason);
  end if;
  insert into disputes (job_id, reporter_id, reason, details, photo_paths)
  values (p_job, me.id, p_reason, p_details, coalesce(p_photo_paths, '{}'))
  returning * into v_d;

  perform private.notify(case when me.id = v_job.requester_id then v_job.traveler_id else v_job.requester_id end,
    'dispute_opened', 'An issue was reported', 'Payment is paused while an admin reviews it.', '/jobs/' || p_job);
  return v_d;
exception when unique_violation then
  perform private.err('dispute_already_open');
end $$;

-- Admin decision. Splits what is left in escrow between requester and
-- traveler (commission only on what the traveler receives from the fee).
-- p_clawback moves money from the traveler's wallet to the requester (e.g. an
-- advance spent on the wrong item). p_strike adds a strike to one party.
create or replace function public.resolve_dispute(
  p_dispute    uuid,
  p_resolution public.dispute_resolution,
  p_to_requester bigint default null,   -- split only: amount of the remaining escrow to the requester
  p_clawback   bigint default 0,
  p_strike     uuid default null,
  p_note       text default null
) returns public.disputes
language plpgsql security definer set search_path = public, extensions as $$
declare
  me       public.profiles := private.me_admin();
  v_d      public.disputes;
  v_job    public.jobs;
  v_req    public.requests;
  v_escrow uuid;
  v_left   bigint;
  v_to_req bigint;
  v_to_trv bigint;
  v_comm   bigint := 0;
  v_txn    uuid := gen_random_uuid();
begin
  select * into v_d from disputes where id = p_dispute for update;
  if not found then perform private.err('dispute_not_found'); end if;
  if v_d.status <> 'open' then perform private.err('already_resolved'); end if;
  select * into v_job from jobs where id = v_d.job_id for update;
  select * into v_req from requests where id = v_job.request_id;

  v_escrow := private.escrow_account(v_req.id);
  select balance into v_left from ledger_accounts where id = v_escrow for update;

  v_to_req := case p_resolution
    when 'refund'  then v_left
    when 'release' then 0
    else coalesce(p_to_requester, 0) end;
  if v_to_req < 0 or v_to_req > v_left then
    perform private.err('invalid_amount', format('split must be between 0 and %s', private.naira(v_left)));
  end if;
  v_to_trv := v_left - v_to_req;
  if v_to_trv > 0 then
    v_comm := least(private.commission(v_req.fee), v_to_trv);
  end if;

  perform private.transfer(v_txn, v_escrow, private.user_account(v_job.requester_id), v_to_req, 'dispute_refund', v_req.id, v_job.id);
  perform private.transfer(v_txn, v_escrow, private.system_account('platform_revenue'), v_comm, 'commission', v_req.id, v_job.id);
  perform private.transfer(v_txn, v_escrow, private.user_account(v_job.traveler_id), v_to_trv - v_comm, 'dispute_release', v_req.id, v_job.id);
  if coalesce(p_clawback, 0) > 0 then
    perform private.transfer(v_txn, private.user_account(v_job.traveler_id), private.user_account(v_job.requester_id),
                             p_clawback, 'dispute_clawback', v_req.id, v_job.id);
  end if;

  if v_job.status = 'disputed' then
    perform private.set_job_status(v_job.id, case when p_resolution = 'refund' then 'refunded' else 'completed' end::job_status,
                                   me.id, 'Dispute resolved: ' || p_resolution);
    update requests set status = case when p_resolution = 'refund' then 'cancelled' else 'completed' end::request_status
     where id = v_req.id;
    if v_job.trip_id is not null then
      update trips set slots_taken = greatest(slots_taken - 1, 0),
                       status = case when status = 'full' then 'live' else status end
       where id = v_job.trip_id and status in ('live', 'full');
    end if;
  end if;

  if p_strike is not null then
    if p_strike not in (v_job.requester_id, v_job.traveler_id) then perform private.err('invalid_strike'); end if;
    update profiles set strikes = strikes + 1,
                        status = case when strikes + 1 >= 3 then 'suspended'::profile_status else status end
     where id = p_strike;
  end if;

  update disputes set status = 'resolved', resolution = p_resolution, to_requester = v_to_req + coalesce(p_clawback, 0),
                      to_traveler = v_to_trv - v_comm - coalesce(p_clawback, 0), strike_profile_id = p_strike,
                      admin_note = p_note, resolved_by = me.id, resolved_at = now()
   where id = p_dispute returning * into v_d;

  perform private.audit(me.id, 'resolve_dispute', p_dispute::text,
    jsonb_build_object('resolution', p_resolution, 'to_requester', v_to_req, 'to_traveler', v_to_trv,
                       'clawback', p_clawback, 'strike', p_strike));
  perform private.notify(v_job.requester_id, 'dispute_resolved', 'Issue resolved', p_note, '/jobs/' || v_job.id, true);
  perform private.notify(v_job.traveler_id,  'dispute_resolved', 'Issue resolved', p_note, '/jobs/' || v_job.id, true);
  return v_d;
end $$;
