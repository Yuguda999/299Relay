-- Admin dashboard RPCs.
begin;
select plan(8);

select tests.act_as('aisha@relay.test');
select throws_ok($$select public.admin_metrics()$$, 'P0001', 'forbidden', 'students cannot read metrics');
select throws_ok($$select public.admin_ledger_health()$$, 'P0001', 'forbidden', 'students cannot read ledger health');
select throws_ok($$insert into public.places (campus_id, name, kind, zone) values (public.my_campus(), 'X', 'other', 'z')$$,
  '42501', null, 'students cannot add places');

select tests.act_as('admin@relay.test');
select is((public.admin_metrics() ->> 'verified_users')::int, 3, 'metrics count verified users');
select is((public.admin_metrics() ->> 'pending_verifications')::int, 1, 'metrics count pending IDs');
select is(jsonb_array_length(public.admin_ledger_health() -> 'problems'), 0, 'ledger healthy');
select lives_ok($$insert into public.places (campus_id, name, kind, zone, is_handoff_point)
  values (public.my_campus(), 'Kongo Gate', 'gate', 'kongo', true)$$, 'admin adds a place');
select is((public.admin_update_campus('20:30', 400000, 1200000)).handoff_curfew, '20:30'::time, 'admin sets curfew');

select * from finish();
rollback;
