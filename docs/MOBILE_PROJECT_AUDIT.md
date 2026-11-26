# BII LocalFinder — Mobile Project Audit (Stage 1)

**Date:** 2026-11-24
**Scope:** Full repository inspection before any mobile code was written. No existing application files were modified during this stage.

---

## 1. Executive summary

The repository already contains a large, mature marketplace platform:

- `apps/api` — NestJS 10 modular monolith, Prisma 5 + PostgreSQL/PostGIS, Redis/BullMQ, Socket.IO, JWT auth + RBAC, 43 controllers / ~224 HTTP routes, 1 WebSocket gateway.
- `apps/web` — Next.js 14 App Router, Tailwind design system, TanStack Query, React Hook Form/Zod, Socket.IO client, Leaflet maps, Web Push.
- `packages/types` — a small, manually synchronized type file (not a built package and not currently imported by either app).
- `infra/docker`, `infra/nginx`, `.github` — single-VPS style deployment configuration.

The mobile application should be a **new `apps/mobile` Expo app** that consumes the existing NestJS API. There is no need for a mobile backend, duplicate database, or duplicate business logic. Nearly every customer and provider feature requested for the mobile app already has a backend endpoint.

Two important pre-existing conditions were found and are **not caused by this work**:

1. The git working tree is dirty with substantial in-progress changes (59 files). Most notably, the subscription/payment modules and web billing pages have been deleted while their Prisma models, seeds, web client types and some service references remain.
2. That in-progress deletion left **a broken import** in `apps/api/src/service-offerings/service-offerings.service.ts:7` (`EntitlementsService` from a deleted file). The API source currently cannot compile as-is. This is documented here, not silently fixed, because it is unrelated pre-existing work.

Native push notifications (Expo push tokens / FCM / APNs) are **not supported by the current backend**. It only registers Web Push (`endpoint`, `p256dh`, `auth`) subscriptions. This is the largest genuine backend gap for mobile; see §8.

---

## 2. Repository layout and conventions

```
bii-localfinder/
  apps/api/         NestJS backend (own package.json + node_modules)
  apps/web/         Next.js frontend (own package.json + node_modules)
  packages/types/   Shared hand-maintained TS unions
  docs/             DEPLOYMENT.md, TRUST_SAFETY.md, WORKSPACES.md, TERMS_IMPLEMENTATION_REVIEW.md
  infra/docker/     Dockerfile(s), docker-compose.prod.yml
  infra/nginx/      nginx.conf (API + /socket.io/ reverse proxy)
  .env.example      Backend/web configuration template
  README.md         848-line product/phase documentation
```

- The root `package.json` is **not** an npm workspace root; it only declares two Neon packages. `apps/api` and `apps/web` are installed/run independently from their own directories.
- Root `.gitignore` ignores `node_modules/`, `dist/`, `.next/`, `**/.env` (templates remain tracked), `.local-storage/`.
- Convention: API source lives in `apps/api/src/<domain>/` with `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, and co-located `*.spec.ts`. Global prefix is `/api`.
- No lint/typecheck command exists at the root. Each app has its own scripts (`apps/api/package.json`, `apps/web/package.json`).

---

## 3. Backend architecture (reusable as-is)

### 3.1 Bootstrap and cross-cutting behavior

| Concern | Implementation |
| --- | --- |
| Global prefix | `app.setGlobalPrefix('api')` — `apps/api/src/main.ts:70` |
| Validation | Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — `main.ts:66-69` |
| Security | `helmet()`, `CORS_ORIGIN` allow-list (optional `ALLOW_VERCEL_PREVIEWS`), `credentials: true`, `trust proxy = 1` — `main.ts:34-62` |
| Rate limiting | `ThrottlerGuard` globally, default 100/min — `app.module.ts:62,118-120`; many routes add stricter `@Throttle` |
| CSRF | `CsrfGuard` applies to unsafe methods; **Bearer-token clients are explicitly exempt** (`apps/api/src/auth/guards/csrf.guard.ts:24-39`). Cookie clients must send `x-csrf-token`. |
| Workspace scope | `WorkspaceContextInterceptor` + `@RequireWorkspacePermission(...)` / `@WorkspaceScoped()`; clients with >1 active workspace send `x-workspace-id` (`app.module.ts:120`, `common/workspace/workspace-context.interceptor.ts:18,38-84`) |
| Swagger | `/api/docs` outside production (`main.ts:80`) |
| Health | `GET /api/health` (`common/health.controller.ts:8`) |
| Errors | Standard Nest JSON error shape `{ statusCode, message, error }`; validation errors return an array of messages |
| Uploads | Image `POST /api/files/upload` (JPEG/PNG/WEBP, ≤8 MB), video `POST /api/files/upload-video` (MP4/WEBM/MOV, ≤100 MB) — `files/files.controller.ts:30-59`; storage driver S3 or local |

### 3.2 Authentication (`apps/api/src/auth/`)

- `POST /api/auth/register` — `RegisterDto`: `email`, `password` (min 8), `firstName`, `lastName`, `role` (`CLIENT` | `PROVIDER`), `termsAccepted: true`, `termsVersion: '1.0'`, optional `phone`.
- `POST /api/auth/login` — `{ email, password }`.
- `POST /api/auth/refresh` — `{ refreshToken }` or `bii_refresh` cookie; rotating refresh tokens are stored hashed.
- `POST /api/auth/logout` — requires Bearer/cookie + `refreshToken`; revokes token.
- `GET /api/auth/csrf` — `{ csrfToken }` (not needed by Bearer clients).
- `POST /api/auth/password-reset/request` — `{ email }`; deliberately enumeration-safe.
- `POST /api/auth/password-reset/confirm` — `{ token, newPassword }`.
- Response of register/login/refresh: `{ accessToken, refreshToken, csrfToken }` (`auth.controller.ts:101-111`). Cookies (`bii_access`, `bii_refresh`, `bii_csrf`) are also set for the web app.
- Access token TTL 15 min / refresh 30 days (cookie max ages in `auth/session-cookies.ts:11-13`; JWT secrets `JWT_SECRET`, `JWT_REFRESH_SECRET`).
- `JwtAuthGuard` accepts `Authorization: Bearer …` **or** the `bii_access` cookie, and rejects suspended/deactivated users (`auth/strategies/jwt.strategy.ts:18-54`).
- Roles: `CLIENT`, `PROVIDER`, `ADMIN` (`Prisma UserRole`); workspace roles `OWNER`, `MANAGER`, `MEMBER` with permission strings in `workspaces/workspace-permissions.ts:3-70`.
- Contact OTP: `POST /api/verification/contact/request` `{ channel: 'EMAIL'|'PHONE' }`, `POST /api/verification/contact/confirm` `{ channel, code }` (6 digits). Email verification is also issued during registration flows; phone verification is supported via this OTP channel.
- Provider application route for role upgrade: `POST /api/provider-applications` (admin approves and upgrades role).

**Mobile decision:** use Bearer tokens stored in `expo-secure-store`; no cookies, no CSRF header; send `x-workspace-id` when the account has multiple provider workspaces.

### 3.3 Endpoint inventory (all prefixed `/api`)

Public / optionally authenticated discovery:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/categories`, `/categories/:id/attributes` | Category tree (`?flat=true`) and public attributes |
| GET | `/services`, `/services/:id` | Service taxonomy |
| GET | `/locations/search?q=` | Geocoding-style location picker suggestions |
| GET | `/search/providers` | Main discovery endpoint; see filters below |
| GET | `/providers/:id` | Public profile (`OptionalJwtAuthGuard`); `?lat=&lng=` adds distance/area coverage |
| GET | `/providers/compare?ids=` | Side-by-side comparison |
| GET | `/providers/:id/reviews`, `/providers/:id/reviews/summary` | Public reviews |
| GET | `/providers/:id/availability` | Public availability summary |
| GET | `/service-offerings/:id` | Public offering detail |
| GET | `/notifications/push-public-key` | VAPID public key (web push only) |
| GET | `/workspace-invitations/:token` | Invitation preview |
| POST | `/search-assist/parse`, `/customer-assist/chat` | AI assist (public/guest-capable, throttled) |

`GET /api/search/providers` query parameters (`search/dto/search-providers.dto.ts`): `q`, `serviceId`, `categoryId`, `lat`, `lng`, `radiusKm` (1–200, default 15), `minRating` (0–5), `minPrice`, `maxPrice`, `minExperience`, `availableNow`, `verifiedOnly`, `sort` (`recommended|nearest|highest_rated|lowest_price|most_experienced|available_now`), `attributes[slug]=value`, `page` (default 1), `limit` (1–50, default 20). Response: `{ items, total, page, limit }`; each item has `id`, `businessName`, `avatarUrl`, `rating`, `reviewCount`, `verifiedReviewCount`, `verificationStatus`, `availabilityStatus`, `yearsOfExperience`, `distanceKm`, `servesArea`, `startingPrice`, `currency`, `latitude`, `longitude`, plus `availability` (`paused`, `availableToday`, `availableTomorrow`, `nextAvailableDate`, `nextAvailableLabel`). This matches the web client's `ProviderSearchResponse` in `apps/web/lib/api.ts:285-336`.

Authenticated customer (`CLIENT`):

| Method | Path | Notes |
| --- | --- | --- |
| GET/PATCH/DELETE | `/users/me` | Account details, update, anonymising deletion (password required) |
| GET | `/users/me/export` | Data export |
| PATCH | `/users/me/locale` | BCP-47 locale (`en` supported; architecture ready for `rw`) |
| GET/PATCH | `/clients/me` | Client profile (`bio`) |
| POST | `/service-requests` | Create request (fields below) |
| GET | `/service-requests/mine` | Own requests |
| GET | `/service-requests/:id` | Detail (workspace-scoped) |
| PATCH | `/service-requests/:id/privacy` | Toggle `isPublic` |
| DELETE | `/service-requests/:id` | Cancel |
| GET | `/service-requests/:requestId/quotes` | Quotes for own request |
| POST | `/quotes/:id/accept`, `/quotes/:id/reject` | Quote decisions |
| POST | `/quotes/:id/revisions`, `/quote-revisions/:id/accept|reject` | Negotiation |
| GET | `/bookings/mine`, `/bookings/:id` | Bookings |
| PATCH | `/bookings/:id/status` | Allowed transition only (`BookingStateMachine`) |
| POST | `/bookings/:id/reviews` | Review after completed booking |
| POST | `/reviews/photos`, `/conversations/:id/attachments` | Uploads |
| GET/POST/DELETE | `/favorites`, `/favorites/:providerId` | Saved providers |
| GET/POST/DELETE | `/saved-searches`, `/saved-searches/:id` | Saved searches |
| GET/PATCH | `/personalization/home`, `/personalization/providers`, `/personalization/services`, `/personalization/interests`, `/personalization/preferences` | Recommendations, home sections, preferences |
| POST | `/personalization/interactions` | Record view/search/favorite interactions |
| GET/PATCH | `/notifications`, `/notifications/:id/read`, `/notifications/read-all`, `/notifications/preferences` | Notification center |
| GET | `/conversations`, `/conversations/:id`, `/conversations/:id/messages` | Messaging REST |
| POST | `/conversations`, `/conversations/:id/messages`, `/conversations/:id/read` | Start/send/mark-read |
| POST | `/booking-assist/suggest`, `/request-assist/suggest` | AI drafting (CLIENT) |
| GET/POST | `/reports`, `/disputes`, `/trust/…` | Safety, reports, disputes, appeals |

Authenticated provider (workspace permissions enforced server-side):

| Method | Path | Permission |
| --- | --- | --- |
| GET/PATCH | `/providers/me/profile` | `workspace.profile.manage` |
| PATCH | `/providers/me/location`; POST/DELETE `/providers/me/service-areas/:id` | `workspace.profile.manage` |
| GET/PATCH/POST | `/providers/me/onboarding[/type|/profile|/complete]` | `workspace.profile.manage` |
| GET/POST/DELETE | `/providers/me/onboarding/team-members[/:id]` | `workspace.profile.manage` |
| GET/POST | `/providers/me/experience`, `/providers/me/education` (+ PATCH/DELETE `:id`) | `workspace.profile.manage` |
| GET/POST/PATCH/DELETE | `/providers/me/portfolios[/:id]` | `catalog.manage` |
| POST/DELETE | `/providers/me/portfolios/:id/images`, `/providers/me/portfolios/images/:imageId` | `catalog.manage` |
| GET/POST/PATCH/DELETE | `/provider/service-offerings[/:id]` | `catalog.manage` |
| GET/PUT/POST/DELETE | `/provider/availability`, `/provider/availability/weekly`, `/status`, `/exceptions[/:id]` | `availability.manage` |
| GET | `/service-requests/incoming` | `requests.view` |
| POST | `/quotes`, `/quotes/attachments`, `/quotes/:id/revisions` | `quotes.manage` |
| GET | `/bookings/provider/mine` | `bookings.view` |
| POST | `/provider/verification`, `/provider/verification/documents` | `verification.manage` |
| GET/PATCH | `/personalization/provider-insights`, `/personalization/provider-analytics` | `analytics.view` |
| GET/POST/PATCH/DELETE | `/workspaces[/:workspaceId]`, members, invitations, assignments, audit | OWNER/MANAGER/MEMBER rules |

Admin (mobile defers to the existing web dashboard): `/admin/dashboard`, `/admin/business`, `/admin/users[/:id]`, `/admin/providers/:id`, `/admin/verifications`, `/admin/reviews`, `/admin/provider-applications`, `/trust/admin/*`, `/personalization/admin/ranking-weights`.

### 3.4 Real-time (`apps/api/src/messaging/messaging.gateway.ts`)

- One Socket.IO gateway. Handshake auth: `handshake.auth.token` **or** `bii_access` cookie, verified with `JWT_SECRET`; unauthenticated sockets are disconnected.
- Rooms: `user:<userId>`, `conversation:<conversationId>` (`socket-server-registry.service.ts:22-28`).
- Client → server events: `conversation:join` (`{ conversationId }`), `typing` (`{ conversationId, isTyping }`), `message:send` (`{ conversationId, body?, attachments?: [{ storageKey }] }` with ack).
- Server → client events: `message:new`, `conversation:updated`, `typing`, `presence:update`, `notification:new` (the last emitted from `notifications/notifications.processor.ts:48` to `user:<id>`, only when in-app preference is enabled).
- REST fallback exists for sending messages, so the mobile app can still function when the socket is down; delivery is only confirmed by the server response/ack, never by optimistic local state.

### 3.5 Notifications and jobs

- `NotificationType` has 28 values (quotes, bookings, messages, verification, reviews, disputes, trust, subscription, discovery).
- Categories: `QUOTES`, `MESSAGES`, `BOOKINGS`, `REVIEWS`, `TRUST`, `SUBSCRIPTION`, `DISCOVERY`; defaults `{ inApp: true, push: true, email: false }` (`notifications/notification-categories.ts:49-54`).
- Preferences are per category `PATCH /notifications/preferences` `{ category, inApp, push, email }`.
- Deep links already exist for `NEW_MESSAGE` (conversationId), `NEW_SERVICE_REQUEST` (requestId), booking lifecycle (bookingId) in `notifications/notification-links.ts:24-51`.
- BullMQ processor gates in-app/push/email independently; stale Web Push subscriptions (404/410) are deleted (`notifications.processor.ts:34-98`, `channels/push-sender.ts:50-66`).

### 3.6 Storage and media

- `POST /api/files/upload` and `/api/files/upload-video` are authenticated; returned URL/storageKey are used in DTOs for provider logos, portfolios, request images, quote attachments, message attachments and review photos.
- S3 driver: public + separate private bucket, sanitized UUID keys, no ACL header (`files/s3-storage.service.ts:21-140`). Local driver: HMAC-signed private URLs with default 300 s TTL (`files/local-storage.service.ts:36-179`).
- Verification documents and dispute evidence are **private** and must be accessed through signed URLs; never embedded in public profile payloads.
- Image compression helper in the web app (`apps/web/lib/image-compression.ts`) is browser-only; mobile needs its own resizing step before upload.

---

## 4. Data model summary (`apps/api/prisma/schema.prisma`, 2,133 lines)

### 4.1 Key enums (exact values)

- `UserRole`: `CLIENT`, `PROVIDER`, `ADMIN`
- `UserStatus`: `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `PENDING_VERIFICATION`
- `ProviderType`: `INDIVIDUAL`, `TEAM`, `BUSINESS`, `AGENCY`
- `VerificationStatus`: `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`, `EXPIRED`
- `AvailabilityStatus`: `AVAILABLE`, `BUSY`, `UNAVAILABLE`
- `ServiceRequestStatus`: `OPEN`, `QUOTED`, `NEGOTIATING`, `ACCEPTED`, `BOOKED`, `CANCELLED`, `EXPIRED`
- `QuoteStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`
- `RevisionStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`; `RevisionProposedBy`: `CLIENT`, `PROVIDER`
- `BookingStatus`: `REQUESTED`, `QUOTED`, `NEGOTIATING`, `ACCEPTED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `ReviewStatus`: `PUBLISHED`, `HIDDEN`
- `OfferingPriceType`: `FIXED`, `HOURLY`, `PER_DAY`, `STARTING_FROM`, `CUSTOM_QUOTE`
- `NotificationType`: 28 values including `NEW_SERVICE_REQUEST`, `NEW_MESSAGE`, `NEW_QUOTE`, `QUOTE_ACCEPTED`, `BOOKING_CREATED`, `BOOKING_COMPLETED`, `VERIFICATION_UPDATED`, `NEW_PROVIDER_MATCH`, dispute/trust events
- `NotificationCategory`: `QUOTES`, `MESSAGES`, `BOOKINGS`, `REVIEWS`, `TRUST`, `SUBSCRIPTION`, `DISCOVERY`
- Workspace: `WorkspaceMemberRole` `OWNER|MANAGER|MEMBER`, `WorkspaceMemberStatus` `INVITED|ACTIVE|REMOVED`, `WorkspaceStatus` `ACTIVE|SUSPENDED|CLOSED`
- Subscription (schema only; see §8): `SubscriptionStatus` `ACTIVE|EXPIRED|CANCELLED|PAST_DUE|TRIALING`, `BillingInterval` `MONTHLY|YEARLY`, `PaymentStatus` `PENDING|SUCCEEDED|FAILED|REFUNDED`

The prompt's example statuses (`Pending`, `Accepted`, `In progress`, etc.) map to these enums; the mobile app must use the **backend values above**, not new strings.

### 4.2 Core models

- `User` (`:397-465`): `email`, `phone?`, `passwordHash`, `firstName`, `lastName`, `avatarUrl?`, `role`, `status`, `emailVerified`, `phoneVerified`, `locale` (default `en`). A user can own **multiple** providers (`providers[]`, `:427`); resolve with `ProviderContextService`.
- `Provider` (`:611-709`): `businessName`, `description?`, `bio?`, `phone?`, `logoUrl?`, `providerType?`, `onboardingStep`, `verificationStatus`, `identityVerified`, `businessVerified`, `rating` (Decimal), `reviewCount`, `verifiedReviewCount`, `responseRate`, `responseTimeMinutes?`, `availabilityStatus`, `serviceRadiusKm`, `workspaceId` (unique).
- `ClientProfile` (`:515-529`): `bio?`.
- `Workspace` / `WorkspaceMembership` / `WorkspaceInvitation` (`:817-918`): provider teams and permissions.
- `ServiceCategory` (`:954-971`) self-hierarchical (`parentId`), `Service` (`:973-991`), `ServiceOffering` (`:1000-1023`): `title?`, `description?`, `basePrice?`, `priceType`, `duration?`, `currency` (default `RWF`), `isActive`.
- `ServiceArea` (`:939-952`): `label`, `latitude`, `longitude`, `radiusKm`; `Location` (`:920-937`): `label?`, `addressLine?`, `city?`, `country?` (default Rwanda), `latitude`, `longitude`.
- `Availability` (`:1167-1180`): one row per weekday (`0=Sunday…6=Saturday`), `startTime`/`endTime` strings `"HH:MM"`, `isActive`; `AvailabilityException` (`:1186-1199`): `date`, `isAvailable`, `note?`.
- `Portfolio` / `PortfolioImage` (`:1114-1163`), `ProviderExperience` / `ProviderEducation` (`:750-793`).
- `ServiceRequest` (`:1203-1247`): `clientId`, `providerId?`, `isPublic`, `serviceId`, `serviceOfferingId?`, `locationId?`, `title`, `description`, `preferredDate?`, `preferredTime?`, `budgetMin/Max?`, `status`, `images[]`, `attributeSnapshots[]`; `serviceOfferingId` pins provider+service; `providerId=null` means broadcast.
- `Quote` (`:1287-1316`), `QuoteRevision` (`:1336-1349`), `QuoteAttachment` (`:1321-1334`), `Booking` (`:1416-1453`) with `agreedPrice`, `scheduledAt?`, `paymentArrangementNote` ("payment handled directly between you and the provider"), `BookingStatusHistory`.
- `Conversation` / `ConversationParticipant` (`:1353-1380`) with `lastReadAt?`; `Message` (`:1382-1397`) with `body?`, `readAt?`; `MessageAttachment` (`:1399-1412`).
- `Review` (`:1471-1512`): `rating`, sub-ratings, `comment?`, `verifiedBooking`, `status`, `providerResponse?`; images in `ReviewImage`.
- `Favorite` (`:1528-1540`), `SavedSearch` (`:1585-1605`), `Notification` (`:1607-1622`), `NotificationPreference` (`:1550-1562`), `PushSubscription` (`:1566-1579`).
- `VerificationRecord` / `VerificationDocument` (`:1721-1770`) — provider-level types only `IDENTITY` and `BUSINESS` (`SERVICE` exists in enum but is offering-level by convention).
- Trust/safety models: `SecurityEvent`, `RiskAssessment`, `FraudReport`, `AccountRestriction`, `Appeal`, `Report`, `Dispute` (`:1630-1955`).

No soft-delete fields exist anywhere; visibility uses `isActive`, `isPublic`, `status`, `onboardingStep`, verification flags and restriction records.

### 4.3 Geography

Prisma exposes `latitude`/`longitude`; PostGIS columns are added manually in `apps/api/prisma/manual-sql/001_add_postgis.sql`: `geom geography(Point,4326)` on `locations` and `service_areas`, sync triggers, backfill and **GiST** indexes. The search service uses `ST_DWithin`/`ST_Distance` with a default 15 km radius (`search/postgres-provider-search.service.ts:318-357`). Availability summaries are attached by the controller. Public profiles round coordinates to ~2 decimals (≈1 km) and omit exact address/phone; contact details unlock only after an accepted booking (`providers.service.ts:140-168`).

---

## 5. Existing business rules the mobile app must respect

- **Service requests:** `serviceOfferingId` pins one provider + offering; omitted `providerId` = broadcast (always public), direct requests are private unless `isPublic=true`. Creating a direct request creates a conversation and notifies the pinned provider; public/broadcast requests trigger provider matching. Cancelling rejects pending quotes and notifies providers (`service-requests/service-requests.service.ts:77-437`).
- **Quotes:** attachments must live under `quote-attachments/<providerId>/` and exist in storage; the first quoting provider claims a broadcast; the pinned provider is never reassigned; revisions require `PENDING` quote/request and cannot be accepted/rejected by the proposer. Accepting a quote rejects other quotes, creates a `BOOKED` request + `ACCEPTED` booking and records status history (`quotes/quotes.service.ts:48-529`).
- **Bookings:** transitions are validated by `BookingStateMachine` and written to `BookingStatusHistory`; counterpart is notified; personalization interactions recorded (`bookings/bookings.service.ts:37-207`).
- **Reviews:** only the client on a `COMPLETED` booking, within the review window, one per booking. Hidden reviews are excluded from public aggregates (`reviews/reviews.service.ts:41-190`).
- **Verification:** admin-controlled; approvals expire prior records; suspension hides provider from search; reinstatement only applies to suspended records (`verification/verification.service.ts:137-526`). The app must display the server-provided status and never self-verify.
- **Search/ranking:** rule-based ranking behind `ProviderSearchService`; PostGIS radius + full-text search; personalization re-ranks results (`personalization/recommendation/recommendation.service.ts:29-260`).
- **Payments:** the platform does **not** process client→provider payments; `Booking.paymentArrangementNote` states this explicitly. Provider subscriptions were the only billing surface (see §8).

---

## 6. Web application (UX reference, not reusable code directly)

- Next.js 14 App Router with ~68 `page.tsx` files. Flows already implemented: login/register, onboarding, provider workspace, service offerings, requests/quotes/bookings, messaging, favorites, reviews, verification, disputes/reports, notification center, compare providers, admin, AI assistants.
- `apps/web/lib/api.ts:179-277` shows the client conventions: `${API_URL}/api${path}`, `credentials: 'include'`, `cache: 'no-store'`, CSRF header for cookie writes, `x-workspace-id` for provider calls, 401 single-flight refresh + replay, 413 friendly error, empty body → `null`. Mobile mirrors these with Bearer tokens instead of cookies.
- Web stores only session *hints* in `localStorage` (`bii_session`, `bii_csrf`, workspace id/role, `lib/api.ts:60-145`); tokens stay in HttpOnly cookies. Mobile must use `expo-secure-store` instead.
- Design system: `apps/web/tailwind.config.ts` documents "forest green + warm ivory", hairline borders over shadows, one accent, warm neutral ramp, dark mode via CSS variables. Mobile will adopt the same philosophy with the palette specified in the mobile brief (`#174D38` primary, `#F6F1E7` ivory, `#D8A64E` gold accent), documenting the small brand-green difference from web's `#166534`.
- Browser-only code that **must not** be reused in React Native: `components/leaflet-map.tsx`, `lib/image-compression.ts` (canvas), `lib/socket.ts` (browser cookie pattern), `PushManager`/VAPID subscription code, `localStorage`/cookie session code.

---

## 7. Configuration and infrastructure

- Env names (no values): `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `PASSWORD_RESET_PEPPER`, `PASSWORD_RESET_EXPIRES_MINUTES`, `CORS_ORIGIN`, `WEB_URL`, `API_PUBLIC_URL`, `NODE_ENV`, `PORT`/`API_PORT`/`WEB_PORT`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `ALLOW_VERCEL_PREVIEWS`, `STORAGE_DRIVER`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_PRIVATE_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE`, `LOCAL_STORAGE_DIR`, `LOCAL_STORAGE_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`, SMTP/WAAPI/AI provider keys, Sentry/OTEL, map provider settings, retention settings, `NEXT_PUBLIC_API_URL`.
- Mobile app only needs **public** config: `EXPO_PUBLIC_API_URL` (default dev `http://localhost:4000`, production `https://api.biilocalfinder.com` from web's convention) and `EXPO_PUBLIC_SOCKET_URL` (defaults to API origin). No backend secret may be exposed via `EXPO_PUBLIC_*`.
- `infra/nginx/nginx.conf` proxies `/api/` and `/socket.io/` with WebSocket upgrade headers, so production Socket.IO works through the same domain as the API.
- `docs/DEPLOYMENT.md` describes single-VPS Docker deployment; `docs/WORKSPACES.md`, `docs/TRUST_SAFETY.md`, `docs/TERMS_IMPLEMENTATION_REVIEW.md` document provider teams, trust model and terms gaps (no privacy policy yet, Terms v1.0 not legally approved).

---

## 8. Gaps, risks and compatibility issues

| # | Finding | Impact on mobile | Decision |
| --- | --- | --- | --- |
| 1 | Working tree already has 59 modified/deleted files; subscription module, payment adapters and billing pages are deleted | Repo state is not HEAD; must not overwrite | Preserve all changes; document; no reset or commit |
| 2 | `service-offerings.service.ts:7` imports deleted `EntitlementsService`; DI still expects it | API source does not compile in current tree | Pre-existing bug; do not silently fix. Mobile subscription UI will show an honest "not available" state |
| 3 | No native push-token endpoint; only Web Push `PushSubscription` (`endpoint`, `p256dh`, `auth`) | Expo/FCM/APNs tokens cannot be registered; server cannot send native push | Implement in-app/socket notifications + local notification display now; design smallest compatible backend extension (native token model + Expopush sender) as a separately documented follow-up, not a fake client-side success |
| 4 | Backend has no mobile-app version/config, no device-token invalidation endpoint for Expo tokens | Need client-side token lifecycle | Store token locally, unregister on logout where possible, tolerate 404/410-like responses |
| 5 | No dedicated "recently viewed" endpoint; personalization `interactions` + `/personalization/home` exist | Home can show real recently-viewed sections only if backend returns them | Use `/personalization/home` payload; never synthesize providers/ratings |
| 6 | Provider `userId` is not unique; multiple providers per user | Role switching needs provider context | Call `/workspaces` and send `x-workspace-id`; use `/providers/me/profile` for active context |
| 7 | Manual SQL objects (PostGIS geom, pgvector, provider applications, `isPublic`, assignments, invitation tables) are not in committed migrations | Fresh DB deployments can miss capabilities | Document; mobile depends on running API, not on DB state |
| 8 | Availability times are plain `"HH:MM"` strings with no timezone; most timestamps are `TIMESTAMP(3)` | Avoid local timezone assumptions | Display server values; format dates consistently (ISO where provided) |
| 9 | Read receipts are per-conversation `lastReadAt`/message `readAt` only; no delivery receipts or voice notes (voice feature removed in commit `e2310fc`) | Don't promise per-message "delivered" | Show timestamps and read state only where the API provides it |
| 10 | Web route counts in README are stale (32 vs 33 vs 68 pages) | Documentation, not runtime | Treat filesystem as source of truth |
| 11 | Expo 58 / RN 0.88 / React 19.3 must be installed as a fresh package with versions pinned to Expo's bundled native modules | Incompatible packages risk broken builds | Use versions from `expo@58.0.26` `bundledNativeModules.json`; no unvetted packages |

---

## 9. Reusable inventory (do not reimplement)

- All authentication, token rotation, verification, RBAC, throttling and workspace permissions.
- Provider search (PostGIS + ranking), categories/services taxonomies, personalized home.
- Provider profiles, portfolios, experience/education, availability, verification.
- Service requests → quotes → revisions → bookings → reviews lifecycle.
- Conversations + Socket.IO gateway + notification center/preferences/deep links.
- Favorites, saved searches, reports/disputes/trust appeals.
- File upload/S3 storage, signed private URLs.
- Design language and route/flow semantics from `apps/web`.

---

## 10. Stage 1 conclusion

The mobile application can be built entirely against the existing API, with Bearer auth in SecureStore and workspace-aware requests. No backend rewrite, database duplication, or fake data is required. The only material feature gap is **native push registration**, which will be handled honestly (in-app + socket notifications, documented backend extension path) rather than simulated. The pre-existing subscription-module deletion and broken import are documented as out-of-scope blockers for subscription functionality.

**Next stage:** write `docs/MOBILE_PRD.md`, `docs/MOBILE_ARCHITECTURE.md` and `docs/MOBILE_ROADMAP.md`, then create the `apps/mobile` foundation.
