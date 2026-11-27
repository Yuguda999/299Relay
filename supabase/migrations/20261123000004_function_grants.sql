-- 299 RELAY — close function EXECUTE grants that leaked to PUBLIC.
--
-- Functions added after 20261122000005 (admin_metrics, admin_ledger_health,
-- admin_update_campus, chat_heartbeat, ...) were executable by PUBLIC, so anon
-- could call them. Each checks the caller internally and refused, but grants
-- are the first line of defence. The earlier ALTER DEFAULT PRIVILEGES did not
-- name the creating role, so it did not apply to later migrations.

revoke execute on all functions in schema public from public, anon;

-- RLS helpers are evaluated for anon (campus list at sign-up); they return false/null without a session.
grant execute on function public.is_admin(), public.my_campus() to anon;

-- Future functions created by postgres start with no client access; grant explicitly.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
