-- 299 RELAY — core schema
-- Money is stored in kobo (bigint). Every campus-scoped record carries campus_id.

create extension if not exists pgcrypto with schema extensions;

-- Helpers that must never be callable through the API live here.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.user_role           as enum ('student', 'admin');
create type public.profile_status      as enum ('pending', 'verified', 'suspended');
create type public.verification_status as enum ('submitted', 'approved', 'rejected');
create type public.place_kind          as enum ('market', 'gate', 'hostel', 'faculty', 'office', 'other');
create type public.request_type        as enum ('buy', 'pick_up', 'drop_off');
create type public.request_status      as enum ('review', 'posted', 'accepted', 'completed', 'cancelled', 'expired');
create type public.trip_status         as enum ('live', 'full', 'done', 'cancelled');
create type public.job_status          as enum ('accepted', 'purchased', 'in_transit', 'completed', 'disputed', 'refunded', 'cancelled');
create type public.message_kind        as enum ('text', 'photo', 'substitute', 'system');
create type public.substitute_decision as enum ('pending', 'approved', 'declined');
create type public.ledger_account_kind as enum ('user_available', 'job_escrow', 'platform_revenue', 'gateway_clearing', 'payouts_in_transit');
create type public.ledger_direction    as enum ('debit', 'credit');
create type public.payment_status      as enum ('pending', 'success', 'failed');
create type public.payout_status       as enum ('pending', 'success', 'failed', 'reversed');
create type public.dispute_status      as enum ('open', 'resolved');
create type public.dispute_resolution  as enum ('refund', 'release', 'split');

-- ─── updated_at trigger ─────────────────────────────────────────────────────
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── Campuses and places ────────────────────────────────────────────────────
create table public.campuses (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  short_name          text not null unique,
  timezone            text not null default 'Africa/Lagos',
  handoff_curfew      time not null default '21:00',
  item_cap_new        bigint not null default 500000,   -- ₦5,000
  item_cap_trusted    bigint not null default 1500000,  -- ₦15,000
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.places (
  id                  uuid primary key default gen_random_uuid(),
  campus_id           uuid not null references public.campuses(id),
  name                text not null,
  kind                public.place_kind not null,
  zone                text not null,
  is_handoff_point    boolean not null default false,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campus_id, name)
);
create index places_campus_idx on public.places (campus_id) where active;

create table public.prohibited_keywords (
  id                  uuid primary key default gen_random_uuid(),
  keyword             text not null unique check (keyword = lower(keyword))
);

-- ─── Profiles and verification ──────────────────────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  campus_id           uuid not null references public.campuses(id),
  full_name           text not null check (length(trim(full_name)) between 2 and 120),
  email               text not null,
  hostel              text,
  photo_path          text,
  role                public.user_role not null default 'student',
  status              public.profile_status not null default 'pending',
  rating_avg          numeric(3,2) not null default 0,
  rating_count        integer not null default 0,
  jobs_requested      integer not null default 0,
  jobs_carried        integer not null default 0,
  strikes             integer not null default 0,
  women_only          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_campus_idx on public.profiles (campus_id);

create table public.verifications (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  campus_id           uuid not null references public.campuses(id),
  matric_number       text not null,
  hostel              text,
  selfie_path         text not null,
  id_photo_path       text not null,
  status              public.verification_status not null default 'submitted',
  reject_reason       text,
  reviewer_id         uuid references public.profiles(id),
  decided_at          timestamptz,
  photos_deleted_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
-- One account per matric number per campus (ignoring rejected attempts).
create unique index verifications_matric_uniq
  on public.verifications (campus_id, upper(matric_number))
  where status <> 'rejected';
create index verifications_queue_idx on public.verifications (created_at) where status = 'submitted';

-- ─── Trips, requests, jobs ──────────────────────────────────────────────────
create table public.trips (
  id                  uuid primary key default gen_random_uuid(),
  campus_id           uuid not null references public.campuses(id),
  traveler_id         uuid not null references public.profiles(id),
  from_place_id       uuid not null references public.places(id),
  to_place_id         uuid not null references public.places(id),
  leaves_at           timestamptz not null,
  back_by             timestamptz not null,
  capacity            smallint not null check (capacity between 1 and 3),
  slots_taken         smallint not null default 0 check (slots_taken >= 0),
  job_types           public.request_type[] not null default array['buy','pick_up','drop_off']::public.request_type[],
  note                text check (length(note) <= 280),
  status              public.trip_status not null default 'live',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (back_by > leaves_at),
  check (slots_taken <= capacity),
  check (from_place_id <> to_place_id)
);
create index trips_feed_idx on public.trips (campus_id, leaves_at) where status = 'live';
create index trips_traveler_idx on public.trips (traveler_id, created_at desc);

create table public.requests (
  id                  uuid primary key default gen_random_uuid(),
  campus_id           uuid not null references public.campuses(id),
  requester_id        uuid not null references public.profiles(id),
  type                public.request_type not null,
  items_text          text not null check (length(trim(items_text)) between 2 and 1000),
  photo_path          text,
  from_place_id       uuid not null references public.places(id),
  handoff_place_id    uuid not null references public.places(id),
  deadline            timestamptz not null,
  item_budget         bigint not null default 0 check (item_budget >= 0),
  fee                 bigint not null check (fee > 0),
  urgent              boolean not null default false,
  target_trip_id      uuid references public.trips(id),   -- request sent straight to a trip
  flagged_keywords    text[],
  status              public.request_status not null default 'posted',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check ((type = 'buy') = (item_budget > 0))
);
create index requests_feed_idx on public.requests (campus_id, deadline) where status = 'posted';
create index requests_requester_idx on public.requests (requester_id, created_at desc);
create index requests_deadline_idx on public.requests (deadline) where status = 'posted';

create table public.jobs (
  id                  uuid primary key default gen_random_uuid(),
  campus_id           uuid not null references public.campuses(id),
  request_id          uuid not null references public.requests(id),
  requester_id        uuid not null references public.profiles(id),
  traveler_id         uuid not null references public.profiles(id),
  trip_id             uuid references public.trips(id),
  status              public.job_status not null default 'accepted',
  advance_amount      bigint not null default 0 check (advance_amount >= 0),
  code_attempts       smallint not null default 0,
  receipt_path        text,
  receipt_amount      bigint check (receipt_amount >= 0),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (requester_id <> traveler_id)
);
-- A released job is cancelled and its request can be accepted again.
create unique index jobs_request_live_uniq on public.jobs (request_id) where status <> 'cancelled';
create index jobs_requester_idx on public.jobs (requester_id, created_at desc);
create index jobs_traveler_idx on public.jobs (traveler_id, created_at desc);
create index jobs_active_idx on public.jobs (status) where status in ('accepted','purchased','in_transit','disputed');

-- Handoff codes: readable only by the requester (RLS). Kept apart from jobs so
-- the traveler, who can read the job row, never sees the code.
create table public.job_handoff_codes (
  job_id              uuid primary key references public.jobs(id) on delete cascade,
  requester_id        uuid not null references public.profiles(id),
  code                text not null check (code ~ '^[0-9]{4}$'),
  created_at          timestamptz not null default now()
);

create table public.job_events (
  id                  bigint generated always as identity primary key,
  job_id              uuid not null references public.jobs(id) on delete cascade,
  from_status         public.job_status,
  to_status           public.job_status not null,
  actor_id            uuid references public.profiles(id),
  note                text,
  created_at          timestamptz not null default now()
);
create index job_events_job_idx on public.job_events (job_id, id);

create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs(id) on delete cascade,
  sender_id           uuid references public.profiles(id),
  kind                public.message_kind not null default 'text',
  body                text check (length(body) <= 2000),
  photo_path          text,
  substitute_amount   bigint check (substitute_amount > 0),
  decision            public.substitute_decision,
  created_at          timestamptz not null default now(),
  check (kind <> 'substitute' or (substitute_amount is not null and decision is not null)),
  check (kind <> 'photo' or photo_path is not null),
  check (kind <> 'text' or body is not null)
);
create index messages_job_idx on public.messages (job_id, created_at);

-- ─── Money ──────────────────────────────────────────────────────────────────
create table public.wallets (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  available           bigint not null default 0 check (available >= 0),
  held                bigint not null default 0 check (held >= 0),
  updated_at          timestamptz not null default now()
);

create table public.ledger_accounts (
  id                  uuid primary key default gen_random_uuid(),
  kind                public.ledger_account_kind not null,
  profile_id          uuid references public.profiles(id),  -- user_available owner, or requester for escrow
  request_id          uuid references public.requests(id), -- job_escrow only
  balance             bigint not null default 0,           -- cache: credits − debits
  created_at          timestamptz not null default now(),
  check (balance >= 0 or kind = 'gateway_clearing'),
  check (case kind
           when 'user_available' then profile_id is not null and request_id is null
           when 'job_escrow'     then profile_id is not null and request_id is not null
           else                       profile_id is null and request_id is null
         end)
);
create unique index ledger_accounts_user_uniq   on public.ledger_accounts (profile_id) where kind = 'user_available';
create unique index ledger_accounts_escrow_uniq on public.ledger_accounts (request_id) where kind = 'job_escrow';
create unique index ledger_accounts_system_uniq on public.ledger_accounts (kind)
  where kind in ('platform_revenue', 'gateway_clearing', 'payouts_in_transit');

create table public.ledger_entries (
  id                  bigint generated always as identity primary key,
  txn_id              uuid not null,
  account_id          uuid not null references public.ledger_accounts(id),
  direction           public.ledger_direction not null,
  amount              bigint not null check (amount > 0),
  request_id          uuid references public.requests(id),
  job_id              uuid references public.jobs(id),
  reason              text not null,
  created_at          timestamptz not null default now()
);
create index ledger_entries_account_idx on public.ledger_entries (account_id, id);
create index ledger_entries_txn_idx on public.ledger_entries (txn_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id),
  method              text not null,
  amount              bigint not null check (amount > 0),
  paystack_reference  text not null unique,
  status              public.payment_status not null default 'pending',
  raw_webhook         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payments_profile_idx on public.payments (profile_id, created_at desc);

create table public.bank_accounts (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  bank_code           text not null,
  bank_name           text not null,
  account_last4       text not null check (account_last4 ~ '^[0-9]{4}$'),
  resolved_name       text not null,
  paystack_recipient  text not null unique,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);
create index bank_accounts_profile_idx on public.bank_accounts (profile_id) where active;

create table public.payouts (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id),
  bank_account_id     uuid not null references public.bank_accounts(id),
  amount              bigint not null check (amount > 0),
  paystack_reference  text not null unique,
  paystack_transfer   text,
  status              public.payout_status not null default 'pending',
  failure_reason      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payouts_profile_idx on public.payouts (profile_id, created_at desc);
create index payouts_pending_idx on public.payouts (created_at) where status = 'pending';

-- ─── Ratings, disputes, notifications, devices ─────────────────────────────
create table public.ratings (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs(id),
  rater_id            uuid not null references public.profiles(id),
  rated_id            uuid not null references public.profiles(id),
  stars               smallint not null check (stars between 1 and 5),
  tags                text[] not null default '{}',
  comment             text check (length(comment) <= 500),
  tip_amount          bigint not null default 0 check (tip_amount >= 0),
  created_at          timestamptz not null default now(),
  unique (job_id, rater_id)
);
create index ratings_rated_idx on public.ratings (rated_id, created_at desc);

create table public.disputes (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs(id),
  reporter_id         uuid references public.profiles(id),  -- null = opened by the system
  reason              text not null,
  details             text check (length(details) <= 2000),
  photo_paths         text[] not null default '{}',
  status              public.dispute_status not null default 'open',
  resolution          public.dispute_resolution,
  to_requester        bigint,
  to_traveler         bigint,
  strike_profile_id   uuid references public.profiles(id),
  admin_note          text,
  resolved_by         uuid references public.profiles(id),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index disputes_one_open_per_job on public.disputes (job_id) where status = 'open';

create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  kind                text not null,
  title               text not null,
  body                text,
  link                text,
  email               boolean not null default false,  -- also email this one
  read_at             timestamptz,
  pushed_at           timestamptz,
  created_at          timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

create table public.devices (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  platform            text not null check (platform in ('web', 'android', 'ios')),
  push_token          text not null unique,
  last_seen           timestamptz not null default now()
);

create table public.admin_audit (
  id                  bigint generated always as identity primary key,
  admin_id            uuid not null references public.profiles(id),
  action              text not null,
  target              text not null,
  detail              jsonb,
  created_at          timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['campuses','places','profiles','verifications','trips','requests','jobs','payments','payouts','disputes']
  loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;
