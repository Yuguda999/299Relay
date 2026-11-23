-- 299 RELAY — admin dashboard support: pilot metrics, ledger health, payouts view.

-- PRD pilot metrics over a window (default 7 days).
create or replace function public.admin_metrics(p_days integer default 7) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  me     public.profiles := private.me_admin();
  since  timestamptz := now() - make_interval(days => greatest(p_days, 1));
  v      jsonb;
begin
  with
  posted as (select * from requests where campus_id = me.campus_id and created_at >= since and status <> 'review'),
  matched as (
    select r.id from posted r
    join jobs j on j.request_id = r.id
    where j.created_at <= r.created_at + interval '30 minutes'
  ),
  jobs_w as (select * from jobs where campus_id = me.campus_id and created_at >= since),
  repeaters as (
    select requester_id from requests
     where campus_id = me.campus_id and created_at >= now() - interval '30 days' and status = 'completed'
     group by requester_id having count(*) >= 2
  ),
  requesters as (
    select distinct requester_id from requests
     where campus_id = me.campus_id and created_at >= now() - interval '30 days' and status = 'completed'
  )
  select jsonb_build_object(
    'days', p_days,
    'verified_users', (select count(*) from profiles where campus_id = me.campus_id and status = 'verified'),
    'pending_verifications', (select count(*) from verifications where campus_id = me.campus_id and status = 'submitted'),
    'active_travelers', (select count(distinct traveler_id) from trips where campus_id = me.campus_id and created_at >= now() - interval '7 days'),
    'requests_posted', (select count(*) from posted),
    'match_rate', case when (select count(*) from posted) = 0 then null
                       else round((select count(*) from matched)::numeric / (select count(*) from posted), 3) end,
    'jobs_accepted', (select count(*) from jobs_w),
    'completion_rate', case when (select count(*) from jobs_w where status <> 'cancelled') = 0 then null
                       else round((select count(*) from jobs_w where status = 'completed')::numeric
                                  / (select count(*) from jobs_w where status <> 'cancelled'), 3) end,
    'dispute_rate', case when (select count(*) from jobs_w where status <> 'cancelled') = 0 then null
                    else round((select count(distinct d.job_id) from disputes d join jobs_w j on j.id = d.job_id)::numeric
                               / (select count(*) from jobs_w where status <> 'cancelled'), 3) end,
    'completed_jobs', (select count(*) from jobs_w where status = 'completed'),
    'repeat_requester_rate', case when (select count(*) from requesters) = 0 then null
                             else round((select count(*) from repeaters)::numeric / (select count(*) from requesters), 3) end,
    'open_disputes', (select count(*) from disputes d join jobs j on j.id = d.job_id where j.campus_id = me.campus_id and d.status = 'open'),
    'requests_in_review', (select count(*) from requests where campus_id = me.campus_id and status = 'review'),
    'overdue_jobs', (select count(*) from jobs j join requests r on r.id = j.request_id
                      where j.campus_id = me.campus_id and j.status in ('accepted','purchased','in_transit')
                        and r.deadline < now() - interval '2 hours'),
    'gmv_fees', (select coalesce(sum(r.fee), 0) from jobs_w j join requests r on r.id = j.request_id where j.status = 'completed'),
    'platform_revenue_total', (select balance from ledger_accounts where kind = 'platform_revenue' and profile_id is null)
  ) into v;
  return v;
end $$;

-- Ledger self-check plus system account balances and stuck payouts.
create or replace function public.admin_ledger_health() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare me public.profiles := private.me_admin();
begin
  return jsonb_build_object(
    'problems', coalesce((select jsonb_agg(to_jsonb(p)) from private.reconcile_ledger() p), '[]'::jsonb),
    'accounts', (select jsonb_object_agg(kind, balance) from ledger_accounts where profile_id is null),
    'wallets_available', (select coalesce(sum(available), 0) from wallets),
    'wallets_held', (select coalesce(sum(held), 0) from wallets),
    'stuck_payouts', (select count(*) from payouts where status = 'pending' and created_at < now() - interval '1 hour'),
    'checked_at', now()
  );
end $$;

-- Admin campus settings (curfew, caps). Places are edited directly under RLS.
create or replace function public.admin_update_campus(
  p_curfew time, p_item_cap_new bigint, p_item_cap_trusted bigint
) returns public.campuses
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.profiles := private.me_admin();
  v  public.campuses;
begin
  if p_item_cap_new <= 0 or p_item_cap_trusted < p_item_cap_new then
    perform private.err('invalid_amount', 'trusted cap must be at least the new-user cap');
  end if;
  update campuses set handoff_curfew = p_curfew, item_cap_new = p_item_cap_new, item_cap_trusted = p_item_cap_trusted
   where id = me.campus_id returning * into v;
  perform private.audit(me.id, 'update_campus', me.campus_id::text,
    jsonb_build_object('curfew', p_curfew, 'cap_new', p_item_cap_new, 'cap_trusted', p_item_cap_trusted));
  return v;
end $$;

-- Places changed by admins are audited too.
create or replace function private.audit_places() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.admin_audit (admin_id, action, target, detail)
    values (auth.uid(), lower(tg_op) || '_place', new.id::text, to_jsonb(new));
  end if;
  return new;
end $$;
create trigger places_audit after insert or update on public.places
  for each row execute function private.audit_places();

grant execute on function public.admin_metrics(integer), public.admin_ledger_health(),
  public.admin_update_campus(time, bigint, bigint) to authenticated;
