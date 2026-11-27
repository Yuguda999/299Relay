-- Phones are untrusted: clients must not touch money, status or others' data.
begin;
select plan(16);

select tests.act_as('aisha@relay.test');
select throws_ok($$select public.svc_confirm_payment('fake', auth.uid(), 99999999, 'x', '{}')$$,
  '42501', null, 'students cannot credit their own wallet');
select throws_ok($$update public.wallets set available = 99999999$$, '42501', null, 'wallets are read-only');
select throws_ok($$insert into public.ledger_entries (txn_id, account_id, direction, amount, reason)
  select gen_random_uuid(), id, 'credit', 1, 'x' from public.ledger_accounts limit 1$$, '42501', null, 'ledger is not writable');
select throws_ok($$update public.profiles set status = 'verified', role = 'admin' where id = auth.uid()$$,
  '42501', null, 'cannot promote self');
select lives_ok($$update public.profiles set hostel = 'Amina Hall Block B' where id = auth.uid()$$, 'can edit own hostel');
select throws_ok($$update public.requests set fee = 1$$, '42501', null, 'requests are written only through RPCs');
select throws_ok($$select private.transfer(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, 'x')$$,
  '42501', null, 'private schema is unreachable');

select is((select count(*) from public.wallets), 1::bigint, 'sees only own wallet');
select is((select count(*) from public.profiles), 1::bigint, 'sees only own full profile');
select is((select count(*) from public.public_profiles), tests.campus_profile_count(), 'sees every campus public card');
select is((select count(*) from public.verifications where profile_id <> auth.uid()), 0::bigint, 'cannot see others'' ID checks');

select throws_ok($$insert into public.messages (job_id, sender_id, kind, body)
  values (gen_random_uuid(), auth.uid(), 'text', 'hi')$$, '42501', null, 'cannot post into a job you are not in');
select throws_ok($$insert into public.messages (job_id, sender_id, kind, substitute_amount, decision)
  select gen_random_uuid(), auth.uid(), 'substitute', 1, 'approved'$$, '42501', null, 'cannot forge substitute approvals');

select throws_ok($$select public.review_verification(gen_random_uuid(), true)$$, 'P0001', 'forbidden', 'students cannot verify IDs');

-- Anonymous visitors
select tests.act_as(null);
set local role anon;
select is((select count(*) from public.campuses), 1::bigint, 'anon can list campuses for sign-up');
select throws_ok($$select public.quote_request('buy', null, null, 1, false)$$, '42501', null, 'anon cannot call RPCs');

select * from finish();
rollback;
