-- Students adding places that aren't in the list.
begin;
select plan(12);

select tests.act_as('bello@relay.test');
select throws_ok($$select public.add_place('Mama Put Junction')$$, 'P0001', 'not_verified', 'unverified students cannot add places');

select tests.act_as('aisha@relay.test');
select tests.put('p', (public.add_place('  Mama   Put Junction ', true)).id::text);
select results_eq(format($$select name, kind::text, is_handoff_point, zone, added_by from public.places where id = %L$$, tests.get('p')),
  format($$values ('Mama Put Junction', 'area', false, 'custom_mama_put_junction', %L::uuid)$$, tests.uid('aisha@relay.test')),
  'name tidied, off-campus area, not a handoff point, own zone, added_by set');
select is((public.add_place('mama put junction')).id::text, tests.get('p'), 'same name in another case reuses the place');
select is((public.add_place('Samaru Market')).name, 'Samaru Market', 'existing team place is returned, not duplicated');
select is((public.add_place('Corner Shop Area 2')).kind::text, 'other', 'on-campus place is kind other');
select throws_ok($$select public.add_place('ab')$$, 'P0001', 'invalid_place_name', 'too short');
select throws_ok($$select public.add_place('1234')$$, 'P0001', 'invalid_place_name', 'needs letters');
select throws_ok($$select public.add_place('Beer Parlour')$$, 'P0001', 'place_name_not_allowed', 'prohibited words blocked');
select is((select count(*) from public.admin_audit where action = 'insert_place' and target = tests.get('p')), 0::bigint,
  'student-added place not logged as an admin action');

-- Usable right away by other students in requests and trips.
select tests.act_as('tunde@relay.test');
select is((select count(*) from public.places where id = tests.get('p')::uuid), 1::bigint, 'other students see the new place');

-- Daily limit: Aisha added 2 above, 3 more allowed.
select tests.act_as('aisha@relay.test');
select public.add_place('Extra Place ' || n) from generate_series(1, 3) n;
select throws_ok($$select public.add_place('One Too Many')$$, 'P0001', 'too_many_places', 'at most 5 new places a day');

-- Retired by the team: can't be re-added.
select tests.act_as('admin@relay.test');
update public.places set active = false where id = tests.get('p')::uuid;
select tests.act_as('tunde@relay.test');
select throws_ok($$select public.add_place('Mama Put Junction')$$, 'P0001', 'place_retired', 'retired place cannot be re-added');

select * from finish();
rollback;
