-- 299 RELAY — hourly maintenance: ID photo deletion and stuck payouts.
-- pg_cron calls the `maintenance` Edge Function (it needs the Storage and
-- Paystack APIs), using the same Vault secrets as notification dispatch.

create or replace function private.call_edge_function(p_name text, p_body jsonb default '{}') returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return null;  -- not configured in this environment
  end if;
  return net.http_post(
    url     := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := p_body
  );
end $$;

-- ID photos whose 30-day retention has passed (decided, not yet deleted).
create or replace function public.svc_photos_due_for_deletion(p_limit integer default 200)
returns table (id uuid, selfie_path text, id_photo_path text)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.selfie_path, v.id_photo_path
    from verifications v
   where v.status in ('approved', 'rejected')
     and v.decided_at < now() - interval '30 days'
     and v.photos_deleted_at is null
   order by v.decided_at
   limit p_limit;
$$;

create or replace function public.svc_mark_photos_deleted(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  update verifications set photos_deleted_at = now() where id = any (p_ids) and photos_deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Payouts pending for more than an hour.
create or replace function public.svc_stuck_payouts(p_limit integer default 50)
returns setof public.payouts
language sql stable security definer set search_path = public, extensions as $$
  select * from payouts where status = 'pending' and created_at < now() - interval '1 hour'
   order by created_at limit p_limit;
$$;

-- Alert admins once per stuck payout.
create or replace function public.svc_flag_stuck_payout(p_payout uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_link text := '/money#' || p_payout;
begin
  if exists (select 1 from notifications where kind = 'admin_payout_stuck' and link = v_link) then
    return false;
  end if;
  insert into notifications (profile_id, kind, title, body, link, email)
  select id, 'admin_payout_stuck', 'Payout stuck', 'A withdrawal has been pending for over an hour and Paystack has not settled it.', v_link, true
    from profiles where role = 'admin';
  return true;
end $$;

revoke execute on function public.svc_photos_due_for_deletion(integer), public.svc_mark_photos_deleted(uuid[]),
  public.svc_stuck_payouts(integer), public.svc_flag_stuck_payout(uuid) from public, anon, authenticated;
grant execute on function public.svc_photos_due_for_deletion(integer), public.svc_mark_photos_deleted(uuid[]),
  public.svc_stuck_payouts(integer), public.svc_flag_stuck_payout(uuid) to service_role;

select cron.schedule('relay-maintenance', '17 * * * *', $$select private.call_edge_function('maintenance')$$);
