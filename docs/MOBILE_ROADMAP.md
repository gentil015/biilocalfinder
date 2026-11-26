# BII LocalFinder Mobile — Roadmap (Stage 2)

## Milestones

| Stage | Scope | Exit criteria |
| --- | --- | --- |
| 1. Audit ✅ | Inspect repo, document reuse and gaps | `docs/MOBILE_PROJECT_AUDIT.md` |
| 2. Planning ✅ | PRD, architecture, roadmap | Three docs in `docs/` |
| 3. Foundation ✅ | `apps/mobile`; Expo/TS/Router; theme; API client; auth/session store; TanStack Query; shell layouts; onboarding/login | App launches; typecheck passes; route gate works |
| 4. Customer ✅ | Home, explore/search/filters, provider profile, favorites, requests/quotes/bookings, customer profile/settings | Functional against API; unit tests added for validation/format/routes |
| 5. Provider ✅ | Onboarding, profile/portfolio/areas, offerings CRUD, availability, incoming requests/quotes, analytics, workspace/verification/subscription status | Functional; subscription UI reports unavailable honestly because backend billing is broken |
| 6. Communication ⚠️ | Conversation list/chat, Socket.IO events, notifications center/preferences, deep links, local notification display | Implemented; reconnect/REST fallback coded but not runtime-verified; deep links not smoke-tested |
| 7. Location ⚠️ | Permissions, current/manual location, native map list switch, service-area display, request location | Implemented; device map/permission smoke test still required |
| 8. QA ✅ | Unit tests, typecheck, Expo doctor, Android bundle export | `npm test`, `npm run typecheck`, `npm run doctor`, Android export all pass |
| 9. Delivery ⚠️ | Setup/testing/release docs, known limitations | Audit/PRD/architecture/roadmap complete; device and backend runtime validation remain |

## Implementation order within screens

1. **Foundation:** config, theme, UI kit, API client, auth bootstrap, tab shells with real empty states.
2. **Read-only discovery first:** categories/services, search results, provider profile, favorites — validates API shapes early.
3. **Mutations:** request creation → quote flow → booking status; provider offerings → quotes.
4. **Realtime/notification layer:** only after REST paths work, so chat remains functional without socket.
5. **Location/map:** after search/request DTOs stable.

## Definition of done per feature

- Uses real backend endpoint; no mock/fake data in production code paths.
- Loading, empty, error and retry states present.
- Forms validated; mutations invalidate affected queries.
- Typed; no TypeScript errors; component consumes theme tokens only.
- Unit/integration/component test added for non-trivial logic.
- Documented if backend capability is missing (no silent placeholder).

## Known follow-ups (out of MVP scope)

- Backend: add native push token registration (Expo FCM/APNs) with secure token storage, send path and expiry cleanup; then implement `NativePushTokenService` against it.
- Backend/web: resolve the in-progress subscription code removal (dangling `EntitlementsService` import, stale web API client) before re-enabling subscription UI on any platform.
- Backend: committed migrations do not include all manual SQL objects; production DB provisioning must apply `prisma/manual-sql/*` per `migrations_notes/README.md`.
- Product/legal: Privacy Policy and support channel are missing (`docs/TERMS_IMPLEMENTATION_REVIEW.md`); required before store release.
- Future: Kinyarwanda localization, admin mobile console, map clustering, saved-search push alerts.

## Stage summaries (2026-11-24)

- **Stage 3 — Foundation:** Created `apps/mobile` with Expo Router, theme tokens, UI kit, auth/onboarding screens, token/session persistence, API client, TanStack Query, and role-aware customer/provider shells. Fixed duplicate-route collision by moving provider tabs to `/provider`. `npm run typecheck` passed; initial Android export failed until `babel-preset-expo` was added and React versions aligned.
- **Stage 4 — Customer:** Added discovery/search/filter/map-list UI, provider detail, favorites, request creation with uploads, request/quote/booking flows, notifications, chat, location, and client profile. Added typed API endpoint modules, query hooks, socket client, and local notification handling. Fixed typecheck issues in notifications, client updates, message input, `ScrollView` ref, and optional card handlers.
- **Stage 5 — Provider:** Added provider overview/analytics, offerings CRUD, incoming requests, quote submission, request detail, availability, verification, reviews/responses, workspaces, onboarding, and honest subscription-status messaging. Fixed typecheck issues in profile phone mapping, numeric form values, offering duration type, and duplicate provider types.
- **Stage 6/7 — Communication and location:** Implemented conversation list/chat with Socket.IO plus REST fallback, notification center/preferences, local notifications, current/manual location, map/list search, and provider location/areas. Runtime socket reconnect and device map/permission smoke tests remain.
- **Stage 8 — QA:** Final automated checks passed: `npm run typecheck`, `npm test -- --runInBand` (3 suites, 14 tests), `npm run doctor` (20/20), `npx expo install --check`, and `npx expo export --platform android --output-dir /tmp/opencode/mobile-export`. Earlier failures were network timeouts, missing `babel-preset-expo`, React peer mismatch, outdated Expo dependency versions, removed top-level `splash` config, Jest ESM transform issue, and missing Jest typings; all resolved.
- **Stage 9 — Delivery:** Remaining work is device/backend runtime validation (including new parity endpoints), backend repair for subscriptions and native push, Google Maps key for reliable map tiles, privacy/support links, and release documentation. No provider or rating data is faked.
- **Customer/provider parity pass (2026-11-25):** Audited web flows and added missing mobile customer/provider screens: compare, saved searches, disputes, reports, account/preferences, AI assistant, provider insights, service areas, portfolio, experience, education, and become-provider. Integrated AI draft assistance in request creation, explore AI search/save/compare, quote counter-offers, review photos/dimension ratings, workspace create/rename/invitations, and role guards on shared parity routes. Admin parity remains explicitly out of scope. `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run doctor`, `npx expo install --check`, and Android export all pass.
