-- Print jobs: documents required, private until accepted, paid like a buy job.
begin;
select plan(11);
select tests.snap();

-- A document Aisha uploaded to her own folder in the documents bucket.
insert into storage.objects (bucket_id, name, owner_id) values
  ('documents', tests.uid('aisha@relay.test') || '/draft/notes.pdf', tests.uid('aisha@relay.test')::text),
  ('documents', tests.uid('tunde@relay.test') || '/draft/other.pdf', tests.uid('tunde@relay.test')::text);

select tests.act_as('aisha@relay.test');
select throws_ok($$select public.create_request('print', 'Print my notes', tests.place('Business Centre (Block C)'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(15), 100000)$$, 'P0001', 'files_required', 'print needs documents');
select throws_ok(format($$select public.create_request('print', 'Print', tests.place('Business Centre (Block C)'), tests.place('Amina Hall Gate'),
  tests.tomorrow_at(15), 100000, null, false, null, null, %L::jsonb)$$,
  json_build_array(json_build_object('path', tests.uid('tunde@relay.test') || '/draft/other.pdf', 'name', 'x.pdf'))),
  'P0001', 'invalid_upload_path', 'cannot attach someone else''s file');

select tests.put('r', (public.create_request('print', 'Print my notes: 12 pages, B/W, double-sided', tests.place('Business Centre (Block C)'),
  tests.place('Amina Hall Gate'), tests.tomorrow_at(15), 100000, null, false, null, null,
  json_build_array(json_build_object('path', tests.uid('aisha@relay.test') || '/draft/notes.pdf', 'name', 'notes.pdf', 'pages', 12))::jsonb,
  '{"copies":1,"color":"bw","sides":"double"}'::jsonb)).id::text);
select is((tests.wallet('aisha@relay.test')).held - tests.base('aisha_held'), 125000::bigint, 'holds print budget + fee (₦1,000 + ₦250)');

-- Before acceptance: Tunde sees the file listing, not the document.
select tests.act_as('tunde@relay.test');
select is((select count(*) from public.request_files where request_id = tests.get('r')::uuid), 1::bigint, 'traveler sees file list in the feed');
select is((select count(*) from storage.objects where bucket_id = 'documents' and name like tests.uid('aisha@relay.test') || '/%'), 0::bigint,
  'traveler cannot open documents before accepting');

-- Accept: advance paid, document readable.
select tests.put('j', (public.accept_job(tests.get('r')::uuid)).id::text);
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 100000::bigint, 'print budget advanced to traveler');
select is((select count(*) from storage.objects where bucket_id = 'documents' and name = tests.uid('aisha@relay.test') || '/draft/notes.pdf'), 1::bigint,
  'traveler can open the document after accepting');
select throws_ok(format($$select public.submit_handoff_code(%L, '0000')$$, tests.get('j')), 'P0001', 'purchase_first', 'print needs the amount spent before handoff');
select is((public.confirm_purchase(tests.get('j')::uuid, null, 80000)).status, 'purchased'::public.job_status, 'no receipt photo needed, just the amount');
select is((tests.wallet('tunde@relay.test')).available - tests.base('tunde_available'), 80000::bigint, 'unused ₦200 returned to requester');

-- Others still can't read it.
select tests.act_as('bello@relay.test');
select is((select count(*) from storage.objects where bucket_id = 'documents' and name = tests.uid('aisha@relay.test') || '/draft/notes.pdf'), 0::bigint,
  'other students cannot open the document');

select * from finish();
rollback;
