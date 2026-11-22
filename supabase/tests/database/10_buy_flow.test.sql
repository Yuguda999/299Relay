-- The PRD/architecture worked example: Aisha's Buy job, end to end.
-- Budget ₦3,400, fee ₦370 (₦200 + 5%), receipt ₦3,250, commission ₦55.
begin;
select plan(28);

-- ── Quote ──
select tests.act_as('aisha@relay.test');
select is(
  (public.quote_request('buy', tests.place('Samaru Market'), tests.place('Amina Hall Gate'), 340000, false) ->> 'suggested_fee')::bigint,
  37000::bigint, 'buy fee = ₦200 + 5% of ₦3,400 = ₦370');
select is(
  (public.quote_request('pick_up', tests.place('Amina Hall Gate'), tests.place('Ribadu Hall Porters'' Lodge'), 0, false) ->> 'suggested_fee')::bigint,
  15000::bigint, 'same-zone pick up = ₦150');
select is(
  (public.quote_request('drop_off', tests.place('Amina Hall Gate'), tests.place('Main Gate'), 0, true) ->> 'suggested_fee')::bigint,
  40000::bigint, 'cross-zone urgent drop off = ₦300 + ₦100');

-- ── Post ──
select tests.put('req', (public.create_request(
  'buy', 'Two A4 exercise books and a blue Bic pen', tests.place('Samaru Market'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(17), 340000)).id::text);
select is((tests.wallet('aisha@relay.test')).available, 623000::bigint, 'Aisha: ₦10,000 − ₦3,770 available');
select is((tests.wallet('aisha@relay.test')).held,      377000::bigint, 'Aisha: ₦3,770 held');

-- ── Pending student cannot post or accept ──
select tests.act_as('bello@relay.test');
select throws_ok(
  $$select public.create_request('pick_up', 'Parcel', tests.place('Main Gate'), tests.place('Amina Hall Gate'), tests.tomorrow_at(12))$$,
  'P0001', 'not_verified', 'pending student cannot post');
select throws_ok(format($$select public.accept_job(%L)$$, tests.get('req')), 'P0001', 'not_verified', 'pending student cannot accept');
select is((select count(*) from public.requests where id = tests.get('req')::uuid), 1::bigint, 'pending student can browse the feed');

-- ── Requester cannot accept own ──
select tests.act_as('aisha@relay.test');
select throws_ok(format($$select public.accept_job(%L)$$, tests.get('req')), 'P0001', null, 'requester cannot accept own request');

-- ── Accept: purchase advance ──
select tests.act_as('tunde@relay.test');
select tests.put('job', (public.accept_job(tests.get('req')::uuid)).id::text);
select is((tests.wallet('tunde@relay.test')).available, 540000::bigint, 'Tunde: ₦2,000 + ₦3,400 advance');
select is((tests.wallet('aisha@relay.test')).held, 37000::bigint, 'Aisha: only the fee still held');
select is((select count(*) from public.job_handoff_codes), 0::bigint, 'traveler cannot read the handoff code');

-- ── Second acceptance loses ──
select tests.act_as('admin@relay.test');
select throws_ok(format($$select public.accept_job(%L)$$, tests.get('req')), 'P0001', 'already_taken', 'first acceptance wins');

-- ── Requester sees the code ──
select tests.act_as('aisha@relay.test');
select tests.put('code', (select code from public.job_handoff_codes where job_id = tests.get('job')::uuid));
select matches(tests.get('code'), '^[0-9]{4}$', 'requester sees a 4-digit code');

-- ── Handoff before purchase is refused ──
select tests.act_as('tunde@relay.test');
select throws_ok(format($$select public.submit_handoff_code(%L, %L)$$, tests.get('job'), tests.get('code')),
  'P0001', 'purchase_first', 'buy job needs a receipt before handoff');

-- ── Over-budget receipt is refused ──
select throws_ok(format($$select public.confirm_purchase(%L, 'x/receipt.jpg', 350000)$$, tests.get('job')),
  'P0001', 'over_budget', 'receipt above budget needs approval first');

-- ── Purchase: unused budget returns ──
select is((public.confirm_purchase(tests.get('job')::uuid, tests.uid('tunde@relay.test') || '/' || tests.get('job') || '/r.jpg', 325000)).status,
  'purchased'::public.job_status, 'job is purchased');
select is((tests.wallet('tunde@relay.test')).available,  525000::bigint, 'Tunde returns ₦150 unused');
select is((tests.wallet('aisha@relay.test')).available,  638000::bigint, 'Aisha gets ₦150 back');

select is((public.start_delivery(tests.get('job')::uuid)).status, 'in_transit'::public.job_status, 'in transit');

-- ── Wrong code ──
select is((public.submit_handoff_code(tests.get('job')::uuid, case when tests.get('code') = '0000' then '1111' else '0000' end) ->> 'attempts_left')::int,
  4, 'wrong code leaves 4 attempts');

-- ── Right code: fee released ──
select is((public.submit_handoff_code(tests.get('job')::uuid, tests.get('code')) ->> 'ok')::boolean, true, 'correct code completes');
select is((tests.wallet('tunde@relay.test')).available, 556500::bigint, 'Tunde gets ₦370 − ₦55 = ₦315');
select is((tests.wallet('aisha@relay.test')).held, 0::bigint, 'nothing left held');

select tests.act_as(null);
select is((select balance from public.ledger_accounts where kind = 'platform_revenue'), 5500::bigint, 'platform earns ₦55');
select is((select status from public.jobs where id = tests.get('job')::uuid), 'completed'::public.job_status, 'job completed');

-- ── Rating with tip ──
select tests.act_as('aisha@relay.test');
select lives_ok(format($$select public.rate_job(%L, 5::smallint, array['fast'], 'Thanks!', 10000)$$, tests.get('job')), 'requester rates and tips');

select tests.act_as(null);
select is_empty($$select * from private.reconcile_ledger()$$, 'ledger balances and caches match');

select * from finish();
rollback;
