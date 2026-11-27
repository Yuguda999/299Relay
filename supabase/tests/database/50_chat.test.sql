-- Chat: new messages notify the other party unless they're in the chat.
begin;
select plan(6);

-- Set up a job: Aisha requests, Tunde accepts.
select tests.act_as('aisha@relay.test');
select tests.put('r', (public.create_request('pick_up', 'Parcel at the gate', tests.place('Main Gate'), tests.place('Amina Hall Gate'), tests.tomorrow_at(12))).id::text);
select tests.act_as('tunde@relay.test');
select tests.put('j', (public.accept_job(tests.get('r')::uuid)).id::text);

-- Aisha is not in the chat: Tunde's message notifies her.
insert into public.messages (job_id, sender_id, kind, body) values (tests.get('j')::uuid, tests.uid('tunde@relay.test'), 'text', 'At the gate now');
select tests.act_as(null);
select is((select count(*) from public.notifications where profile_id = tests.uid('aisha@relay.test') and kind = 'message' and link = '/jobs/' || tests.get('j') || '/chat'), 1::bigint,
  'message notifies a recipient who is away');
select is((select body from public.notifications where profile_id = tests.uid('aisha@relay.test') and kind = 'message' and link = '/jobs/' || tests.get('j') || '/chat'), 'At the gate now',
  'notification shows the message');

-- Aisha opens the chat: her unread message alert clears.
select tests.act_as('aisha@relay.test');
select lives_ok(format($$select public.chat_heartbeat(%L)$$, tests.get('j')), 'participant can heartbeat');
select tests.act_as(null);
select is((select count(*) from public.notifications where profile_id = tests.uid('aisha@relay.test') and kind = 'message' and link = '/jobs/' || tests.get('j') || '/chat' and read_at is null), 0::bigint,
  'opening the chat marks its alerts read');

-- While she's in the chat, new messages don't notify.
select tests.act_as('tunde@relay.test');
insert into public.messages (job_id, sender_id, kind, body) values (tests.get('j')::uuid, tests.uid('tunde@relay.test'), 'text', 'Coming up');
select tests.act_as(null);
select is((select count(*) from public.notifications where profile_id = tests.uid('aisha@relay.test') and kind = 'message' and link = '/jobs/' || tests.get('j') || '/chat'), 1::bigint,
  'no alert while the recipient is in the chat');

-- Outsiders can't fake presence.
select tests.act_as('bello@relay.test');
select throws_ok(format($$select public.chat_heartbeat(%L)$$, tests.get('j')), 'P0001', 'job_not_found', 'non-participants cannot heartbeat');

select * from finish();
rollback;
