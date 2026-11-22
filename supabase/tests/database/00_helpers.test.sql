-- Shared test helpers. Runs first (alphabetical) and is NOT rolled back, so later files can use them.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Act as a seeded user (by email), or as postgres when p_email is null.
create or replace function tests.act_as(p_email text) returns void
language plpgsql as $$
declare v_id uuid;
begin
  reset role;
  if p_email is null then
    perform set_config('request.jwt.claims', '', true);
    return;
  end if;
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  set local role authenticated;
end $$;
grant execute on function tests.act_as(text) to anon, authenticated;

create or replace function tests.uid(p_email text) returns uuid
language sql security definer set search_path = '' as $$
  select id from auth.users where email = p_email;
$$;
grant execute on function tests.uid(text) to anon, authenticated;

-- Wallet as seen by postgres (bypasses RLS).
create or replace function tests.wallet(p_email text) returns public.wallets
language sql security definer set search_path = '' as $$
  select w.* from public.wallets w join auth.users u on u.id = w.profile_id where u.email = p_email;
$$;
grant execute on function tests.wallet(text) to anon, authenticated;

create or replace function tests.place(p_name text) returns uuid
language sql security definer set search_path = '' as $$
  select id from public.places where name = p_name;
$$;
grant execute on function tests.place(text) to anon, authenticated;

-- Tomorrow at the given Lagos hour: always inside the handoff window.
create or replace function tests.tomorrow_at(p_hour int) returns timestamptz
language sql stable as $$
  select (date_trunc('day', now() at time zone 'Africa/Lagos') + interval '1 day' + make_interval(hours => p_hour))
         at time zone 'Africa/Lagos';
$$;
grant execute on function tests.tomorrow_at(int) to anon, authenticated;

-- Pass values between role switches.
create or replace function tests.put(k text, v text) returns void
language sql as $$ select set_config('tests.' || k, v, true); $$;
create or replace function tests.get(k text) returns text
language sql stable as $$ select current_setting('tests.' || k, true); $$;
grant execute on function tests.put(text, text), tests.get(text) to anon, authenticated;

select plan(1);
select has_function('tests', 'act_as', array['text'], 'test helpers installed');
select * from finish();
