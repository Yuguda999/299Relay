# 299 RELAY — Product Requirements Document

Nov 21, 2026 · @Muhammed

## Overview

The app lets students hand small errands to other students who are already going that way: buy something, pick it up, or drop it off. It turns trips that happen anyway into a cheap, fast campus delivery network. The pilot runs at Ahmadu Bello University (ABU), Zaria. Name: 299 RELAY, tagline “Together, we move.” This is a working brand until name clearance is done (see Open questions).

**Problem.** Students waste hours on small trips: a ₦500 purchase at the market, a printout from a business centre, a parcel at the main gate. Dispatch riders are too expensive for these jobs and often can't enter hostels. Meanwhile, hundreds of students make the same trips every day with free hands.

**Insight.** We don't create trips; we monetise trips that already happen. That keeps fees low (₦100–₦500 a job) and needs no fleet. Campuses suit this unusually well: movement is dense and predictable, and a shared student identity makes trust possible.

**Vision.** Every campus errand can be done by someone already on the way, within the hour, for less than the cost of a keke ride.

## Goals, non-goals and success metrics

The MVP must prove one thing: on a single campus, requests get matched and delivered reliably without disputes eating the margin.

**Goals**

- Prove two-sided liquidity on 2–3 high-traffic corridors at ABU.
- Make buy-and-bring safe for both sides through escrow and handoff codes.
- Build a verified, rated student community that can be copied to other campuses.

**Non-goals for the MVP**

- Off-campus or city-wide delivery, and non-student users.
- Live GPS tracking and route optimisation.
- Vendor storefronts and restaurant integrations.
- Large purchases above the item cap.

**Success metrics (pilot targets, first 8 weeks)**

| Metric | Target |
| --- | --- |
| Verified users | 1,000 |
| Active travelers (≥1 trip posted per week) | 100 |
| Request match rate (accepted within 30 min) | ≥ 70% |
| Completion rate of accepted jobs | ≥ 90% |
| Dispute rate | ≤ 3% of jobs |
| Weekly completed jobs | 500 by week 8 |
| Repeat requesters (≥2 jobs in 30 days) | ≥ 40% |

Targets are first estimates and should be reset after the validation phase.

## Target users and personas

Every user can play both roles; most will lean one way. Three personas drive the MVP.

| Persona | Who | Main need | Main fear |
| --- | --- | --- | --- |
| Aisha, the requester | 300-level student in a hostel far from the market, busy with labs | Get small items without losing an afternoon | Paying and never getting the item |
| Tunde, the regular traveler | 200-level student who goes to the market or main gate most days | Earn ₦2,000–₦5,000 a week from trips he already makes | Fronting cash, or being blamed for a wrong item |
| Bello, the opportunist | Any student heading somewhere once | Grab a quick job on the way | Hassle that isn't worth ₦200 |

Secondary stakeholders: campus vendors (business centres, provision shops), hostel porters at handoff points, and student affairs, whose tolerance the pilot depends on.

## Core concepts and the delivery loop

Three objects run the app. A **Trip** is a traveler's planned movement (from, to, time, capacity). A **Request** is a need with a type, place, deadline and fee. A **Job** is a request a traveler has accepted, and it follows one lifecycle.

&#91;embedded content: job lifecycle · 7 states\]

Pick-up and drop-off jobs skip the purchase step. A dispute freezes escrow until an admin refunds the requester or releases payment to the traveler.

## User journeys

Four journeys cover the MVP. Each ends with the handoff code and two-way ratings.

**A. Requester posts a need (pull)**

1. Aisha taps New request, picks a type (Buy, Pick up, Drop off) and a place from the campus list.
2. She describes the item, sets a deadline ("before 6pm") and a handoff point (Amina Hall gate).
3. For Buy, she enters the item budget; the app adds the suggested fee and holds the total from her wallet.
4. Nearby travelers heading that way get notified; the first to accept takes the job.
5. They chat to confirm details; Tunde buys, uploads the receipt photo, and travels.
6. At handoff Aisha shows her 4-digit code; Tunde enters it, and the escrow pays him.

**B. Traveler posts a trip (push)**

1. Tunde posts: "Block C → Samaru market, leaving 4:00pm, back 5:30pm, can carry 2 jobs."
2. Requesters browsing the trip feed send him requests attached to that trip.
3. He accepts up to his capacity; each accepted request follows steps 5–6 of journey A.

**C. Buy-and-bring with a price change**

1. The item costs more than the budget, or is out of stock.
2. Tunde sends a price update or substitute photo in chat.
3. Aisha approves the new amount (topped up from her wallet) or cancels at no cost to either side.

**D. Something goes wrong**

1. Either side taps Report issue (no-show, wrong item, damaged item).
2. Escrow freezes; both submit photos and a note.
3. An admin resolves within 24 hours: refund, release, or split. Ratings and strike counts update.

## Functional requirements (MVP)

P0 items ship in v1; P1 follows within weeks of launch; P2 waits for traction.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| F1 | Onboarding | Sign up and log in with email and password; confirm the email with a 6-digit code; reset a forgotten password by email link; then verify with matric number plus selfie and ID photo | P0 |
| F2 | Onboarding | Profile with name, photo, hostel, rating, completed jobs, verified badge | P0 |
| F3 | Places | Fixed list of campus places and handoff points (markets, gates, hostels, faculties) managed by admin | P0 |
| F4 | Trips | Post a trip: from, to, departure and return time, job capacity (1–3) | P0 |
| F5 | Requests | Post a request: type, place, item details, photo, deadline, handoff point, budget, fee | P0 |
| F6 | Feed | Browse trips and requests filtered by destination and time window | P0 |
| F7 | Matching | Accept a request, or send a request to a trip; first acceptance wins | P0 |
| F8 | Notifications | Push alerts for new matches on your route, acceptance, status changes | P0 |
| F9 | Chat | In-app chat per job with photo sharing; no phone numbers shown | P0 |
| F10 | Wallet | Top up via Paystack (card, transfer, USSD), hold in escrow, release, withdraw to bank | P0 |
| F11 | Handoff | 4-digit code shown to requester, entered by traveler to complete the job | P0 |
| F12 | Receipts | Traveler uploads receipt photo for Buy jobs before handoff | P0 |
| F13 | Ratings | Two-way 1–5 star rating with optional tags after each job | P0 |
| F14 | Disputes | Report issue, freeze escrow, admin resolution dashboard | P0 |
| F15 | Admin | Verify users, manage places, view jobs, resolve disputes, ban users | P0 |
| F16 | Trips | Recurring trips ("every weekday 4pm to Samaru") | P1 |
| F17 | Matching | Smart suggestions: requests along your usual routes | P1 |
| F18 | Safety | Women-only matching option and time-of-day limits | P1 |
| F19 | Growth | Referral codes with wallet credit | P1 |
| F20 | Vendors | Partner vendor listings with prices for faster Buy jobs | P2 |
| F21 | Scale | Multi-campus support with campus switching | P2 |

## Screens and app map

The MVP has 25 screens in four groups. All are drawn as a clickable prototype in the [299 RELAY screens canvas](https://claude.ai/artifact/1mPnLzTviBxCaoVvwEURW3).

| Group | Screen | What it does | Covers |
| --- | --- | --- | --- |
| Getting in | Splash | Logo, tagline and Get started | — |
| Getting in | Welcome | Three-line value pitch; create account or log in | — |
| Getting in | Sign up: your details | Name, email, password, campus, agree to terms (step 1 of 3) | F1 |
| Getting in | Sign up: confirm email | 6-digit code sent by email, with resend timer | F1 |
| Getting in | Sign up: student ID | Matric number, hostel, selfie and ID photo (step 2 of 3) | F1 |
| Getting in | Sign up: ID in review | Review status; browse while waiting, posting unlocks on approval (step 3 of 3) | F1, F15 |
| Getting in | Log in | Email and password, with a forgot-password link | F1 |
| Getting in | Reset password | Email a one-time reset link that expires after 30 minutes | F1 |
| Core flow | Home feed | Trips going out and open requests; quick actions; wallet balance | F6, F7 |
| Core flow | New request | Buy, pick up or drop off; items, places, budget, deadline; amount held | F5, F10 |
| Core flow | Post a trip | Route, times, job capacity, job types accepted | F4 |
| Core flow | Job tracking (requester) | Handoff code, traveler, chat, progress with receipt and refund | F9, F11, F12 |
| Core flow | Handoff code (traveler) | Enter the requester's code; earnings breakdown; rate | F11, F13 |
| Core flow | Wallet | Available and held balances, top up, withdraw, activity | F10 |
| Jobs | Request details (traveler) | Full request, requester profile, what you earn, accept | F7 |
| Jobs | Your trip (traveler) | Live trip, slots, jobs being carried, hand off, cancel trip | F4, F11 |
| Jobs | Chat and substitutes | Job chat with an approve/decline card for substitutes or price changes | F9 |
| Jobs | Report an issue | Issue types, details, photos; escrow frozen until resolved | F14 |
| Jobs | Rate and tip | Stars, tags and an optional tip after delivery | F13 |
| Jobs | My jobs | Active and past jobs, as requester and as traveler | F5, F7 |
| Account and money | Notifications | Job updates, matches on your route, wallet events | F8 |
| Account and money | Profile | Verified badge, rating, counts, account menu, log out | F2 |
| Account and money | Settings and safety | Notification switches, women-only matching, privacy, language, delete account | F8, F18 |
| Account and money | Top up wallet | Amount, bank transfer, card or USSD through Paystack | F10 |
| Account and money | Withdraw to bank | Amount and bank account; name must match verified name | F10 |

Not yet drawn: the admin dashboard (F15), recurring trips (F16) and referrals (F19).

## Payments, escrow and pricing

All money moves through an in-app wallet with escrow, so no traveler ever fronts their own cash and no requester pays before delivery is confirmed.

**Wallet model.** Students top up once (for example ₦5,000) and spend in small amounts. This avoids gateway fees on every ₦200 job, since per-transaction card fees would eat a large share of small tips. Gateway: Paystack or Flutterwave; current fees must be checked before launch.

**Escrow flow for a Buy job**

1. On posting, the app holds item budget + delivery fee from the requester's wallet.
2. On acceptance, the item budget is released to the traveler's wallet as a purchase advance; the fee stays held.
3. On handoff code entry, the fee is released to the traveler, minus the platform commission.
4. If the job fails before purchase, the advance returns to the requester.

Open question: releasing the advance at acceptance requires trusting the traveler with it. Alternative: the traveler pays and is reimbursed at handoff. Decide after the validation phase; the advance model is friendlier but needs strong traveler verification and lower caps for new users.

**Pricing**

| Job type | Suggested fee | Notes |
| --- | --- | --- |
| Pick up / drop off, same zone | ₦150 | Requester can raise it |
| Pick up / drop off, cross-campus | ₦300 | e.g. hostels to main gate |
| Buy and bring | ₦200 + 5% of item value | Covers effort and risk |
| Urgent (under 1 hour) | +₦100 | Optional boost |

**Limits.** New users: item cap ₦5,000 per job. After 10 completed jobs with rating ≥ 4.5: ₦15,000. Withdrawals to bank above a small minimum (e.g. ₦1,000).

**Commission.** 15% of the delivery fee only, never of the item value.

## Trust, safety and campus policy

Trust is the product. Every safeguard below exists so that a stranger on campus feels like a traceable classmate.

**Identity.** Students only, verified by school email or matric number plus a selfie matched to an ID photo. Verified badge on every profile. One account per matric number.

**Reputation.** Two-way ratings, completed-job counts and a strike system: 3 upheld disputes means suspension. Low-rated users see lower item caps.

**Handoffs.** Handoffs happen at designated public points: hostel gates, porters' lodges, faculty entrances. This respects restrictions on entering opposite-gender hostels and keeps meetings in public view.

**Privacy.** Chat in-app; phone numbers stay hidden. Location is shared only as a chosen place, never live tracking in the MVP.

**Personal safety.** No handoffs after a set hour (e.g. 9pm), configurable per campus. Optional women-only matching (P1). In-app report button on every job and profile.

**Prohibited items.** Alcohol, drugs, cigarettes, weapons, exam materials, cash-only transfers, and anything banned by university rules. Listed at request time; violations mean a ban.

**University relationship.** Before scaling past the pilot, meet student affairs and the Students' Union. Position the app as a student welfare service and share anonymised safety data.

## Non-functional requirements and architecture

The MVP should run on a managed backend so a small team can ship in about six weeks and spend its time on trust and liquidity, not servers.

**Non-functional requirements**

- **Light on data and devices.** Feed loads in under 2 seconds on a 3G connection; images compressed before upload; app install under 20 MB, or a PWA.
- **Reliable at peak.** Campus traffic peaks in afternoons and evenings; target 99% uptime during the pilot.
- **Correct money.** Every wallet movement is a double-entry ledger record that is never edited, only reversed. Gateway webhooks are verified and idempotent.
- **Privacy and compliance.** Handle personal data under the Nigeria Data Protection Act 2023. ID photos encrypted and visible only to admins; delete them after verification.
- **Scale.** Designed for about 5,000 users on one campus, with campus as a field on every record for later expansion.

&#91;embedded content: system architecture · MVP\]

The app and admin talk only to the backend; the backend alone talks to Paystack, push notifications and SMS, so no secrets or payment logic live on phones. An email service sends confirmation codes and password-reset links. The full technical design is in the [299 RELAY technical architecture doc](https://claude.ai/artifact/KaCUcf3xjTVqsW3JfmGNkU).

## Go-to-market

Build during the school break, test the prototype remotely, then launch a closed pilot on a few corridors as soon as school resumes, when demand peaks.

**Phase 0: Remote prototype tests (during the break).** Walk 8–10 trusted ABU students through the clickable prototype on video calls while they post a request and accept a job. Check that they understand the flow and would pay the suggested fees, then revise the designs before building. No public groups, so the concept stays out of view until launch.

**Phase 1: Closed pilot at resumption.** Pick 2–3 corridors with the most traffic (for example hostels ↔ Samaru market ↔ main gate). Recruit 20–30 "regular travelers" before launch with a launch bonus (e.g. ₦1,000 credit after 5 jobs). Seed demand with free-delivery codes for the first week. Access is invite-only, and the first 3–4 weeks double as validation: the team handles disputes by hand and ships fixes fast.

**Channels.** Hostel WhatsApp groups and class reps, departmental associations, flyers at business centres and gates, campus influencers, and the Phase 0 testers as first users.

**Phase 2: Full campus, then second campus.** Expand corridors as liquidity allows. Copy the playbook to a second campus only after the pilot metrics are hit.

## Business model

Revenue starts with a 15% commission on delivery fees; vendor partnerships are the larger long-term opportunity.

| Stream | When | How it works |
| --- | --- | --- |
| Delivery commission | MVP | 15% of each delivery fee |
| Urgent boosts | MVP | Platform keeps a share of the urgency surcharge |
| Vendor partnerships | P2 | Vendors pay to be listed and to receive orders delivered by the network |
| Promoted listings | P2 | Vendors or student sellers pay for visibility |
| Wallet float | Later | Interest on held balances, subject to regulation |

**Rough unit economics.** At an average fee of ₦250, commission is about ₦38 per job. 500 jobs a week gives about ₦19,000 weekly. One campus covers costs only at thousands of weekly jobs, so the case rests on multiple campuses and vendor revenue. These numbers need testing in Phase 0.

**Moat.** Not the software: the verified community, the density of regular travelers on each campus, and the reputation data.

## Risks, open questions and roadmap

The biggest risk is liquidity: if requests sit unmatched in the first weeks, users leave and don't return.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Too few travelers at launch | High | Recruit regular travelers first; launch on few corridors |
| Fraud or theft on Buy jobs | High | Escrow, item caps, verification, strikes |
| Fees too small to motivate | Medium | Test pricing in Phase 0; urgency boosts; recurring-trip bundling |
| University pushback | Medium | Engage student affairs early; safety rules |
| Gateway fees on small amounts | Medium | Wallet top-ups instead of per-job charges |
| Holidays and strikes empty the campus | Medium | Plan for seasonality; second campus |
| Copycats after launch | Low | Launch fast; lock in regular travelers and trust data before rivals reach density |

**Open questions**

- [ ] Clear the 299 RELAY name: CAC search, trademark, domains and app-store listings.
- [ ] Purchase advance at acceptance, or reimbursement at handoff?
- [ ] Which 2–3 corridors at ABU for the pilot?
- [ ] Do we need a licence to hold wallet balances, or can a gateway's split/escrow product cover it?
- [ ] Who handles disputes during the pilot, and within what hours?
- [ ] Hausa language support at launch, or English only?

**Roadmap**

1. Break, weeks 1–2: PRD sign-off, UI/UX design and clickable prototype.
2. Break, week 3: Remote prototype tests with 8–10 ABU students; revise designs.
3. Break, weeks 4–11: Build the MVP (P0 requirements). In parallel: CAC registration, Paystack business account, wallet and escrow licensing check, terms of use and privacy policy.
4. Before resumption: Recruit 20–30 testers and the first regular travelers; internal testing.
5. Term, weeks 1–4: Closed pilot on 2–3 corridors, treated as validation.
6. Term, week 5 onward: Open to the whole campus if pilot metrics hold, then P1 features.
