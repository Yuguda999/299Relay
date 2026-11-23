-- Cancellations, releases, code lockout, disputes, trips, substitutes, payouts.
begin;
select plan(35);
select tests.snap();

-- ════ Cancel before acceptance: full refund ════
select tests.act_as('aisha@relay.test');
select tests.put('r1', (public.create_request('pick_up', 'Parcel at the main gate, name on it: Aisha',
  tests.place('Main Gate'), tests.place('Amina Hall Gate'), tests.tomorrow_at(12))).id::text);
select is((tests.wallet('aisha@relay.test')).held - tests.base('aisha_held'), 30000::bigint, 'cross-zone pick up holds ₦300');
select is((public.cancel_request(tests.get('r1')::uuid)).status, 'cancelled'::public.request_status, 'requester cancels');
select is((tests.wallet('aisha@relay.test')).available - tests.base('aisha_available'), 0::bigint, 'full refund');

-- ════ Fee can be raised, never lowered ════
select throws_ok($$select public.create_request('pick_up', 'Parcel', tests.place('Main Gate'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(12), 0, 10000)$$, 'P0001', 'fee_below_suggested', 'fee below suggestion refused');

-- ════ Rules at posting ════
select throws_ok($$select public.create_request('pick_up', 'Parcel', tests.place('Main Gate'), tests.place('Samaru Market'),
  tests.tomorrow_at(12))$$, 'P0001', 'not_a_handoff_point', 'handoff must be a listed public point');
select throws_ok($$select public.create_request('pick_up', 'Parcel', tests.place('Main Gate'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(22))$$, 'P0001', 'after_curfew', 'no handoffs after curfew');
select throws_ok($$select public.create_request('buy', 'Phone', tests.place('Samaru Market'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(12), 600000)$$, 'P0001', 'over_item_cap', 'new users capped at ₦5,000');
select is((public.create_request('buy', 'A pack of cigarettes', tests.place('Samaru Market'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(12), 100000)).status, 'review'::public.request_status, 'prohibited keyword holds request for review');

-- ════ Accept then requester cancels before purchase: advance reversed ════
select tests.put('r2', (public.create_request('buy', 'Bread and Peak milk', tests.place('Samaru Market'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(16), 100000)).id::text);
select tests.act_as('tunde@relay.test');
select tests.put('j2', (public.accept_job(tests.get('r2')::uuid)).id::text);
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 100000::bigint, 'advance paid to traveler');

-- One unfinished advance at a time
select tests.act_as('aisha@relay.test');
select tests.put('r3', (public.create_request('buy', 'Indomie carton', tests.place('Samaru Market'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(16), 200000)).id::text);
select tests.act_as('tunde@relay.test');
select throws_ok(format($$select public.accept_job(%L)$$, tests.get('r3')), 'P0001', 'unfinished_advance', 'one open advance per traveler');

select tests.act_as('aisha@relay.test');
select is((public.cancel_request(tests.get('r2')::uuid)).status, 'cancelled'::public.request_status, 'cancel after acceptance, before purchase');
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 0::bigint, 'advance clawed back from traveler');
select tests.act_as(null);
select is((select status from public.jobs where id = tests.get('j2')::uuid), 'cancelled'::public.job_status, 'job cancelled');

-- ════ Traveler releases: request back to the feed, can be re-accepted ════
select tests.act_as('tunde@relay.test');
select tests.put('j3', (public.accept_job(tests.get('r3')::uuid)).id::text);
select is((public.release_job(tests.get('j3')::uuid)).status, 'posted'::public.request_status, 'released request is posted again');
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 0::bigint, 'advance returned on release');
select isnt((public.accept_job(tests.get('r3')::uuid)).id::text, tests.get('j3'), 're-accepted as a new job');
select tests.put('j3', (select id::text from public.jobs where request_id = tests.get('r3')::uuid and status = 'accepted'));

-- ════ Substitute: price goes up, requester approves ════
select tests.put('m1', (public.propose_substitute(tests.get('j3')::uuid, 'Carton is ₦2,500 now', 250000)).id::text);
select tests.act_as('aisha@relay.test');
select is((public.respond_substitute(tests.get('m1')::uuid, true)).decision, 'approved'::public.substitute_decision, 'requester approves');
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 250000::bigint, 'traveler advance topped up to ₦2,500');

-- ════ Code lockout after 5 wrong tries → dispute → admin refund ════
select tests.act_as('tunde@relay.test');
select lives_ok(format($$select public.confirm_purchase(%L, null, 250000)$$, tests.get('j3')), 'purchased at new price');
select tests.act_as('aisha@relay.test');
select tests.put('c3', (select code from public.job_handoff_codes where job_id = tests.get('j3')::uuid));
select tests.put('bad', case when tests.get('c3') = '9999' then '0000' else '9999' end);
select tests.act_as('tunde@relay.test');
select public.submit_handoff_code(tests.get('j3')::uuid, tests.get('bad')) from generate_series(1, 4);
select is((public.submit_handoff_code(tests.get('j3')::uuid, tests.get('bad')) ->> 'locked')::boolean, true, '5th wrong code locks the job');
select throws_ok(format($$select public.submit_handoff_code(%L, %L)$$, tests.get('j3'), tests.get('c3')),
  'P0001', 'invalid_status_change', 'locked job refuses even the right code');

select tests.act_as(null);
select tests.put('d3', (select id::text from public.disputes where job_id = tests.get('j3')::uuid));
select is((select reason from public.disputes where id = tests.get('d3')::uuid), 'code_lockout', 'system opened a dispute');

select tests.act_as('aisha@relay.test');
select throws_ok(format($$select public.resolve_dispute(%L, 'refund')$$, tests.get('d3')), 'P0001', 'forbidden', 'only admins resolve');

select tests.act_as('admin@relay.test');
-- Escrow holds the fee only (₦300); refund it and claw back the ₦2,500 spent.
select lives_ok(format($$select public.resolve_dispute(%L, 'refund', null, 250000, %L, 'No-show at handoff')$$,
  tests.get('d3'), tests.uid('tunde@relay.test')), 'admin refunds with clawback and strike');
select is((tests.wallet('aisha@relay.test')).held - tests.base('aisha_held'), 125000::bigint, 'only the request in review is still held');
select tests.act_as(null);
select is((select strikes from public.profiles where email = 'tunde@relay.test'), 1, 'strike recorded');
select is((select status from public.jobs where id = tests.get('j3')::uuid), 'refunded'::public.job_status, 'job refunded');

-- ════ Trips ════
select tests.act_as('tunde@relay.test');
select tests.put('t1', (public.create_trip(tests.place('Ribadu Hall Porters'' Lodge'), tests.place('Samaru Market'),
  tests.tomorrow_at(15), tests.tomorrow_at(17), 1::smallint)).id::text);
select tests.act_as('aisha@relay.test');
select tests.put('r4', (public.create_request('pick_up', 'Printout from Samaru', tests.place('Samaru Market'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(18), 0, null, false, null, tests.get('t1')::uuid)).id::text);
select tests.act_as('admin@relay.test');
select is((select count(*) from public.requests where id = tests.get('r4')::uuid and status = 'posted' and target_trip_id is not null),
  1::bigint, 'admin sees request sent to a trip');
select tests.act_as('bello@relay.test');
select is((select count(*) from public.requests where id = tests.get('r4')::uuid), 0::bigint, 'others do not see a request sent to a trip');
select tests.act_as('tunde@relay.test');
select is((public.accept_job(tests.get('r4')::uuid)).trip_id::text, tests.get('t1'), 'job attached to the trip');
select tests.act_as(null);
select is((select status from public.trips where id = tests.get('t1')::uuid), 'full'::public.trip_status, 'trip full at capacity 1');

-- ════ Payouts ════
select tests.act_as(null);
select lives_ok($$select public.svc_save_bank_account(tests.uid('tunde@relay.test'), '058', 'GTBank', '1234', 'ADEYEMI TUNDE', 'RCP_test1')$$,
  'bank account name matches');
select tests.act_as('tunde@relay.test');
select tests.put('po', (public.request_withdrawal(100000)) ->> 'reference');
select tests.act_as(null);
select lives_ok(format($$select public.svc_settle_payout(%L, false, null, 'bank down')$$, tests.get('po')), 'failed payout settles');
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 0::bigint, 'failed payout returns money');

select is_empty($$select * from private.reconcile_ledger()$$, 'ledger still balanced');

select * from finish();
rollback;
