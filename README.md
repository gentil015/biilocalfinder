# Bii Localfinder

A modern service marketplace platform connecting clients with local service
providers (plumbers, electricians, mechanics, developers, photographers,
etc.), built as a modular monolith.

**Important product rule:** this platform never processes client → provider
service payments. Clients and providers settle payment for the actual work
directly. The *only* payment this platform handles is provider subscription
billing (Free / Pro / Business plans), behind a swappable
`PaymentProvider` interface (MTN MoMo, Airtel Money, Card, etc. can be
plugged in later).

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + React Hook Form + Zod + TanStack Query
- **Backend:** NestJS + TypeScript + REST + Socket.IO + JWT (access + refresh) + RBAC
- **DB:** PostgreSQL + PostGIS via Prisma
- **Cache/Jobs:** Redis + BullMQ
- **Storage:** S3-compatible (MinIO locally)
- **Search (MVP):** Postgres full-text + PostGIS radius search, behind a `ProviderSearchService` interface so OpenSearch can replace it later without touching controllers.
- **Ranking:** rule-based `ProviderRankingService`, behind the same interface an ML ranker will implement later.

## Design system

All UI colour comes from the four custom palettes in
`apps/web/tailwind.config.ts`. **Never reach for stock Tailwind neutrals** —
`slate`/`gray`/`zinc` used to run alongside `ink` and the two drifted apart;
`ink` is now the only neutral ramp.

| Token | Role |
| --- | --- |
| `canvas` | Page background (`#F3F1EB`, warm off-white) |
| `ink-50…950` | The single neutral ramp: surfaces, borders, body and muted text |
| `brand-50…900` | Primary actions, links, focus rings |
| `accent-50…600` | Highlights and the dark-hero mesh only — not a general accent |
| `red` / `amber` / `emerald` / `blue` | **Intentionally stock Tailwind.** They carry status meaning (error / warning / success / info), not surface meaning, so they are not remapped onto a brand ramp. |

Shared component classes live in `apps/web/app/globals.css` — prefer these
over hand-rolling equivalents:

- `.page-shell` — centred max-width page container
- `.surface-card` — the standard card (`rounded-2xl`, hairline border, `shadow-lift`, backdrop blur)
- `.btn-primary` / `.btn-secondary` / `.chip`

Inputs, `textarea` and `select` are styled globally by element selector, so
most of them need no utility classes at all.

**Contrast:** the `ink` ramp is darker than the `slate` it replaced at every
step, so legibility improved — `ink-400` (the muted-text token) went from
2.56:1 to 3.85:1 on white. Note that `ink-300` and `ink-400` still fall below
WCAG AA (4.5:1) for **small** text and are only appropriate for large or
decorative text; use `ink-500`+ for body copy.

## Monorepo layout

```
apps/
  api/     NestJS backend
  web/     Next.js frontend
packages/
  types/   Shared TypeScript types/enums used by both apps
infra/
  docker/  docker-compose + Dockerfiles
docs/
```

## Development order (from the project spec)

This repo is being built **phase by phase**, not all at once. Status:

- [x] **Phase 1** — Project setup, Docker, DB, Prisma schema, NestJS bootstrap, Next.js bootstrap, Auth, RBAC
- [x] **Phase 2** — Users, Clients, Providers, Categories, Services
- [x] **Phase 3** — Locations, PostGIS, provider search, filters, provider profiles
- [x] **Phase 4** — Service requests, Quotes, Negotiation, Bookings
- [x] **Phase 5** — Realtime messaging, Notifications
- [x] **Phase 6** — Portfolio, Reviews, Favorites, Provider verification
- [x] **Phase 7** — Provider subscriptions + payment abstraction
- [x] **Phase 8** — Admin dashboard
- [x] **Phase 9** — Testing, security hardening, performance
- [x] **Phase 10** — Production deployment
- [x] **Phase 11** — Trust & verification, reputation/reviews hardening
- [x] **Phase 12** — Availability & scheduling, quote workflow depth
- [x] **Phase 13** — Provider portfolio, analytics dashboard, growth assistant
- [x] **Phase 14** — Notification center, compare providers
- [x] **Phase 15** — Location intelligence, dispute management
- [x] **AI-assisted request writing** ← **you are here**

The platform now covers every phase in the original spec. See "What's
implemented" below for what each phase delivered, and
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for how to actually put this on
a VPS.

Each phase will be delivered with: DB migration, backend module, frontend
pages wired to the API, validation, error handling, and a short test pass —
before moving to the next.

## Phase 11 — Trust & verification, reviews & reputation

Added on top of Phase 1-10 without touching the payment boundary or any
existing endpoint contracts (only additive fields):

**Verification**
- `VerificationRecord` (+ `VerificationDocument`) model: IDENTITY / BUSINESS /
  SERVICE submissions, admin-reviewed, with expiry and renewal — not a single
  boolean. `Provider.verificationStatus/identityVerified/businessVerified` are
  *derived* from these records (`src/verification/verification-status.ts`),
  never set directly.
- "Verified Provider" badge = live identity verification + a phone number
  confirmed by a one-time code (`ContactVerificationCode` /
  `ContactVerificationService`). Business verification is a separate,
  optional badge.
- Documents are stored **privately** (no public ACL) and only ever handed to
  admins as short-lived signed URLs (`StorageService.getSignedUrl`); every
  view is audit-logged. Uploaded bytes are sniffed
  (`src/verification/file-sniffer.ts`), never trusted by the client's
  declared MIME type.
- A daily BullMQ job (`VerificationSweepProcessor`) expires lapsed approvals
  and sends "expiring soon" reminders; admins can also suspend/reinstate a
  badge (e.g. a forged document discovered after approval).
- `PostgresProviderSearchService` already excludes `SUSPENDED` providers from
  search and boosts `VERIFIED` ones in ranking — unchanged, now backed by the
  derived status.

**Reviews & reputation**
- `Review` gained per-dimension ratings (quality / communication /
  professionalism / value), up to 5 photos, a `PUBLISHED/HIDDEN` moderation
  state, and a provider response thread.
- **Verified booking** review badge is intentionally a *strong* signal: it
  requires both a COMPLETED platform booking **and** a reviewer with a
  verified email or phone (`src/reviews/review-integrity.ts`). Softer risk
  patterns (brand-new account, unverified contact, unusually fast
  completion) are recorded as admin-only `integrityFlags` — never shown to
  clients, but surfaced in `/admin/reviews/flagged` for moderation.
  `Provider.rating/reviewCount/verifiedReviewCount` are recomputed from an
  aggregate over `PUBLISHED` reviews only, same pattern as before.
- Reviews close 60 days after booking completion.

**Reports**
- `Report` gained a `category` enum and an `OPEN → UNDER_REVIEW → RESOLVED /
  DISMISSED` workflow (was a single `resolvedAt` timestamp). Now covers
  `SERVICE_OFFERING` as a reportable target, in addition to users, providers,
  messages, bookings, and reviews. The admin detail endpoint resolves and
  returns whatever the report's target actually is.

New tables need `prisma migrate dev` to apply, plus the partial unique index
in `prisma/manual-sql/002_trust_and_reviews.sql` (same pattern as
`001_add_postgis.sql` — run it once after migrating).

## Phase 12 — Availability & scheduling, quote workflow depth

**Availability & scheduling**
- New `AvailabilityModule` (`src/availability`). `Availability` (weekly
  pattern, one row per weekday) gained a `@@unique([providerId, dayOfWeek])`
  constraint and is now edited as a whole week in one call
  (`PUT /provider/availability/weekly`) instead of one day per request — a
  day simply absent from the payload becomes unavailable.
- New `AvailabilityException` model: a specific-date override on top of the
  weekly pattern (block an otherwise-open Saturday for a booked wedding, or
  open up a normally-off Wednesday). Always wins over the weekly row for
  that date.
- `src/availability/availability-summary.ts` is the single, unit-tested,
  pure function behind "Available today" / "Available tomorrow" / "Next
  available: Friday" (spec §3) — no DB, so the rule can't drift between the
  provider's own view and what clients see. A provider's manual
  `availabilityStatus = UNAVAILABLE` (pause) always overrides the schedule.
- Wired in at read time, not baked into the swappable
  `ProviderSearchService` interface: `SearchController` and
  `ProvidersService.getPublicProfile` both call
  `AvailabilityService.summariesForProviders`/`summaryForProvider` and
  attach the result, so OpenSearch (spec §51) or any other search backend
  never needs to know about weekly schedules.
- Provider-facing editor at `/provider/availability` (weekly table + status
  toggle + date overrides); computed badge + weekly hours shown on search
  cards and the provider profile.

**Quotes**
- `Quote` gained `materials`, `includedItems`/`excludedItems` (string
  arrays), and a `QuoteAttachment` relation (private-storage-backed photos
  or spec sheets, same namespacing/ownership pattern as verification
  documents and review photos — `POST /quotes/attachments` →
  `attachments: [{storageKey, fileName}]` on `POST /quotes`).
  `expiresAt` is now validated to be in the future.
- `SendQuoteForm` / `QuoteThread` updated so a client comparing quotes sees
  price, duration, materials, what's included/excluded, and attachments
  side by side — not just a bare number.

**Smart service-request builder**
- This was already built (dynamic `CategoryAttribute`-driven form on
  `/requests/new`, backed by `GET /categories/:id/attributes` and
  `RequestAttributeSnapshot`). The only gap closed here: the captured
  answers (event date, guests, vehicle make, etc.) are now actually shown
  on both request detail pages — previously they were saved but never
  displayed back.

`Availability.@@unique` / `AvailabilityException.@@unique` are expressed in
`schema.prisma` and created by `prisma migrate dev`. Run
`prisma/manual-sql/003_availability_and_quotes.sql` once afterward for the
two supporting indexes (same pattern as 001/002).

## Phase 14 — Notification center, compare providers

**Notification center (spec §10)**
- `NotificationType` gained `BOOKING_REMINDER`, `FAVORITE_PROVIDER_AVAILABLE`,
  `NEW_PROVIDER_MATCH`. New `NotificationCategory` enum groups all types into
  7 settings-screen-sized buckets (Quotes, Messages, Bookings, Reviews,
  Trust, Subscription, Discovery) —
  `src/notifications/notification-categories.ts` is the single mapping both
  the API and the preferences UI read from.
- New `NotificationPreference` (per user × category: inApp/push/email
  toggles) and `PushSubscription` models.
  `NotificationsProcessor` is now the single fan-out point: it persists the
  in-app row (and only emits the realtime socket event) when `inApp` is on,
  and independently attempts push/email based on their own toggles — a
  caller still just calls `notifications.notify(...)` once, same as before.
- Channels follow the same pluggable-sender pattern as
  `verification/otp-sender.ts`: `channels/push-sender.ts` is wired to a real
  `web-push`/VAPID implementation (generate keys with
  `npx web-push generate-vapid-keys`, set `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL`); `channels/email-sender.ts`
  is deliberately left as a logging stand-in — spec: "Don't implement every
  channel immediately" — ready for a real provider via one new class +
  rebinding `EMAIL_SENDER`. SMS has no channel at all yet, by the same
  instruction.
- `BookingReminderProcessor` (hourly sweep, reminds both participants once,
  24h before `Booking.scheduledAt`, guarded by the new
  `Booking.reminderSentAt`).
- `FAVORITE_PROVIDER_AVAILABLE` fires from `AvailabilityService.setStatus`
  on the BUSY/UNAVAILABLE → AVAILABLE transition specifically — scoped there
  rather than a daily "today's slot opened" sweep, which would notify for
  every provider every morning regardless of whether anything actually
  changed.
- New `SavedSearchesModule` (`SavedSearch` model: service/category/city/
  verifiedOnly/maxPrice + `GET/POST /saved-searches`,
  `DELETE /saved-searches/:id`) backs `NEW_PROVIDER_MATCH`: a daily sweep
  (`SavedSearchSweepProcessor`) finds providers *newly signed up* since a
  search's `lastNotifiedAt` that match its filters, and sends one digest
  notification per search (not one per matching provider). Detecting an
  *existing* provider newly matching (e.g. they just added a matching
  service) is out of scope for this pass — noted here rather than silently
  dropped.
- Frontend: `/settings/notifications` (channel toggle grid + push opt-in),
  `/saved-searches` (manage), a "Save search" button on `/search`, and a
  push-enable button that registers `public/service-worker.js` and
  subscribes via the Push API.

**Display language / Kinyarwanda**
- This is the app's first i18n surface, and deliberately a small one.
- `locale TEXT NOT NULL DEFAULT 'en'` on `users` (migration
  `20261005190000_add_user_locale`). Plain `TEXT`, not a Prisma enum: the set
  of languages is product data, not a database concern, and adding one should
  not need a migration.
- `PATCH /api/users/me/locale` (`UsersController.updateLocale` →
  `UsersService.updateLocale`). `UpdateLocaleDto` whitelists the tags in
  `apps/api/src/common/locales.ts`, so the global `ValidationPipe` rejects an
  unknown tag with a 400 before it reaches the column. Returns the updated user
  in the same shape as `GET /users/me`.
- Web side: `apps/web/lib/locales.ts` holds the catalogue (code, endonym,
  English name, direction) and the message catalog; `components/locale-provider.tsx`
  exposes `t()` plus locale-aware `Intl` formatters, and corrects `<html lang>`/
  `dir` on the client. English is the reference catalog and every other locale is
  type-checked against it, so a missing key is a build error.
- `/settings/languages` is a radio list rather than a `<select>`: with two
  options each one stays visible, and each shows a date formatted in its own
  locale so the difference is concrete before saving.
- **Translated so far: the settings surfaces only** (`/settings/languages`,
  `/settings/notifications`, `/settings/personalization`). The rest of the app
  still renders hardcoded English. Two known gaps, noted rather than
  half-solved: notification category labels come from the API
  (`CATEGORY_LABELS`), and category/service names in the personalization screen
  are database content — translating those is a data task, not a UI one.
- The auth token lives in localStorage, so the server cannot know the user's
  language. `<html lang>` therefore renders as `en` and is corrected on the
  client once `/users/me` resolves. A layout that read the language server-side
  would need the token moved to a cookie — not done here.

**Compare providers (spec §11)**
- `GET /providers/compare?ids=a,b,c` (`ProvidersService.compare`, 2–3
  providers, declared ahead of `GET /providers/:id` so `compare` is never
  captured as a provider id): rating, experience, starting price,
  verification badges, response time, and computed availability — the last
  one reuses `AvailabilityService.summariesForProviders`, the same source
  of truth as search cards and the profile page.
- Frontend: a `Scale` toggle on each `ProviderCard` in search results (up to
  3), a floating compare tray, and `/compare?ids=...` rendering the table
  from the spec (provider columns, rating/experience/price/verified/
  response/availability rows).

Run `prisma migrate dev` for the new tables, then
`prisma/manual-sql/004_notifications_and_saved_searches.sql` once
afterward (same pattern as 001-003).

## Phase 15 — Location intelligence, dispute management

**Location intelligence (spec §12)**
- Coverage-area matching in search: `service_areas.geom` (added back in the
  original PostGIS migration, 001_add_postgis.sql) was defined but never
  queried. `PostgresProviderSearchService`'s radius filter is now `(within
  the general search radius of the provider's home base) OR (the query
  point falls inside one of the provider's own drawn coverage circles)` —
  a provider based 40km away who explicitly covers the query's
  neighborhood now shows up even outside the blanket radius. Each result
  also carries `servesArea: boolean | null`, a stronger signal than plain
  proximity, shown as a "Serves your area" badge.
- `GET /providers/:id?lat=&lng=` now returns `distanceKm` /
  `servesQueriedLocation` when coordinates are passed — same coverage rule
  (`common/utils/geo.ts` `coversPoint`, Haversine) as the SQL version, so
  the profile page and search results never disagree about what "serves
  your area" means. A new `ServesYourAreaCheck` client component makes this
  opt-in (asks for the browser's location only on click, never
  automatically).
- Real interactive maps via Leaflet + OpenStreetMap tiles — no Mapbox/Google
  API key needed, so this actually renders today rather than staying a
  "wire this once a key exists" placeholder: search results (client map,
  pins, click-through to profile), the provider profile (location +
  coverage circles), and a new `/provider/service-areas` page (drag-a-pin +
  radius-slider editor, backed by the `me/service-areas` endpoints that
  already existed but had no UI). "Use my location" + 5/10/25/50km radius
  chips on `/search` feed the client map and the coverage-aware search
  query.

**Dispute management (spec §14)**
- `Dispute` went from a bare stub (no evidence, no thread, no real
  workflow) to the full flow: Client/provider → `POST /disputes` (report a
  problem on a booking) → either side attaches evidence
  (`POST /disputes/:id/evidence`, private storage + signed URLs, same
  pattern as verification documents) and exchanges messages
  (`POST /disputes/:id/messages`) → the respondent's first reply
  auto-advances `OPEN` → `RESPONDED` (spec's "Provider response" step,
  not a status either side sets by hand) → an admin pulls it into
  `UNDER_REVIEW` from either state → `RESOLVED`/`REJECTED` with a
  `DisputeResolutionType` (no action / warning / refund *recommended* /
  provider suspended / booking cancelled / other) — recorded and
  categorized, never an actual refund, since the platform never touches
  the underlying payment. `disputes/dispute-status.ts` is the single,
  unit-tested transition graph.
- New `DISPUTE_OPENED/RESPONSE/UNDER_REVIEW/RESOLVED` notification types,
  grouped under the existing BOOKINGS preference category rather than a
  new settings row (every dispute is tied to a booking).
- Frontend: a "Report a problem" link on the booking detail page,
  `/disputes/new` → `/disputes/:id` (thread + evidence, client/provider
  side), `/disputes` (mine), and `/admin/disputes` +
  `/admin/disputes/:id` (review queue, evidence viewer, resolution form).

Run `prisma migrate dev` for the Dispute model changes, then
`prisma/manual-sql/005_disputes.sql` once afterward (same pattern as
001-004). No new manual SQL was needed for location intelligence —
`service_areas.geom` already existed.

## Getting started

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up -d   # postgres+postgis, redis, minio

cd apps/api
npm install
npx prisma migrate dev --name init
psql "$DATABASE_URL" -f prisma/manual-sql/001_add_postgis.sql   # enables PostGIS (see prisma/migrations_notes)
npx prisma db seed
npm run start:dev        # http://localhost:4000  (Swagger at /api/docs)

cd ../web
npm install
npm run dev               # http://localhost:3000
```

### Password reset

`/forgot-password` → an emailed link → `/reset-password?token=…`. No
configuration is needed to try it locally: with `SMTP_HOST` unset the API logs
the message (including the link) instead of sending it, so pull the token from
the API log:

```bash
grep -o 'token=[0-9a-f]*' <api log>    # dev only
```

To send real mail, set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`
(and `EMAIL_FROM`) in `.env` — `SmtpEmailSender` then takes over from the
logging sender automatically. `WEB_URL` is the web app's public base URL and
is what the emailed link points at; `PASSWORD_RESET_EXPIRES_MINUTES` sets the
link's lifetime.

Design notes:

- Tokens are 256 bits from `crypto.randomBytes`, single-use, and stored only as
  a SHA-256 hash (`password_reset_tokens`), so database read access is not
  enough to reset anyone's password.
- Requesting a reset revokes any outstanding reset tokens, so only the newest
  emailed link works.
- A successful reset revokes every refresh token for that user — otherwise a
  session stolen before the reset could mint access tokens indefinitely.
- The request endpoint does not reveal whether an address has an account
  (identical body, status, and a padded response time), and an SMTP failure
  is logged rather than surfaced, since a 503 only for real accounts would be
  an enumeration oracle.
- Reset mail bypasses the notifications queue on purpose: that queue is
  preference-gated and skips unverified addresses, neither of which should
  apply to a password reset.

## What's implemented

**Phase 1 — Auth & foundations**
- Full Prisma schema for every core entity in the spec, with PostGIS-ready
  geography columns, enums, and indexes.
- NestJS bootstrap: global validation pipe, Helmet, CORS, Swagger,
  centralized exception filter.
- Auth module: register, login, logout, JWT access + refresh (rotation),
  password reset, `@Roles()` + `RolesGuard`.
- Next.js bootstrap, landing page, login/register pages.

**Phase 2 — Users, Clients, Providers, Categories, Services**
- Categories module: hierarchical (parent/child), admin CRUD, public tree read.
- Services module: admin-managed catalog scoped to a category.
- Clients module: `GET/PATCH /clients/me`.
- Providers module: profile CRUD, add/remove offered services with pricing,
  set location, add/remove service areas, weekly availability.

**Phase 3 — Locations, PostGIS, search, provider profiles**
- `MapProvider` interface with a Mapbox implementation and an offline mock
  fallback (`/locations/search`) — business logic never talks to Mapbox
  directly.
- Raw SQL (`prisma/manual-sql/001_add_postgis.sql`) enabling PostGIS,
  adding `geography` columns kept in sync by trigger, and GiST indexes.
- `ProviderSearchService` interface with `PostgresProviderSearchService`:
  real `ST_DWithin`/`ST_Distance` radius search, full filter set (service,
  category, rating, price range, experience, availability, verification),
  sorting, and pagination — no distance math in JS.
- `ProviderRankingService` interface with a `RuleBasedRankingService`
  (relevance + distance + rating + availability + response rate +
  experience), swappable later for an ML ranker without touching callers.
- Frontend: `/search` (desktop 3-column filters/results/map, mobile
  bottom-sheet filters + map), `/providers/[id]` public profile.

**Phase 4 — Service requests, quotes, negotiation, bookings**
- Service Requests module: create (client), list mine/incoming, cancel.
  A conversation row is created alongside a targeted request so Phase 5's
  realtime messaging has something to attach to.
- Quotes module: provider sends a quote; structured negotiation via
  `QuoteRevision` (propose/accept/reject counter-offers — never plain
  chat); accepting a quote atomically creates a Booking.
- Bookings module: `BookingStateMachine` is the single source of truth for
  valid transitions and who may perform them — enforced on the backend,
  never the frontend. No service-payment endpoint anywhere; bookings only
  ever surface `paymentArrangementNote`.
- Frontend: request creation form, client/provider request detail pages
  with a shared negotiation UI, provider's incoming-requests queue,
  bookings list + detail page with status actions and the required
  "payment is arranged directly with the provider" notice.

**Phase 5 — Realtime messaging, notifications**
- `SocketServerRegistry`: a tiny, dependency-free holder for the one
  underlying Socket.IO server, so `MessagingModule` and
  `NotificationsModule` can both push realtime events without importing
  each other (no circular-module workarounds needed).
- `MessagingGateway`: JWT-authenticated socket connections, per-user
  presence (online/offline, multi-tab aware), typing indicators, and
  `message:send` → persist → broadcast. A REST fallback
  (`/conversations/...`) covers clients that can't hold a socket open.
- Notifications: enqueued through BullMQ (`NotificationsService.notify()`),
  persisted and pushed live by `NotificationsProcessor` — structured so
  email/SMS/push consumers can register on the same queue later without
  any caller changing. Wired into service requests (new request), quotes
  (new quote/updated/accepted/rejected), and bookings (status changes).
- Frontend: chat thread with live typing indicators, conversation list,
  and a notification bell that updates in real time over the same socket.

**Phase 6 — Portfolio, reviews, favorites, verification**
- `StorageService` interface with an `S3StorageService` implementation
  (works against MinIO locally, real S3 in production) behind a validated
  `POST /files/upload` — MIME type and size checked server-side, filename
  never trusted for anything but its extension.
- Portfolio module: providers manage work-sample galleries, gated by a
  free-tier image cap (subscription limits fully enforced in Phase 7).
- Reviews module: only the client on a `COMPLETED` booking may review it,
  once; provider rating recalculated from an aggregate (not an incremental
  running average) to avoid drift.
- Favorites and admin-only provider verification (with audit logging).

**Phase 7 — Provider subscriptions & payment abstraction**
- `PaymentProvider` interface — `charge()` is the only method anything
  depends on. `MockPaymentProvider` (default, always succeeds — lets the
  whole flow work with zero configuration) plus stubbed
  `MtnMomoPaymentProvider` / `AirtelMoneyPaymentProvider` /
  `CardPaymentProvider` as real integration points, selected by
  `SUBSCRIPTION_PAYMENT_PROVIDER`.
- `SubscriptionsService` orchestrates plan lookup → charge → subscription +
  transaction record-keeping, exposing exactly the endpoints from the
  spec: `GET /subscription/plans`, `POST /subscriptions`,
  `GET /subscriptions/current`, `POST /subscriptions/:id/cancel`,
  `GET /subscriptions/history`. Cancelling never deletes provider data —
  only `subscriptionStatus` changes.

**Phase 8 — Admin dashboard**
- `AdminService`: platform analytics (users, providers, verified
  providers, active subscriptions, active/completed bookings, new
  requests, open reports/disputes) and user management (suspend/activate,
  blocked for admin accounts), all logged via a shared `AuditLogService`.
- Reports and Disputes modules (file → admin reviews → resolves), plus an
  admin audit-log endpoint to see the trail those actions leave.

**Phase 9 — Testing, security, performance**
- Fixed a real gap: `ThrottlerModule` was registered but its guard was
  never bound — `ThrottlerGuard` is now applied globally via `APP_GUARD`,
  so the rate limit is actually enforced, not just configured. Auth
  endpoints (register/login/password-reset) get materially tighter limits
  than the global default — the classic brute-force/spam targets.
  Suspended accounts are already rejected at the JWT strategy level.
- Added hard result caps (`take: ...`) on every list query that had none,
  so nothing can return unbounded rows (spec §43) even where a full
  pager isn't wired up yet.
- Added unit tests for `ReviewsService` (completed-booking gate, no
  duplicate reviews) and `SubscriptionsService` (charge success/failure
  paths, and that only the plan price is ever charged — never a service
  payment).
- Ran a real `npm install` + `tsc --noEmit` + `jest` pass across the whole
  backend in this environment and fixed every genuine bug surfaced
  (several implicit-`any` issues); see "A note on verification" below for
  what's a sandbox artifact vs. a real problem.

**Phase 10 — Production deployment**
- Production `docker-compose.prod.yml`: full stack (postgres+postgis,
  redis, minio, api, web, nginx) in one file for a single-VPS deploy,
  with required secrets enforced via Compose's `:?` syntax rather than
  silently defaulting.
- `infra/nginx/nginx.conf`: reverse proxy routing `/api/*` and
  `/socket.io/*` to the backend (with proper Upgrade headers for
  Socket.IO) and everything else to Next.js, plus an edge-level
  `limit_req` as defense in depth alongside the app's `ThrottlerGuard`,
  and the ACME HTTP-01 path wired for Let's Encrypt.
- Optional Sentry integration: activates only when `SENTRY_DSN` is set
  (never in local dev), wired into the global exception filter for
  unhandled errors. OpenTelemetry is deliberately left as a documented
  next step rather than wired up now — the spec explicitly warns against
  over-engineering monitoring for an MVP.
- `docs/DEPLOYMENT.md`: step-by-step VPS deployment — provisioning,
  secrets, migrations (including the manual PostGIS SQL step), TLS via
  certbot, MinIO bucket setup, backups, and what to change first when the
  single-VPS setup needs to scale (managed Postgres/Redis, real S3,
  multiple API replicas with a Socket.IO Redis adapter, OpenSearch) —
  in that order, and not before they're actually needed.

Every phase from the original spec is now implemented. See
`docs/DEPLOYMENT.md` to actually put this on a server, or ask for changes
to any phase.

## Fixes from code review

Three real bugs were found by review after the above was built, and fixed:

- **Security: registration role validation.** `RegisterDto` used
  `@IsEnum(UserRole)`, which validates against the *full* Prisma enum
  (`CLIENT | PROVIDER | ADMIN`) — silently contradicting its own
  `@ApiProperty({ enum: ['CLIENT','PROVIDER'] })` docs. A direct API call
  with `{ "role": "ADMIN" }` could self-register an admin account. Fixed
  with an `@IsIn(REGISTERABLE_ROLES)` check restricted to `CLIENT`/
  `PROVIDER`, *plus* the same check re-enforced independently in
  `AuthService.register` itself (defense in depth — never rely on DTO
  validation alone for something this sensitive). Covered by a regression
  test that simulates a caller bypassing the DTO.
- **Search only matched provider business name.** `p."businessName" ILIKE
  ...` meant searching "wedding photographer" would never find a provider
  named "ABC Creative Studio" offering "Wedding Photography" — a real
  marketplace UX problem. Rewritten to use Postgres full-text search
  (`to_tsvector`/`to_tsquery`, OR-joined per word so partial word overlap
  still matches) across provider name, service name/description, category
  name, and offering title/description. User input is tokenized and
  stripped to alphanumerics before being handed to `to_tsquery`, so it can
  never inject or break tsquery syntax. Covered by unit tests for the
  query-building logic.
- **Recommendation ranking saw too few candidates.** `PostgresProviderSearchService`
  returned `LIMIT 30`-ish candidates *before* `RecommendationService`
  applied personalized ranking — so with, say, 500 matching providers, the
  best personalized match could rank #47 by raw rating and never even
  reach the ranking step. Fixed by fetching a much larger, named,
  documented candidate pool (`RECOMMENDATION_CANDIDATE_POOL_SIZE = 300`)
  regardless of how many results are ultimately returned. This is an
  explicitly acknowledged V1 stopgap, not a full fix — the real long-term
  answer is a proper candidate/ranking pipeline backed by OpenSearch (spec
  §51), noted directly in the constant's comment. Covered by a regression
  test asserting the candidate pool size independent of the requested
  result count.

## Personalization (V1, rule-based)

A dedicated `personalization` module adds recommendations without any
ML/vector-DB/external AI service — pure PostgreSQL + Redis + BullMQ, kept
separate from providers/services/bookings/search per its own design brief.

- **Interactions** (`personalization/interactions`): meaningful actions
  only (search, views, favorites, requests, quotes, bookings) — never
  every UI event. Recorded automatically from inside the modules that
  already handle each action (the same pattern as `NotificationsService`),
  plus one manual endpoint for pure frontend view events with no natural
  backend hook.
- **Interests** (`UserInterest`): a raw accumulated score per
  category/service, decayed at read time by a simple exponential curve
  (`recencyFactor`) — no stored value is ever "decayed in place."
- **Recommendation engine** (`personalization/recommendation`): a
  `RecommendationEngine` interface with `RecommendationService` as its V1
  rule-based implementation — six separate, named scoring functions
  (search relevance, personal interest, distance, rating, availability,
  provider quality) combined via admin-configurable weights
  (`RankingConfig`, editable at `/personalization/admin/ranking-weights`
  with no deploy required). A future `MLRecommendationEngine` implements
  the exact same interface.
- **Cold start**: three stages (new / some activity / established) — a
  new user never sees an empty personalized homepage; they get popular +
  highly-rated + available instead.
- **Caching**: Redis is the hot-path cache (`recommendations:user:{id}`,
  short TTL); a `RecommendationCache` DB row records what was last
  generated for inspection after a cache flush. Heavy interactions
  (bookings, favorites) invalidate via a BullMQ job; light ones (views,
  searches) just do a synchronous row upsert.
- **Privacy**: no formal relation to `User` on any personalization table
  (soft/derived data, easy to reason about in isolation); provider-facing
  "opportunity" insights are only ever an aggregate across at least
  `MIN_DEMAND_USERS_TO_SURFACE` distinct users, never one identifiable
  person's activity; a personalization on/off switch falls back to fully
  generic (popular/nearby/rated/available) recommendations.
- **Frontend**: personalized homepage sections (recommended providers,
  "because you're into X", nearby, recently viewed), a personalization
  settings page with interest stars (never raw scores), a provider
  dashboard with recommended actions and aggregated demand opportunities,
  and the admin ranking-weights page.

Verified the same way as the rest of the backend — a real `npm install` +
`tsc --noEmit` + `jest` pass (see "A note on verification" below), plus a
full Next.js production build for the frontend, which caught and fixed two
real bugs (`useSearchParams` needing a `Suspense` boundary on `/search` and
`/requests/new` — not a sandbox artifact) and one outdated `next` version
with a known CVE (bumped 14.2.13 → 14.2.35).

## Dynamic category-specific service attributes

Every service category can now define its own set of custom fields —
without touching the schema or writing new frontend components for each
one. Architecture: `Provider → ServiceOffering → Service → ServiceCategory
→ CategoryAttribute`.

- **`ServiceOffering`** replaces the old, simpler `ProviderService` join
  table in place (migrated, not duplicated — the old model, endpoints, and
  frontend "add service" flow are gone; this supersedes them). It carries
  its own title, description, price, price type, duration, and one typed
  value per category attribute — never a shared Provider-level field
  (spec §2: "do NOT give every service provider the same static fields").
- **`CategoryAttribute`** (admin-managed): name, `TEXT | NUMBER | BOOLEAN |
  SELECT | MULTI_SELECT | PRICE`, required/filterable/searchable/public
  flags, display order, and options for SELECT/MULTI_SELECT. Admin CRUD
  lives on the categories module (`POST/PATCH/DELETE
  /categories/:id/attributes`, `.../reorder`) since attributes are
  category data, not a separate concept.
- **`ServiceOfferingAttributeValue`**: one typed value per (offering,
  attribute) — only the column matching the attribute's type is ever
  populated. All validation (attribute belongs to this category, is
  active, value matches type, SELECT/MULTI_SELECT values are in the
  configured options, required fields are present) happens once, in
  `CategoriesService.validateAttributeValue` / `ServiceOfferingsService.
  validateAttributeValues` — reused by offering creation, offering
  updates, and service-request submission alike. The frontend never
  decides what's valid.
- **`RequestAttributeSnapshot`**: when a client submits a service request
  with category-specific answers, the validated values are frozen as
  plain name/value text at that moment — so the request stays readable
  even after an admin later renames or removes the attribute.
- **Search**: `GET /search/providers?...&attributes[droneAvailable]=true`
  — dynamic filters resolved against the searched category's
  `isFilterable` attributes only; anything else (wrong slug, an attribute
  from an unrelated category) is rejected outright, never silently
  ignored.
- **Frontend**: `DynamicAttributeForm` + one component per type
  (`TextAttribute`, `NumberAttribute`, `PriceAttribute`,
  `BooleanAttribute`, `SelectAttribute`, `MultiSelectAttribute`) generate
  the whole form from `GET /categories/:id/attributes` — adding a brand
  new category with new attributes needs zero frontend code changes, per
  the spec's own core requirement. Used in the provider's "add a service"
  flow (`/provider/offerings/new`), the client's service-request form
  (relevant fields only — never a carpenter's fields on a photography
  request), the public service-offering page, and the admin category/
  attribute manager.
- **Not fully wired up yet**: attribute filter chips on the `/search`
  results page itself (the backend fully supports `attributes[slug]=value`
  query filters; only the results-page UI for picking filter values is
  still a TODO), and the deeper personalization integration from spec
  §22-23 ("learn interest in Drone Photography specifically," attribute-
  aware recommendation scoring) — that would need a persisted
  attribute-level interest dimension alongside the existing category/
  service one, which is a real, scoped addition for a follow-up pass
  rather than something implemented here. Category- and service-level
  personalization (already built in the earlier personalization pass)
  works normally with the new offering model.
- Found and fixed two more real dependency-security issues while working
  on this (same pattern as the Next.js CVE earlier): `multer` 1.x → 2.x
  and `bcrypt` 5.x → 6.x for known transitive vulnerabilities, and
  migrated the deprecated `aws-sdk` v2 to the maintained `@aws-sdk/
  client-s3` v3 (same `StorageService` interface, zero callers changed).

## A note on verification

This codebase was built and verified with `npm install`, a full
`tsc --noEmit` type-check, and `npx jest` inside a sandboxed dev
environment that cannot reach `binaries.prisma.sh` (Prisma's engine
download host is not on its network allow-list). That means `prisma
generate` could not produce a real, schema-aware Prisma Client there —
every type-check/test failure seen during development was a `Module
"@prisma/client" has no exported member 'X'` error (e.g. `BookingStatus`,
`NotificationType`), which is exactly what you'd expect from a generic
placeholder client with no knowledge of this schema. All genuine
implicit-`any` and logic bugs the type-checker caught were fixed and
re-verified in that same environment.

Run this once you have normal internet access, before anything else:

```bash
cd apps/api
npm install
npx prisma generate
npx tsc --noEmit      # should be clean
npx jest               # all suites should pass, including booking-state-machine,
                        # reviews, subscriptions, personalization, category-
                        # attribute validation, and request-assist specs

cd ../web
npm install
npx next build          # should complete cleanly, 32 routes
```

If anything doesn't come up clean after `prisma generate`, it's worth a
second look — but the `@prisma/client` member-not-found pattern above is
the sandbox artifact, not a real bug.

## AI-assisted request writing

Added on top of Phase 15 without touching any existing endpoint contract:

- New `request-assist` module: `POST /request-assist/suggest` (client-only,
  JWT + role guarded, throttled to 8/min given each call can hit a paid
  external API). Takes a `serviceId` and an optional free-text
  `description` and/or `imageKey` (an image already uploaded through the
  existing `/files/upload` endpoint — no new upload path).
- Behind a `RequestAssistProvider` interface, same swappable-backend
  pattern as `MapProvider`/`PaymentProvider`: `AnthropicAssistProvider`
  (real, calls the Anthropic Messages API — text + optional vision) is used
  when `ANTHROPIC_API_KEY` is set, otherwise `MockAssistProvider` (an
  offline keyword-matching heuristic) so local dev, CI, and this sandbox
  stay fully functional without the key.
- The model's raw JSON output is never trusted: every suggested attribute
  value is resolved from slug to id and re-run through the exact same
  `CategoriesService.validateAttributeValue()` a manual form submission
  hits. Anything that fails — wrong type, an option not in the category's
  list, an unknown/foreign slug — is silently dropped rather than
  surfaced as an error, so a bad suggestion never blocks the client from
  filling the form themselves. Suggestions are also capped in size
  (title ≤80 chars, description ≤2000 chars) before being returned.
- Frontend: an `AiRequestAssist` component on `/requests/new` — a
  description box plus an optional photo attach — that pre-fills the
  title, description, and the category's `DynamicAttributeForm` fields.
  It never submits anything itself; the client always sees and can edit
  every field before sending the request, and a suggestion never
  overwrites a field the client already filled in themselves.
- New env var (optional): `ANTHROPIC_API_KEY` in `.env.example`.
- Verification: real `npm install` + `tsc --noEmit` on the backend (clean
  aside from the pre-existing Prisma-generate sandbox artifact), a new
  `request-assist.service.spec.ts` covering the drop-invalid-suggestions
  behavior, and a full `npm install` + `npx next build` on the frontend —
  all 32 routes build clean, including the updated `/requests/new`.

## AI booking assistant (Gemini)

A conversational layer in front of the existing request → quote → booking
flow. Nothing about the booking system itself changed: the assistant only
helps fill the same `/requests/new` form, and the client still reviews,
edits, and presses "Send request" themselves.

- New `booking-assist` module: `POST /booking-assist/suggest` (client-only,
  JWT + role guarded, throttled to 8/min like `request-assist`). Stateless
  per turn — the client sends `message`, the prior `history` (≤10 turns),
  the `serviceId` currently selected in the form (if any), and the
  `filledFields` it has already completed, so follow-up questions are only
  about what is genuinely still missing.
- Multilingual: the client writes in English, Kinyarwanda, or French; the
  reply, the follow-up questions, and the fallback copy all come back in
  that language (`language` is part of the validated response).
- Behind a `BookingAssistProvider` interface (same swappable pattern as
  `MapProvider`/`PaymentProvider`/`RequestAssistProvider`):
  `GeminiBookingAssistProvider` — calls the Gemini `generateContent` API
  over fetch with `responseMimeType: application/json`, the key sent in the
  `x-goog-api-key` header (never in a URL), used when `GEMINI_API_KEY` is
  set — otherwise `MockBookingAssistProvider`, an offline multilingual
  keyword/date/budget extractor, so dev, CI, and tests run with no key.
  Optional `GEMINI_MODEL` overrides the default `gemini-flash-latest`.
- Backend validation of every model turn (`BookingAssistService`):
  the service key may only resolve against the live active catalog
  (`${categorySlug}/${serviceSlug}` keys — the model never sees row ids),
  a service pinned by the form can never be swapped, dates must be real
  days not before today, times must be 24h `HH:MM`, budgets must be
  non-negative and are dropped as a pair when inverted, and attribute
  answers are resolved slug → id and re-run through the same
  `CategoriesService.validateAttributeValue()` a manual submission hits.
  Nothing invalid is ever surfaced — it is counted in `skippedCount` and
  left for the client to fill in by hand. The assistant never invents
  availability or prices: it only re-states what the client said, and the
  prompt explicitly forbids fabrication.
- Missing required fields (service/title/description) always produce
  follow-up questions in the client's language — appended deterministically
  even if the model returned none — plus a "still needed" chip list in the
  UI. The response never submits anything.
- Frontend: a `BookingAssistant` chat panel at the top of `/requests/new`
  that applies extracted fields to the existing form. Fields the client has
  already typed by hand are never overwritten by a later assistant turn,
  every field stays editable, and the existing readiness checklist +
  validation + submit button are the confirmation step. On any API/model
  failure the panel rolls back, hands the text back for retry, and says the
  form can be filled in manually — the form itself is never blocked.
- New env vars (optional, backend-only): `GEMINI_API_KEY` and
  `GEMINI_MODEL` in `.env.example` / `.env`.
- Verification: `tsc --noEmit` (backend + frontend) and `npx next build`
  (all 33 routes clean); `npx jest` — 36 new specs: service-level
  validation (`booking-assist.service.spec.ts`), Gemini response
  parsing/error mapping with a mocked fetch, and multilingual
  `mock-booking-assist.provider.spec.ts` cases for complete English,
  Kinyarwanda, and French booking requests. Also smoke-tested live over
  HTTP against the running API with a demo client account: full and vague
  requests in all three languages (correct `language`, catalog `serviceId`,
  date/time/budget extraction, localized follow-up questions), category
  attribute extraction, `filledFields` suppression, 400 on bad input, 401
  unauthenticated, 403 for a provider role, and 429 over the throttle.
