-- 299 RELAY — verification, admin actions, wallet top-ups/payouts, timeouts.

-- ─── Student ID verification ────────────────────────────────────────────────
create or replace function public.submit_verification(
  p_matric text, p_hostel text, p_selfie_path text, p_id_photo_path text
) returns public.verifications
language plpgsql security definer set search_path = public, extensions as $$
declare
  me  public.profiles := private.me();
  v   public.verifications;
begin
  if me.status = 'verified' then perform private.err('already_verified'); end if;
  if exists (select 1 from verifications where profile_id = me.id and status = 'submitted') then
    perform private.err('verification_pending', 'your ID is already in review');
  end if;
  p_matric := upper(trim(p_matric));
  if p_matric !~ '^[A-Z0-9/\-]{4,30}$' then perform private.err('invalid_matric'); end if;
  -- Uploads must be in the caller's own folder of the private bucket.
  if split_part(p_selfie_path, '/', 1) <> me.id::text or split_part(p_id_photo_path, '/', 1) <> me.id::text then
    perform private.err('invalid_upload_path');
  end if;

  insert into verifications (profile_id, campus_id, matric_number, hostel, selfie_path, id_photo_path)
  values (me.id, me.campus_id, p_matric, nullif(trim(p_hostel), ''), p_selfie_path, p_id_photo_path)
  returning * into v;
  update profiles set hostel = coalesce(nullif(trim(p_hostel), ''), hostel) where id = me.id;
  return v;
exception when unique_violation then
  perform private.err('matric_in_use', 'this matric number is already linked to an account');
end $$;

create or replace function public.review_verification(p_verification uuid, p_approve boolean, p_reason text default null)
returns public.verifications
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.profiles := private.me_admin();
  v  public.verifications;
begin
  select * into v from verifications where id = p_verification for update;
  if not found then perform private.err('verification_not_found'); end if;
  if v.status <> 'submitted' then perform private.err('already_decided'); end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then perform private.err('reason_required'); end if;

  update verifications set status = case when p_approve then 'approved' else 'rejected' end::verification_status,
                           reject_reason = case when p_approve then null else p_reason end,
                           reviewer_id = me.id, decided_at = now()
   where id = p_verification returning * into v;
  if p_approve then
    update profiles set status = 'verified' where id = v.profile_id and status = 'pending';
    perform private.notify(v.profile_id, 'verified', 'You''re verified',
      'You can now post requests, post trips and carry jobs.', '/', true);
  else
    perform private.notify(v.profile_id, 'verification_rejected', 'ID not approved', p_reason, '/verify', true);
  end if;
  perform private.audit(me.id, case when p_approve then 'approve_verification' else 'reject_verification' end,
                        v.profile_id::text, jsonb_build_object('verification', v.id, 'reason', p_reason));
  return v;
end $$;

-- Suspend / reinstate.
create or replace function public.admin_set_profile_status(p_profile uuid, p_status public.profile_status, p_note text)
returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.profiles := private.me_admin();
  v  public.profiles;
begin
  if p_profile = me.id then perform private.err('cannot_change_self'); end if;
  update profiles set status = p_status where id = p_profile returning * into v;
  if not found then perform private.err('profile_not_found'); end if;
  perform private.audit(me.id, 'set_profile_status', p_profile::text, jsonb_build_object('status', p_status, 'note', p_note));
  return v;
end $$;

-- Approve or reject a request held for prohibited keywords.
create or replace function public.admin_review_request(p_request uuid, p_approve boolean, p_note text default null)
returns public.requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  me    public.profiles := private.me_admin();
  v_req public.requests;
begin
  select * into v_req from requests where id = p_request for update;
  if not found or v_req.status <> 'review' then perform private.err('request_not_found'); end if;
  if p_approve then
    update requests set status = 'posted' where id = p_request returning * into v_req;
    perform private.notify_matching_travelers(v_req);
    perform private.notify(v_req.requester_id, 'request_live', 'Your request is live', null, '/requests/' || p_request);
  else
    perform private.refund_escrow(p_request, null, 'request_rejected');
    update requests set status = 'cancelled' where id = p_request returning * into v_req;
    perform private.notify(v_req.requester_id, 'request_rejected', 'Request not allowed', p_note, '/requests/' || p_request, true);
  end if;
  perform private.audit(me.id, 'review_request', p_request::text, jsonb_build_object('approve', p_approve, 'note', p_note));
  return v_req;
end $$;

-- ─── Wallet: top-ups (called by Edge Functions with the service role) ───────
create or replace function public.svc_create_payment(p_profile uuid, p_amount bigint, p_method text, p_reference text)
returns public.payments
language plpgsql security definer set search_path = public, extensions as $$
declare v public.payments;
begin
  if p_amount < 10000 or p_amount > 10000000 then
    perform private.err('invalid_amount', 'top-ups are between ₦100 and ₦100,000');
  end if;
  insert into payments (profile_id, method, amount, paystack_reference)
  values (p_profile, p_method, p_amount, p_reference) returning * into v;
  return v;
end $$;

-- Idempotent: replays of the same reference do nothing and return the row.
create or replace function public.svc_confirm_payment(
  p_reference text, p_profile uuid, p_amount bigint, p_method text, p_raw jsonb
) returns public.payments
language plpgsql security definer set search_path = public, extensions as $$
declare v public.payments;
begin
  insert into payments (profile_id, method, amount, paystack_reference, status, raw_webhook)
  values (p_profile, p_method, p_amount, p_reference, 'pending', p_raw)
  on conflict (paystack_reference) do nothing;

  select * into v from payments where paystack_reference = p_reference for update;
  if v.status = 'success' then
    return v;  -- replay
  end if;
  if v.profile_id <> p_profile then
    perform private.err('payment_owner_mismatch');
  end if;

  -- Trust the webhook's amount (what actually arrived), not the initial intent.
  update payments set status = 'success', amount = p_amount, raw_webhook = p_raw, method = p_method
   where id = v.id returning * into v;
  perform private.transfer(gen_random_uuid(), private.system_account('gateway_clearing'), private.user_account(p_profile),
                           p_amount, 'topup');
  perform private.notify(p_profile, 'topup', 'Wallet topped up', format('%s added.', private.naira(p_amount)), '/wallet', true);
  return v;
end $$;

create or replace function public.svc_fail_payment(p_reference text, p_raw jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  update payments set status = 'failed', raw_webhook = p_raw where paystack_reference = p_reference and status = 'pending';
$$;

-- ─── Wallet: bank accounts and payouts ──────────────────────────────────────
create or replace function public.svc_save_bank_account(
  p_profile uuid, p_bank_code text, p_bank_name text, p_last4 text, p_resolved_name text, p_recipient text
) returns public.bank_accounts
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_profile public.profiles;
  v public.bank_accounts;
begin
  select * into v_profile from profiles where id = p_profile;
  if v_profile.status <> 'verified' then perform private.err('not_verified'); end if;
  if not private.names_match(v_profile.full_name, p_resolved_name) then
    perform private.err('name_mismatch', 'the account name must match your verified name');
  end if;
  update bank_accounts set active = false where profile_id = p_profile;
  insert into bank_accounts (profile_id, bank_code, bank_name, account_last4, resolved_name, paystack_recipient)
  values (p_profile, p_bank_code, p_bank_name, p_last4, p_resolved_name, p_recipient)
  on conflict (paystack_recipient) do update set active = true, profile_id = excluded.profile_id
    where bank_accounts.profile_id = excluded.profile_id
  returning * into v;
  if v.id is null then perform private.err('bank_account_in_use'); end if;
  return v;
end $$;

-- At least two name tokens in common (bank names are often "SURNAME FIRST MIDDLE").
create or replace function private.names_match(a text, b text) returns boolean
language sql immutable as $$
  select count(*) >= least(2, (select count(*) from regexp_split_to_table(lower(trim(a)), '[^a-z]+') t where t <> ''))
    from (select distinct t from regexp_split_to_table(lower(trim(a)), '[^a-z]+') t where t <> '') x
   where x.t in (select t from regexp_split_to_table(lower(trim(b)), '[^a-z]+') t where t <> '');
$$;

-- Student starts a withdrawal: money moves to payouts_in_transit now; the
-- withdraw Edge Function then asks Paystack to send it.
create or replace function public.request_withdrawal(p_amount bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  me   public.profiles := private.me_verified();
  v_ba public.bank_accounts;
  v_p  public.payouts;
begin
  if p_amount is null or p_amount < 100000 then perform private.err('below_minimum', 'minimum withdrawal is ₦1,000'); end if;
  select * into v_ba from bank_accounts where profile_id = me.id and active order by created_at desc limit 1;
  if not found then perform private.err('no_bank_account', 'add a bank account first'); end if;
  if exists (select 1 from payouts where profile_id = me.id and status = 'pending') then
    perform private.err('payout_pending', 'wait for your last withdrawal to finish');
  end if;

  insert into payouts (profile_id, bank_account_id, amount, paystack_reference)
  values (me.id, v_ba.id, p_amount, 'po_' || replace(gen_random_uuid()::text, '-', ''))
  returning * into v_p;
  perform private.transfer(gen_random_uuid(), private.user_account(me.id), private.system_account('payouts_in_transit'),
                           p_amount, 'payout');
  return jsonb_build_object('payout_id', v_p.id, 'reference', v_p.paystack_reference, 'amount', v_p.amount,
                            'recipient', v_ba.paystack_recipient);
end $$;

-- Paystack transfer result (webhook or synchronous failure). Idempotent.
create or replace function public.svc_settle_payout(
  p_reference text, p_success boolean, p_transfer_code text default null, p_reason text default null
) returns public.payouts
language plpgsql security definer set search_path = public, extensions as $$
declare v public.payouts;
begin
  select * into v from payouts where paystack_reference = p_reference for update;
  if not found then perform private.err('payout_not_found'); end if;
  if v.status <> 'pending' then return v; end if;

  if p_success then
    perform private.transfer(gen_random_uuid(), private.system_account('payouts_in_transit'),
                             private.system_account('gateway_clearing'), v.amount, 'payout_sent');
    update payouts set status = 'success', paystack_transfer = coalesce(p_transfer_code, paystack_transfer)
     where id = v.id returning * into v;
    perform private.notify(v.profile_id, 'payout', 'Withdrawal sent', format('%s is on its way to your bank.', private.naira(v.amount)), '/wallet', true);
  else
    perform private.transfer(gen_random_uuid(), private.system_account('payouts_in_transit'),
                             private.user_account(v.profile_id), v.amount, 'payout_reversed');
    update payouts set status = 'failed', failure_reason = p_reason, paystack_transfer = coalesce(p_transfer_code, paystack_transfer)
     where id = v.id returning * into v;
    perform private.notify(v.profile_id, 'payout_failed', 'Withdrawal failed', 'The money is back in your wallet.', '/wallet', true);
  end if;
  return v;
end $$;

-- ─── Timeouts (pg_cron, every 5 minutes) ────────────────────────────────────
create or replace function private.run_timeouts() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.requests;
  n_expired integer := 0;
  n_trips integer;
  n_flagged integer := 0;
  j record;
begin
  -- Requests past their deadline with no traveler: cancel and refund.
  for r in select * from requests where status in ('posted', 'review') and deadline < now() for update skip locked loop
    perform private.refund_escrow(r.id, null, 'request_expired');
    update requests set status = 'expired' where id = r.id;
    perform private.notify(r.requester_id, 'request_expired', 'No one picked up your request',
      'Your money is back in your wallet.', '/requests/' || r.id);
    n_expired := n_expired + 1;
  end loop;

  -- Trips past their return time close.
  update trips set status = 'done' where status in ('live', 'full') and back_by < now();
  get diagnostics n_trips = row_count;

  -- Jobs more than 2 hours past the deadline: flag to admins once.
  for j in
    select jb.id, jb.campus_id from jobs jb join requests rq on rq.id = jb.request_id
     where jb.status in ('accepted', 'purchased', 'in_transit') and rq.deadline < now() - interval '2 hours'
       and not exists (select 1 from job_events e where e.job_id = jb.id and e.note = 'overdue_flagged')
  loop
    insert into job_events (job_id, from_status, to_status, actor_id, note)
    select id, status, status, null, 'overdue_flagged' from jobs where id = j.id;
    insert into notifications (profile_id, kind, title, body, link, email)
    select p.id, 'admin_overdue', 'Overdue job', 'A job is more than 2 hours past its deadline.', '/admin/jobs/' || j.id, true
      from profiles p where p.role = 'admin' and p.campus_id = j.campus_id;
    n_flagged := n_flagged + 1;
  end loop;

  return jsonb_build_object('expired', n_expired, 'trips_closed', n_trips, 'overdue_flagged', n_flagged);
end $$;

-- Daily: ledger self-check; any problem alerts admins.
create or replace function private.run_daily_ledger_check() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  select count(*) into n from private.reconcile_ledger();
  if n > 0 then
    insert into notifications (profile_id, kind, title, body, email)
    select id, 'admin_ledger', 'Ledger check failed', format('%s problem(s) found. Run private.reconcile_ledger().', n), true
      from profiles where role = 'admin';
  end if;
  return n;
end $$;
