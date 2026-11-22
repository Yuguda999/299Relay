# 299 RELAY — Technical Architecture

Nov 22, 2026 · @Muhammed

## Overview and principles

This document describes how 299 RELAY is built: the apps, the backend, the data, the money flows and how it all runs. It turns the [PRD](https://claude.ai/artifact/R4tafVA3BpoXicy3U3DQ58) into a design a small team can build during the school break and run through the ABU Zaria pilot. Screens referred to here are in the [screens canvas](https://claude.ai/artifact/1mPnLzTviBxCaoVvwEURW3).

**Scope.** The student mobile app, the admin dashboard, the backend, and the payment, email and push integrations needed for the MVP (all P0 requirements in the PRD).

**Design principles**

- **Managed services over servers.** A two- or three-person team should spend its time on trust and liquidity, not infrastructure.
- **Money is never edited, only recorded.** Every naira moves as a double-entry ledger record; balances are calculated from the ledger.
- **Phones are untrusted.** Prices, fees, codes and status changes are decided on the server. The app only asks.
- **Light on data.** Students on prepaid mobile data must be able to use the app comfortably on a weak 3G signal.
- **One campus first, many later.** Every record carries a campus so a second campus is configuration, not a rewrite.

## Tech stack

Recommended choices for the MVP. Each can be swapped, but these keep the team small and the monthly bill low during the pilot.

| Layer | Choice | Why |
| --- | --- | --- |
| Student app | Flutter (Android first, iOS from the same code) | One codebase, small installs, good performance on low-end Android phones |
| Admin dashboard | Next.js web app, hosted on Vercel | Fast to build; same login and database as the app |
| Backend platform | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions | Managed database with row-level security, email auth and realtime built in |
| Business logic | Supabase Edge Functions (TypeScript) plus Postgres functions | Money and status changes run server-side in database transactions |
| Payments | Paystack: virtual bank accounts for top-ups, card and USSD, Transfers API for payouts | Nigerian-first gateway with bank transfer support and webhooks |
| Email | A transactional email provider (for example Resend or Amazon SES) behind Supabase Auth | Confirmation codes, password resets and receipts |
| Push notifications | Firebase Cloud Messaging | Free, reliable on Android and iOS |
| File storage | Supabase Storage: private buckets for ID photos and receipts | Signed, short-lived links; never public |
| Monitoring | Sentry for app and function errors; Supabase logs; an uptime checker | Catch crashes and outages before students report them |
| Product analytics | PostHog | Funnels for sign-up, matching and completion |

## System components

Two apps talk to one managed backend. The Edge Functions are the only place that changes money or job status; the apps read data directly but can only write through those functions or through tightly scoped database rules.

&#91;embedded content: system components · MVP\]

| Component | Responsibility |
| --- | --- |
| Student app | Sign-up and login, feed, posting requests and trips, chat, handoff codes, wallet. Caches the feed and places list for weak connections. |
| Admin dashboard | Student verification queue, dispute resolution, places and handoff points, user bans, job and ledger lookups. |
| Auth | Email and password accounts, 6-digit email confirmation, password-reset links, sessions with refresh tokens. |
| Edge Functions | Price quotes, posting, accepting (first wins), purchase advances, handoff code checks, Paystack webhooks, payouts, notifications. |
| Postgres | All records, the money ledger, and row-level security rules that decide who can read what. |
| Realtime | Pushes feed changes, chat messages and job status to open apps without polling. |
| Storage | Private buckets for ID photos and receipts, served only through short-lived signed links. |
| Paystack | Bank-transfer, card and USSD top-ups; transfers to student bank accounts; webhooks confirming each payment. |
| Email provider | Confirmation codes, password resets, receipts and admin alerts. |
| Firebase Messaging | Push notifications for new matches, acceptance, status changes and wallet events. |

## Data model

Postgres tables for the MVP. Every table has an id (UUID), created and updated times, and a campus id where it applies. Money is stored in kobo as whole numbers, never as decimals.

| Table | Holds | Key fields |
| --- | --- | --- |
| campuses | Each campus the app runs on | name, timezone, handoff curfew time, item cap defaults |
| profiles | One per user, linked to the auth account | full name, email, campus, hostel, photo, role (student, admin), status (pending, verified, suspended), rating average, job counts, strikes |
| verifications | Student ID checks | profile, matric number (unique per campus), selfie and ID photo paths, status, reviewer, decided at |
| places | Campus places and handoff points | name, kind (market, gate, hostel, faculty, office), zone, is handoff point, active |
| trips | A traveler's planned movement | traveler, from place, to place, leaves at, back by, capacity, job types, status (live, full, done, cancelled) |
| requests | A need posted by a requester | requester, type (buy, pick up, drop off), items text, photo, from place, handoff place, deadline, item budget, fee, urgent, status |
| jobs | A request a traveler accepted | request, traveler, trip (optional), status (accepted, purchased, in transit, handed off, completed, disputed, refunded, cancelled), handoff code hash, code attempts, receipt photo, receipt amount |
| job\_events | Every status change, for the timeline and audits | job, from status, to status, actor, note |
| messages | Job chat | job, sender, kind (text, photo, substitute, system), body, substitute amount, decision |
| wallets | One per user | profile, available balance and held balance (cached from the ledger) |
| ledger\_entries | Double-entry money records, never edited | transaction id, account, direction (debit, credit), amount in kobo, job, reason |
| payments | Top-ups through Paystack | profile, method, amount, Paystack reference (unique), status, raw webhook |
| payouts | Withdrawals to bank | profile, bank account, amount, Paystack transfer reference, status |
| bank\_accounts | Verified payout accounts | profile, bank code, account last four digits, resolved account name, Paystack recipient code |
| ratings | Two-way ratings | job, rater, rated, stars, tags, comment, tip amount |
| disputes | Reported issues | job, reporter, reason, details, photos, status, resolution (refund, release, split), resolved by |
| notifications | In-app inbox | profile, kind, title, link, read at |
| devices | Push tokens | profile, platform, FCM token, last seen |

The job lifecycle these statuses follow is drawn in the PRD under Core concepts and the delivery loop.

## Sign-up, login and verification

Students sign up and log in with email and password. Being logged in is not the same as being trusted: posting and carrying unlock only after an admin approves the student ID.

**Sign-up**

1. The student enters name, email, password (at least 8 characters) and campus. Auth creates the account in an unconfirmed state, and a database trigger creates a profile with status pending.
2. Auth emails a 6-digit code, valid for 10 minutes, resendable after 60 seconds. Entering it confirms the email.
3. The student submits matric number, hostel, a selfie and a student ID photo. Photos upload straight to a private storage bucket; a verifications row is created with status submitted.
4. An admin compares selfie, ID and matric number in the dashboard and approves or rejects with a reason. Approval sets the profile to verified and sends a push and an email. ID photos are deleted 30 days after a decision.

**Login and sessions.** Email and password return a short-lived access token and a refresh token stored in the phone's secure storage. Five failed attempts in 15 minutes lock login for that email for 15 minutes.

**Password reset.** A reset request always shows the same success message (so emails can't be probed). The link works once and expires after 30 minutes; using it signs out every other session.

**Access rules.** Pending students can browse the feed. Only verified students can post requests, post trips, accept jobs, top up or withdraw, enforced in the Edge Functions and in database rules, not just hidden in the app.

## Matching and the job lifecycle

Matching is simple on purpose: places are a fixed list, so a match is a lookup, not a maps problem.

**Who sees a request.** A request matches a live trip when the trip's destination is the request's pickup place (or in the same zone), the trip leaves before the request's deadline, and the trip has a free slot. Matching travelers get a push; everyone else sees the request in the Open requests feed.

**Who sees a trip.** Requesters see live trips in the feed, sorted by departure time, and can send a request straight to a trip. The traveler then accepts or declines it.

**First acceptance wins.** Accepting runs one database transaction that changes the request from posted to accepted only if it is still posted, creates the job, takes a trip slot and writes the ledger entries. If two travelers tap at once, one gets the job and the other sees "Someone else took this one".

**Status changes.** Each step (bought, in transit, handed off, completed, disputed, cancelled) goes through an Edge Function that checks the caller's role and the allowed next statuses, then writes a job\_events row. The app never sets a status directly.

**Handoff code.** On acceptance the server creates a random 4-digit code, stores only its hash, and shows the code only to the requester. The traveler submits it; after 5 wrong tries the job is locked and a dispute opens. A correct code completes the job and releases the fee in the same transaction.

**Timeouts.** A scheduled job runs every 5 minutes: requests past their deadline with no traveler are cancelled and refunded; accepted jobs past the deadline by more than 2 hours are flagged to admins; trips past their return time are closed.

## Wallet, escrow ledger and payments

Every money movement is one transaction of balanced ledger entries: total debits equal total credits, or nothing is written. Wallet balances are a cache of the ledger, updated in the same transaction.

**Ledger accounts**

- **User available**: money a student can spend or withdraw.
- **Job escrow**: money held for one job until it completes or is refunded.
- **Platform revenue**: the 15% commission on delivery fees.
- **Gateway clearing**: money confirmed by Paystack but not yet settled to our bank.
- **Payouts in transit**: withdrawals sent to Paystack but not yet confirmed.

**Worked example: Aisha's Buy job** (item budget ₦3,400, fee ₦370, receipt ₦3,250)

| Event | Debit | Credit | Amount |
| --- | --- | --- | --- |
| Aisha tops up by bank transfer (Paystack webhook) | Gateway clearing | Aisha available | ₦5,000 |
| Aisha posts the request | Aisha available | Job escrow | ₦3,770 |
| Tunde accepts; purchase advance | Job escrow | Tunde available | ₦3,400 |
| Receipt confirmed at ₦3,250; unused budget back | Tunde available | Aisha available | ₦150 |
| Handoff code entered; fee to Tunde | Job escrow | Tunde available | ₦315 |
| Handoff code entered; commission | Job escrow | Platform revenue | ₦55 |
| Tunde withdraws to his bank | Tunde available | Payouts in transit | ₦4,000 |
| Paystack confirms the transfer | Payouts in transit | Gateway clearing | ₦4,000 |

**The purchase advance.** This design follows the PRD's advance model: the budget moves to the traveler on acceptance so they never pay from their own pocket, and they can pay the vendor by bank transfer. It is also the riskiest step, so advances only go to verified travelers, within item caps (₦5,000 for new users), and a traveler with an unfinished advance cannot accept another Buy job. If the pilot shows too much risk, switch to reimbursement at handoff: skip the advance row and pay receipt amount plus fee when the code is entered. The PRD lists this as an open question.

**Refunds and disputes.** Cancelling before purchase reverses the advance and returns the escrow to the requester. A dispute freezes the job escrow; the admin's decision posts refund, release or split entries.

**Paystack integration**

- **Top-ups:** each student gets a dedicated virtual bank account for transfers; card and USSD use Paystack checkout. Credit only on a verified webhook, never on the app's word.
- **Webhooks:** the signature is checked, the Paystack reference is unique in the payments table, and replays do nothing.
- **Payouts:** bank accounts are resolved through Paystack before saving, and the resolved name must match the verified name. Transfers run from an Edge Function; failures reverse the ledger entries.
- **Reconciliation:** a daily job compares ledger totals with Paystack's records and alerts admins to any difference.

Whether holding student balances needs a licence or a partner's escrow product is still an open question in the PRD; settle it before real money flows.

## API, realtime and notifications

The app reads lists (feed, my jobs, messages, notifications) straight from the database through row-level security, and calls Edge Functions for anything that changes money, status or trust.

| Function | Who calls it | What it does |
| --- | --- | --- |
| quote-request | Requester | Returns the suggested fee and the total to hold for a draft request |
| create-request | Verified requester | Checks caps and balance, holds the money, posts the request, notifies matching travelers |
| create-trip / cancel-trip | Verified traveler | Posts or closes a trip; cancelling releases its unstarted jobs back to the feed |
| accept-job | Verified traveler | First-wins acceptance, purchase advance for Buy jobs, creates the handoff code |
| confirm-purchase | Traveler | Saves the receipt photo and amount, returns unused budget |
| respond-substitute | Requester | Approves or declines a substitute or price change sent in chat |
| submit-handoff-code | Traveler | Checks the code, completes the job, releases the fee |
| cancel-request | Requester | Cancels before purchase and refunds |
| open-dispute / resolve-dispute | Either party / admin | Freezes escrow; admin posts refund, release or split |
| rate-job | Either party | Saves stars, tags, optional tip (moved through the ledger) |
| topup-init / paystack-webhook | Student / Paystack | Starts a top-up; confirms payments and transfers |
| add-bank-account / withdraw | Verified student | Resolves and saves an account; sends a payout |
| review-verification | Admin | Approves or rejects a student ID |

**Realtime.** Open apps subscribe to three channels: the campus feed (new and taken requests and trips), each active job's status, and each job's chat. When the app is closed, push notifications take over.

**Notifications.** One notify step writes the in-app inbox row, sends the push through Firebase Messaging, and emails only for account and money events (approval, top-up received, payout sent, dispute decided). Students choose which pushes they get in Settings.

## Security, privacy and abuse prevention

**Access control.** Row-level security on every table: students read their own profile, wallet and jobs in full; other students see only a public profile (first name, last initial, photo, rating, counts). Admin actions need the admin role and are logged with who did what.

**Secrets.** Paystack keys, the email provider key and the Firebase key live only in Edge Function settings, never in the app.

**Personal data.** Handled under the Nigeria Data Protection Act 2023: a clear privacy policy, consent at sign-up, data kept no longer than needed, and an in-app delete-account option. ID photos sit in a private bucket and are deleted 30 days after the decision. Full bank account numbers are not stored; Paystack holds them and we keep the last four digits and a recipient code.

**Abuse limits**

- Rate limits on login, password reset, posting, accepting and code entry.
- One account per matric number; duplicate or mismatched IDs go to manual review.
- Item caps by trust level, and no new Buy jobs while an advance is unfinished.
- Strikes after upheld disputes; three means suspension.
- Prohibited-item keywords flag a request for review before it goes live.
- Handoffs only at listed public points and before the campus curfew.

**App hardening.** HTTPS only, tokens in secure storage, screenshots blocked on the handoff-code screen, and certificate pinning considered after the pilot.

## Infrastructure, environments and deployment

| Environment | Purpose | Payments | Data |
| --- | --- | --- | --- |
| Development | Each developer's local work against a local Supabase | Paystack test keys | Seed data: one campus, places, fake students |
| Staging | The build testers use; mirrors production settings | Paystack test keys | Test accounts only |
| Production | Real students during the pilot | Paystack live keys | Real data, backed up daily |

**Code and releases.** One Git repository with the app, the admin dashboard, database migrations and Edge Functions. Every change goes through a pull request; CI runs tests, applies migrations to staging and deploys functions. Production deploys are manual and tagged.

**Database changes.** Migrations only, never edits in the console. Money tables are append-only; a correction is a new reversing entry.

**App distribution.** Android first through a Play Console closed test track for the pilot, then open testing. iOS through TestFlight once the Android pilot is stable.

**Backups.** Daily automatic database backups with point-in-time recovery on the production project. A restore is rehearsed once before launch.

## Observability, operations and admin tooling

**What we watch**

- **Errors:** app crashes and function errors in Sentry, alerting the team chat.
- **Health:** an uptime check on the API every minute; Paystack webhook failures alert immediately.
- **Money:** the daily reconciliation result, any ledger imbalance, and payouts stuck in transit for more than an hour.
- **Marketplace:** time to match, match rate, completion rate and dispute rate per corridor, matching the PRD's pilot metrics.

**Admin dashboard screens**

- Verification queue: selfie, ID photo and matric number side by side; approve or reject with a reason.
- Disputes: the job timeline, chat, receipt and photos; refund, release or split.
- Jobs and users: search, timeline, wallet history, strikes, suspend.
- Places: add, rename or retire places and handoff points; set the campus curfew.
- Money: reconciliation reports and payout status.

**Runbooks.** Short written steps for the moments that matter: a failed payout, a webhook outage, a safety report, a suspected fraud ring, and a lost phone (sign out all sessions).

## Scaling path and open decisions

**Scaling path.** The pilot (around 5,000 students on one campus) fits comfortably on a single managed Postgres project. Growth steps, in order of need: database indexes on campus, status and deadline; a larger database tier; moving matching into a queue when push volume grows; read replicas for the admin dashboard; and a separate project per region only if latency demands it. A new campus is a campuses row, its places and its admins.

**Open technical decisions**

- [ ] Purchase advance at acceptance or reimbursement at handoff (decide after the pilot's first weeks).
- [ ] Licence or partner escrow product for holding student balances.
- [ ] Flutter app only, or also a lightweight web version for low-storage phones.
- [ ] Email provider choice, and a sender domain set up with SPF, DKIM and DMARC so codes don't land in spam.
- [ ] Hausa language support at launch or later.
- [ ] Whether school email domains can auto-verify students, cutting manual ID review.
