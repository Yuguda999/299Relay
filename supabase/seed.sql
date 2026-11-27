-- 299 RELAY — local/staging seed. Never run against production.
-- Test logins (password for all: relay-test-123):
--   admin@relay.test   — admin
--   aisha@relay.test   — verified requester, ₦10,000 wallet
--   tunde@relay.test   — verified traveler,  ₦2,000 wallet
--   bello@relay.test   — pending (ID not yet reviewed)

insert into public.campuses (id, name, short_name, timezone, handoff_curfew)
values ('00000000-0000-4000-a000-000000000001', 'Ahmadu Bello University, Zaria', 'ABU', 'Africa/Lagos', '21:00')
on conflict (id) do nothing;

insert into public.places (campus_id, name, kind, zone, is_handoff_point) values
  ('00000000-0000-4000-a000-000000000001', 'Samaru Market',            'market',  'samaru',    false),
  ('00000000-0000-4000-a000-000000000001', 'Main Gate',                'gate',    'main',      true),
  ('00000000-0000-4000-a000-000000000001', 'Amina Hall Gate',          'hostel',  'north',     true),
  ('00000000-0000-4000-a000-000000000001', 'Ribadu Hall Porters'' Lodge','hostel', 'north',     true),
  ('00000000-0000-4000-a000-000000000001', 'Suleiman Hall Gate',       'hostel',  'south',     true),
  ('00000000-0000-4000-a000-000000000001', 'ICSA/Ramat Hall Gate',     'hostel',  'south',     true),
  ('00000000-0000-4000-a000-000000000001', 'Faculty of Engineering Entrance','faculty','central', true),
  ('00000000-0000-4000-a000-000000000001', 'Faculty of Science Entrance','faculty', 'central',  true),
  ('00000000-0000-4000-a000-000000000001', 'Senate Building',          'office',  'central',   true),
  ('00000000-0000-4000-a000-000000000001', 'Business Centre (Block C)','other',   'central',   false);

insert into public.prohibited_keywords (keyword) values
  ('alcohol'), ('beer'), ('gin'), ('vodka'), ('whisky'), ('cigarette'), ('cigarettes'), ('tobacco'),
  ('weed'), ('cannabis'), ('codeine'), ('tramadol'), ('gun'), ('knife'), ('weapon'), ('exam paper'), ('cash');

-- ─── Test users ─────────────────────────────────────────────────────────────
do $$
declare
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-b000-000000000001'::uuid, 'admin@relay.test', 'Relay Admin'),
    ('00000000-0000-4000-b000-000000000002'::uuid, 'aisha@relay.test', 'Aisha Bello'),
    ('00000000-0000-4000-b000-000000000003'::uuid, 'tunde@relay.test', 'Tunde Adeyemi'),
    ('00000000-0000-4000-b000-000000000004'::uuid, 'bello@relay.test', 'Bello Musa')
  ) as t(id, email, name) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt('relay-test-123', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', u.name, 'campus_id', '00000000-0000-4000-a000-000000000001'),
            now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email),
            'email', now(), now(), now());
  end loop;
end $$;

update public.profiles set role = 'admin', status = 'verified' where email = 'admin@relay.test';
update public.profiles set status = 'verified', hostel = 'Amina Hall'  where email = 'aisha@relay.test';
update public.profiles set status = 'verified', hostel = 'Ribadu Hall' where email = 'tunde@relay.test';
update public.profiles set hostel = 'Suleiman Hall' where email = 'bello@relay.test';

insert into public.verifications (profile_id, campus_id, matric_number, hostel, selfie_path, id_photo_path, status, decided_at)
select id, campus_id, m, hostel, id || '/selfie.jpg', id || '/id.jpg', s::public.verification_status,
       case when s = 'approved' then now() end
  from public.profiles
  join (values ('aisha@relay.test', 'U19CS1001', 'approved'),
               ('tunde@relay.test', 'U20EE2002', 'approved'),
               ('bello@relay.test', 'U21ME3003', 'submitted')) v(e, m, s) on v.e = email;

-- Wallet balances through the real top-up path, so the ledger stays balanced.
select public.svc_confirm_payment('seed_topup_aisha', '00000000-0000-4000-b000-000000000002', 1000000, 'seed', '{}');
select public.svc_confirm_payment('seed_topup_tunde', '00000000-0000-4000-b000-000000000003', 200000,  'seed', '{}');
