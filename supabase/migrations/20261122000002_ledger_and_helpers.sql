-- 299 RELAY — double-entry ledger, sign-up trigger and shared helpers.
--
-- Ledger model: each private.transfer() writes one debit and one credit of the
-- same amount under a txn_id, so every transaction balances by construction.
-- balance = credits − debits. ledger_accounts.balance and wallets.* are caches
-- updated in the same statement; private.reconcile_ledger() re-derives them.

-- ─── Errors ─────────────────────────────────────────────────────────────────
-- Clients switch on the message (a stable snake_case code); detail is for humans.
create or replace function private.err(code text, detail text default null) returns void
language plpgsql as $$
begin
  raise exception '%', code using errcode = 'P0001', detail = coalesce(detail, code);
end $$;

-- ─── Append-only ledger ─────────────────────────────────────────────────────
create or replace function private.ledger_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'ledger_entries are append-only; post a reversing entry instead';
end $$;

create trigger ledger_entries_no_update before update or delete on public.ledger_entries
  for each row execute function private.ledger_is_append_only();
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries
  for each statement execute function private.ledger_is_append_only();

-- ─── Accounts ───────────────────────────────────────────────────────────────
create or replace function private.user_account(p_profile uuid) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.ledger_accounts where kind = 'user_available' and profile_id = p_profile;
  if v_id is null then
    insert into public.ledger_accounts (kind, profile_id) values ('user_available', p_profile)
    on conflict do nothing returning id into v_id;
    if v_id is null then
      select id into v_id from public.ledger_accounts where kind = 'user_available' and profile_id = p_profile;
    end if;
  end if;
  return v_id;
end $$;

create or replace function private.escrow_account(p_request uuid) returns uuid
language plpgsql as $$
declare v_id uuid; v_owner uuid;
begin
  select id into v_id from public.ledger_accounts where kind = 'job_escrow' and request_id = p_request;
  if v_id is null then
    select requester_id into v_owner from public.requests where id = p_request;
    insert into public.ledger_accounts (kind, profile_id, request_id) values ('job_escrow', v_owner, p_request)
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function private.system_account(p_kind public.ledger_account_kind) returns uuid
language sql stable as $$
  select id from public.ledger_accounts where kind = p_kind and profile_id is null and request_id is null;
$$;

insert into public.ledger_accounts (kind) values ('platform_revenue'), ('gateway_clearing'), ('payouts_in_transit');

-- ─── Transfer: the only writer of ledger_entries ────────────────────────────
create or replace function private.transfer(
  p_txn      uuid,
  p_from     uuid,
  p_to       uuid,
  p_amount   bigint,
  p_reason   text,
  p_request  uuid default null,
  p_job      uuid default null
) returns void
language plpgsql as $$
declare
  v_from public.ledger_accounts;
  v_to   public.ledger_accounts;
begin
  if p_amount is null or p_amount = 0 then
    return;
  end if;
  if p_amount < 0 then
    perform private.err('invalid_amount', 'transfer amount must be positive');
  end if;
  if p_from = p_to then
    perform private.err('invalid_transfer', 'cannot transfer to the same account');
  end if;

  -- Lock in a stable order (by id) to avoid deadlocks between concurrent transfers.
  perform 1 from public.ledger_accounts where id in (p_from, p_to) order by id for update;

  select * into v_from from public.ledger_accounts where id = p_from;
  if not found then
    perform private.err('account_not_found');
  end if;
  if v_from.kind <> 'gateway_clearing' and v_from.balance < p_amount then
    perform private.err('insufficient_funds',
      format('needs %s, has %s', private.naira(p_amount), private.naira(v_from.balance)));
  end if;

  insert into public.ledger_entries (txn_id, account_id, direction, amount, request_id, job_id, reason)
  values (p_txn, p_from, 'debit',  p_amount, p_request, p_job, p_reason),
         (p_txn, p_to,   'credit', p_amount, p_request, p_job, p_reason);

  update public.ledger_accounts set balance = balance - p_amount where id = p_from returning * into v_from;
  update public.ledger_accounts set balance = balance + p_amount where id = p_to returning * into v_to;

  -- Wallet caches
  if v_from.kind = 'user_available' then
    update public.wallets set available = available - p_amount, updated_at = now() where profile_id = v_from.profile_id;
  elsif v_from.kind = 'job_escrow' then
    update public.wallets set held = held - p_amount, updated_at = now() where profile_id = v_from.profile_id;
  end if;
  if v_to.kind = 'user_available' then
    update public.wallets set available = available + p_amount, updated_at = now() where profile_id = v_to.profile_id;
  elsif v_to.kind = 'job_escrow' then
    update public.wallets set held = held + p_amount, updated_at = now() where profile_id = v_to.profile_id;
  end if;
end $$;

-- Integrity check: caches match the ledger, and the whole ledger sums to zero.
-- Returns one row per problem; no rows = healthy.
create or replace function private.reconcile_ledger()
returns table (problem text, account_id uuid, expected bigint, actual bigint)
language sql stable as $$
  with sums as (
    select a.id, a.kind, a.profile_id, a.balance,
           coalesce(sum(case e.direction when 'credit' then e.amount else -e.amount end), 0)::bigint as derived
    from public.ledger_accounts a
    left join public.ledger_entries e on e.account_id = a.id
    group by a.id
  )
  select 'account_cache_mismatch', id, derived, balance from sums where derived <> balance
  union all
  select 'ledger_not_zero_sum', null, 0, sum(derived)::bigint from sums having sum(derived) <> 0
  union all
  select 'wallet_available_mismatch', s.id, s.balance, w.available
    from sums s join public.wallets w on w.profile_id = s.profile_id
    where s.kind = 'user_available' and s.balance <> w.available
  union all
  select 'wallet_held_mismatch', null, coalesce(h.held, 0), w.held
    from public.wallets w
    left join (select profile_id, sum(balance)::bigint held from sums where kind = 'job_escrow' group by profile_id) h
      on h.profile_id = w.profile_id
    where coalesce(h.held, 0) <> w.held;
$$;

-- ─── Sign-up: profile, wallet and ledger account per auth user ──────────────
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_campus uuid;
  v_name   text;
begin
  v_campus := nullif(new.raw_user_meta_data ->> 'campus_id', '')::uuid;
  if v_campus is null then
    -- Single-campus pilot: default to the only active campus.
    select id into v_campus from public.campuses where active order by created_at limit 1;
  end if;
  if v_campus is null then
    raise exception 'no_campus' using detail = 'sign-up requires a campus_id in user metadata';
  end if;

  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, campus_id, full_name, email)
  values (new.id, v_campus, v_name, new.email);
  insert into public.wallets (profile_id) values (new.id);
  perform private.user_account(new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in step with auth.
create or replace function private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ─── Caller helpers ─────────────────────────────────────────────────────────
create or replace function private.me() returns public.profiles
language plpgsql as $$
declare v public.profiles;
begin
  if auth.uid() is null then
    perform private.err('not_authenticated');
  end if;
  select * into v from public.profiles where id = auth.uid();
  if not found then
    perform private.err('no_profile');
  end if;
  if v.status = 'suspended' then
    perform private.err('account_suspended');
  end if;
  return v;
end $$;

create or replace function private.me_verified() returns public.profiles
language plpgsql as $$
declare v public.profiles := private.me();
begin
  if v.status <> 'verified' then
    perform private.err('not_verified', 'your student ID must be approved first');
  end if;
  return v;
end $$;

create or replace function private.me_admin() returns public.profiles
language plpgsql as $$
declare v public.profiles := private.me();
begin
  if v.role <> 'admin' then
    perform private.err('forbidden', 'admin only');
  end if;
  return v;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_campus() returns uuid
language sql stable security definer set search_path = '' as $$
  select campus_id from public.profiles where id = auth.uid();
$$;

create or replace function private.audit(p_admin uuid, p_action text, p_target text, p_detail jsonb default null)
returns void language sql as $$
  insert into public.admin_audit (admin_id, action, target, detail) values (p_admin, p_action, p_target, p_detail);
$$;

-- ─── Notifications ──────────────────────────────────────────────────────────
-- Writes the inbox row; a database webhook on notifications sends push/email.
create or replace function private.notify(
  p_profile uuid, p_kind text, p_title text, p_body text default null,
  p_link text default null, p_email boolean default false
) returns void
language sql as $$
  insert into public.notifications (profile_id, kind, title, body, link, email)
  values (p_profile, p_kind, p_title, p_body, p_link, p_email);
$$;

create or replace function private.naira(p_kobo bigint) returns text
language sql immutable as $$
  select '₦' || to_char(p_kobo / 100.0, 'FM999,999,990.##');
$$;

-- ─── Pricing and trust ──────────────────────────────────────────────────────
-- PRD: pick up / drop off ₦150 same zone, ₦300 cross-campus;
-- buy ₦200 + 5% of item value; urgent +₦100. Rounded up to whole naira.
create or replace function private.quote_fee(
  p_type public.request_type, p_from uuid, p_handoff uuid, p_item_budget bigint, p_urgent boolean
) returns bigint
language plpgsql stable as $$
declare
  v_from_zone text; v_to_zone text; v_fee bigint;
begin
  select zone into v_from_zone from public.places where id = p_from;
  select zone into v_to_zone   from public.places where id = p_handoff;
  if p_type = 'buy' then
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
end $$;

-- 15% of the delivery fee, rounded down to whole naira.
create or replace function private.commission(p_fee bigint) returns bigint
language sql immutable as $$
  select (floor(p_fee * 0.15 / 100.0) * 100)::bigint;
$$;

-- PRD: ₦5,000 for new users; ₦15,000 after 10 completed jobs with rating ≥ 4.5.
create or replace function private.item_cap(p public.profiles) returns bigint
language sql stable as $$
  select case
    when (p.jobs_requested + p.jobs_carried) >= 10 and p.rating_avg >= 4.5 then c.item_cap_trusted
    else c.item_cap_new
  end
  from public.campuses c where c.id = p.campus_id;
$$;

-- ─── Job state machine ──────────────────────────────────────────────────────
create or replace function private.set_job_status(
  p_job uuid, p_to public.job_status, p_actor uuid, p_note text default null
) returns public.jobs
language plpgsql as $$
declare
  v public.jobs;
  v_ok boolean;
begin
  select * into v from public.jobs where id = p_job for update;
  if not found then
    perform private.err('job_not_found');
  end if;

  v_ok := case v.status
    when 'accepted'   then p_to in ('purchased', 'in_transit', 'completed', 'disputed', 'cancelled')
    when 'purchased'  then p_to in ('in_transit', 'completed', 'disputed')
    when 'in_transit' then p_to in ('completed', 'disputed')
    when 'disputed'   then p_to in ('completed', 'refunded')
    else false
  end;
  if not v_ok then
    perform private.err('invalid_status_change', format('%s → %s is not allowed', v.status, p_to));
  end if;

  insert into public.job_events (job_id, from_status, to_status, actor_id, note)
  values (p_job, v.status, p_to, p_actor, p_note);

  update public.jobs
     set status = p_to,
         completed_at = case when p_to in ('completed', 'refunded', 'cancelled') then now() else completed_at end
   where id = p_job
  returning * into v;
  return v;
end $$;

create or replace function private.system_message(p_job uuid, p_body text) returns void
language sql as $$
  insert into public.messages (job_id, sender_id, kind, body) values (p_job, null, 'system', p_body);
$$;
