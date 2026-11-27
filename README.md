# 299 RELAY

Campus errand relay: students hand small errands to students already going that way. Pilot: ABU Zaria.

- Product: [docs/PRD.md](docs/PRD.md)
- Technical design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Screens: the 299 RELAY screens canvas (design artifact)

## Status

| Part | State |
| --- | --- |
| Backend (Supabase: schema, ledger, RPCs, RLS, cron) | Built, 80 pgTAP tests passing |
| Edge Functions (Paystack top-up, webhook, bank account, withdraw, push/email) | Built, typechecked, webhook + withdraw smoke-tested locally |
| Student app (`apps/web`) | Built: Next.js 16 PWA, 25 canvas screens, lint + production build clean |
| Admin dashboard (`apps/admin`) | Built: Next.js 16, ID checks, disputes, flagged requests, jobs, students, places and rules, money, audit log |

## Run locally

Needs Docker and the Supabase CLI. Ports are shifted to `553xx` so this runs beside other Supabase projects.

```bash
supabase start                 # API http://127.0.0.1:55321, DB :55322, mail UI :55324
supabase db reset              # re-apply migrations + seed
supabase test db               # pgTAP tests
cp supabase/functions/.env.example supabase/functions/.env
supabase functions serve --env-file supabase/functions/.env

cd apps/web && pnpm install && pnpm dev     # student app, http://localhost:3000
cd apps/admin && pnpm install && pnpm dev   # admin, http://localhost:3001 (admin@relay.test)
```

Sign-up codes and reset links land in Mailpit: http://127.0.0.1:55324.

## Student app (apps/web)

- Next.js 16 App Router, Tailwind 4, `@supabase/ssr`. `proxy.ts` (Next 16's renamed middleware) refreshes the session and redirects signed-out users to `/start`.
- Pages are client components: data is read in the browser through RLS and updated live with Supabase Realtime; every change calls an RPC or Edge Function.
- Design tokens (navy `#0B1F44`, orange `#FF7A00`, Inter + Montserrat) and logos come from the screens canvas.
- PWA: `app/manifest.ts`, `public/sw.js` (static assets cached, offline page). Photos are resized to ≤1280px JPEG before upload.
- Regenerate DB types after migrations: `supabase gen types typescript --local > apps/web/lib/database.types.ts`.

Seed logins (password `relay-test-123`): `admin@relay.test`, `aisha@relay.test` (₦10,000), `tunde@relay.test` (₦2,000), `bello@relay.test` (pending ID).

## How the backend is put together

- **Reads** go straight to Postgres through row-level security. **Writes** go through RPCs (`supabase.rpc(...)`), which are `SECURITY DEFINER` functions that check the caller, the rules and the money in one transaction. Clients cannot write tables directly, except their own hostel/photo/women-only fields and chat text.
- **Money** is kobo (`bigint`). Every movement is `private.transfer()`: one debit + one credit, append-only. `wallets` and `ledger_accounts.balance` are caches updated in the same statement; `private.reconcile_ledger()` re-derives them (run daily by pg_cron).
- **Errors** are raised with a stable code in the message (`insufficient_funds`, `already_taken`, `not_verified`, …). The app switches on it.
- **Edge Functions** exist only where an outside service is involved (Paystack, FCM, email). They call `svc_*` functions, which only the service role can execute.

### Main RPCs

| RPC | Caller |
| --- | --- |
| `quote_request`, `create_request`, `cancel_request` | Requester |
| `create_trip`, `cancel_trip` | Traveler |
| `accept_job` (first wins), `release_job`, `confirm_purchase`, `start_delivery`, `propose_substitute`, `submit_handoff_code` | Traveler |
| `respond_substitute` | Requester |
| `rate_job`, `open_dispute` | Either party |
| `submit_verification`, `request_withdrawal`, `register_device`, `mark_notifications_read` | Student |
| `review_verification`, `resolve_dispute`, `admin_review_request`, `admin_set_profile_status` | Admin |

### Edge Functions

| Function | Does |
| --- | --- |
| `topup-init` | Dedicated bank account (transfer) or Paystack checkout URL (card/USSD) |
| `paystack-webhook` | Verifies HMAC; credits top-ups; settles payouts. Idempotent |
| `bank-account` | GET bank list; POST resolves account name, must match verified name |
| `withdraw` | Moves money to in-transit, starts Paystack transfer, reverses on refusal |
| `dispatch-notification` | Push (FCM) + email (Resend) for each new notification row |
| `maintenance` | Hourly (pg_cron): deletes ID photos 30 days after review; re-checks payouts pending over an hour with Paystack, settles them or alerts admins once |

## Design system

Both apps use the **Relay** skin, built on the Vxrcel/Raven token vocabulary (`vxrcel-ui-design`, `references/new-skin.md`): light-first, round, flat, navy ink, one orange signal, with a **Relay Night** dark theme. Contrast pairs were checked against the skill's targets (ratios are commented next to the tokens).

- Tokens: `apps/web/app/globals.css` (`:root` and `.dark`). Components use roles (`bg-sheet`, `text-ink-2`, `bg-signal-soft`), never hex values.
- Type: Geist (body), Geist Mono (data, readouts), Montserrat (display, brand face). Numbers use `tabular`.
- Motion: `motion` with one spring for every sliding indicator (`lib/motion.ts`); reduced motion is handled in CSS, in `MotionConfig`, and per effect.
- Primitives in `components/ui/`, all custom: `Select` (searchable combobox, keyboard and screen-reader support), `TimeSelect`, `Checkbox`, `Switch`, `SearchInput`, `Dialog` (bottom sheet on phones), `useNotify().confirm` and `.toast`, `Alert`, `StatusChip`, `PillTabs`, `ChoiceChips`, `EmptyState`, skeletons. No native `<select>`, checkbox, time input, `alert()` or `confirm()`; forms use `noValidate` so the browser never shows its own bubbles.
- `apps/web` owns the design system; run `scripts/sync-ui.sh` to copy it into `apps/admin`.

## Admin dashboard (apps/admin)

- Same stack and login as the student app; non-admins are signed out. Reads go through RLS (`is_admin()`), decisions through the admin RPCs, which write `admin_audit`.
- Overview shows the PRD pilot metrics against their targets (`admin_metrics`) and ledger health (`admin_ledger_health`).

## Decisions made while building

- Handoff code stored in `job_handoff_codes`, readable only by the requester via RLS (instead of a hash on `jobs`); generated with `gen_random_bytes`.
- A released job is marked `cancelled`; its request returns to the feed and can be accepted again (unique index only over non-cancelled jobs).
- Disputes on already-completed jobs are recorded but money is already released; admins settle them with `p_clawback`.
- `handed_off` status from the doc is not used: a correct code completes the job directly.
- Requests matching a prohibited keyword are held in `review` with money in escrow until an admin approves or rejects.

## Known gaps

- If a traveler has withdrawn their purchase advance, returning unused budget or cancelling fails with `insufficient_funds` / `advance_spent`; the job then needs a dispute. Revisit with the "advance vs reimbursement" open question.
- Web push is wired (Settings toggle → FCM token → `register_device`) but hidden until the `NEXT_PUBLIC_FIREBASE_*` values in `apps/web/.env.example` are set; it has not been tested against a real Firebase project.
- Women-only matching is stored but not yet applied in matching.
- In-app account deletion is not built.
- Production: set Vault secrets `project_url` and `service_role_key` so pg_cron and the notification trigger can reach `maintenance` and `dispatch-notification`.
