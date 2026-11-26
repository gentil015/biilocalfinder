# BII LocalFinder Mobile — Product Requirements Document (Stage 2)

**Status:** Approved for implementation scope (MVP + architecture-ready extensions)
**Date:** 2026-11-24

## 1. Product definition

BII LocalFinder is a two-sided local professional services marketplace. The mobile app is one application for Android and iOS serving customers (`CLIENT`) and service providers (`PROVIDER`). Administrators keep using the existing Next.js web dashboard.

Mission: *Connect people with trusted professionals and make finding, hiring, and managing local services easier.*

Initial market: Rwanda (currency `RWF`, country default `Rwanda`, English first, Kinyarwanda-ready). Future: international.

## 2. Objectives and success criteria

| Objective | MVP criterion |
| --- | --- |
| Trusted discovery | Real providers from `GET /api/search/providers`; no fabricated listings or ratings |
| Role-aware experience | One app, bottom tabs change according to server-provided role(s) |
| Efficient requests | Customer can create a service request with category, provider, date, budget, location and images; provider can quote/accept/reject |
| Reliable communication | Conversation list + chat with Socket.IO and REST fallback, reconnect handling |
| Provider operations | Provider can manage profile, offerings, availability and incoming requests |
| Security | Tokens in `expo-secure-store`, HTTPS in production, server-side authorization never bypassed |
| Performance | Virtualized lists, paginated queries, cached images, skeletons, error/retry states |
| Maintainability | Feature-based modules, typed API layer, tests and documentation |

Non-goals for MVP: mobile admin console, client↔provider payments (backend does not support them), provider subscription purchase flows (backend subscription code is currently removed in the working tree), offline marketplace operations, voice notes (removed from platform), full offline map tiles.

## 3. User roles and permissions

- `CLIENT`: discover, favorite, request, quote-decide, book, review, message, manage own profile/notifications.
- `PROVIDER`: everything a client can do **where the backend allows**, plus provider profile, offerings, availability, quotes, bookings, verification, analytics. Provider operations are workspace-scoped. Workspace roles `OWNER`, `MANAGER`, `MEMBER` map to server-enforced permission strings; UI hides actions the user cannot perform but the server remains authoritative.
- `ADMIN`: web dashboard only. If an admin signs into the app, they see a clear web-dashboard redirect message; no admin mobile features in MVP.
- Multi-role: a user may have `CLIENT` and `PROVIDER` role; the app offers an explicit experience switcher. Multiple provider workspaces are handled by an active-workspace selector sending `x-workspace-id`.

## 4. Screen inventory

### 4.1 First launch / auth
| Screen | Route | Key behavior |
| --- | --- | --- |
| Welcome / onboarding | `/(onboarding)` | 3–4 slides: discover, request, communicate; sign in / create account; no permission prompts |
| Login | `/(auth)/login` | Email + password, validation, error states |
| Register | `/(auth)/register` | CLIENT/PROVIDER role choice, terms acceptance v1.0, optional phone |
| Password reset | `/(auth)/forgot-password`, `/(auth)/reset-password` | Request code, confirm token + new password |
| Contact verification | `/(auth)/verify-contact` | Email/phone OTP where required |
| Provider application | `/profile/provider-application` | Submit application when client wants provider role |

### 4.2 Customer tabs — `app/(customer)/(tabs)/`
1. **Home** — greeting, location selector, search entry, popular categories, featured/recommended providers, recently viewed, availability aware.
2. **Explore** — category browser, search, filters (location/radius, category, price, rating, verified, availability, sort), paginated results, map/list toggle.
3. **Requests** — service requests, status sections, request detail, quotes, negotiation, booking status timeline.
4. **Messages** — conversation list, chat, attachments, typing/presence where supported.
5. **Profile** — personal data, favorites, saved searches, notifications, preferences (incl. locales), privacy settings, logout.

Nested: `/provider/[id]`, `/provider/[id]/reviews`, `/request/new`, `/request/[id]`, `/quote/[id]`, `/booking/[id]`, `/messages/[id]`, `/notifications`, `/favorites`, `/saved-searches`, `/settings/*`, `/location/select`, `/map/providers`.

### 4.3 Provider tabs — `app/(provider)/(tabs)/`
1. **Overview** — real metrics from personalization analytics/insights, active offerings, requests, subscription status (honest state).
2. **Services** — offerings CRUD, images via `/files/upload`, category attributes, visibility.
3. **Requests** — incoming requests, quotes, revisions, booking status updates.
4. **Messages** — same chat system as customer, scoped to provider conversations.
5. **Profile** — provider profile, portfolio, experience/education, service areas, availability, verification, workspace settings, subscription status.

Nested: `/provider/profile/edit`, `/provider/service/new`, `/provider/service/[id]`, `/provider/request/[id]`, `/provider/verification`, `/provider/availability`, `/provider/portfolio/*`, `/provider/workspace/*`, `/provider/analytics`.

## 5. Functional requirements by area

### 5.1 Onboarding and permissions
- First launch shows welcome slides; no location/notification permission until the user uses a feature that needs it, with a clear pre-permission explanation sheet.
- Persist onboarding completion locally (non-sensitive) after user finishes or chooses to sign in.

### 5.2 Authentication
- Use `POST /auth/register|login|refresh|logout`, password reset endpoints, `/verification/contact/*`.
- Store `accessToken`/`refreshToken` in SecureStore; never in AsyncStorage, logs or error reports.
- Attach `Authorization: Bearer <accessToken>` to every protected request; refresh once with single-flight semantics on 401 and replay; on refresh failure clear session and route to login.
- Derive role from `GET /users/me` (server source of truth) plus `/workspaces` for provider context; never trust a role stored only on device for authorization decisions.
- Logout revokes the refresh token server-side and clears all local caches/query state.

### 5.3 Discovery and provider profiles
- Search using exact backend query params and pagination (see audit §3.3). Category tree from `/categories`; services from `/services`.
- Provider profile from `/providers/:id` with `?lat=&lng=` when location is known; display only fields the API returns. Contact details only via `/providers/:id/contact` after an accepted booking.
- Record `/personalization/interactions` for meaningful views/searches/favorites to improve real recommendations.
- Favorites via `/favorites`; saved searches via `/saved-searches`.
- Empty states must distinguish "no results for these filters", "location permission denied", and "network error".

### 5.4 Service requests, quotes, bookings
- Create request DTO exactly as backend requires (`serviceId` required; `preferredDate` YYYY-MM-DD required; optional `providerId`, `serviceOfferingId`, `isPublic`, `preferredTime`, budgets, notes, `attributeValues`, `locationId`, `images` storage keys).
- Upload request images with `/files/upload` before submitting; send returned storage keys/URLs.
- Show backend statuses (`OPEN`, `QUOTED`, `NEGOTIATING`, `ACCEPTED`, `BOOKED`, `CANCELLED`, `EXPIRED`) and quote/booking statuses verbatim with human-readable labels.
- Provider creates quotes with `/quotes`, revisions with `/quotes/:id/revisions`; client accepts/rejects. Booking transitions use `/bookings/:id/status` with backend-allowed values only.
- Reviews only where `/bookings/:id/review` reports `canReview`.

### 5.5 Messaging and notifications
- REST conversation list/history plus Socket.IO for `message:new`, `conversation:updated`, `typing`, `presence:update`, `notification:new`.
- Send via socket with REST fallback; only mark as sent after ack/response; show read state from `readAt`/`lastReadAt` only.
- Notification center from `/notifications` with preferences; deep-link from `data.conversationId`, `requestId`, `bookingId`.
- Expo Notifications: ask permission with context, obtain push token, display locally received notifications. **Backend native token registration is not available** (Web Push only); the app must not claim remote registration succeeded. The architecture includes a provider interface so a native-token endpoint can be added later without UI rewrites.

### 5.6 Location and maps
- `expo-location`: request "while in use" permission only when user chooses "use my location"; manual selection via `/locations/search`; store a chosen location locally for discovery defaults.
- Provider service areas and nearby providers shown on a native map (`react-native-maps`) with list/map switch; no continuous background tracking.
- For service requests, allow manual location selection or current location; send `locationId` when the API provides one from the location flow.

### 5.7 Provider operations
- Onboarding through `/providers/me/onboarding/*` steps; verification status displayed from server only.
- Offerings via `/provider/service-offerings`; portfolio via `/providers/me/portfolios`; availability via `/provider/availability/*`; metrics via `/personalization/provider-insights` and `/provider-analytics`.
- Subscription screen: shows current status returned by provider payload; if no subscription API exists, state "Subscriptions are not available in the app yet" and link to web dashboard. No simulated payments or success states.

### 5.8 Internationalization and accessibility
- English strings centralized; locale can be set with `/users/me/locale`; structure ready for Kinyarwanda string bundles.
- Minimum 4.5:1 contrast for body text, dynamic type scaling, visible focus/pressed states, labelled icon buttons.

## 6. Non-functional requirements

- **Security:** HTTPS-only production API, no secrets in bundle, no sensitive logs, SecureStore, input validation with Zod, image MIME/size checks before upload, safe error messages.
- **Performance:** TanStack Query caching with stale times, `FlatList` virtualization, `expo-image` with resized images, skeleton loaders, lazy-loaded screens, limited re-renders.
- **Reliability:** global error boundary, network reconnect detection, retry buttons, timeout handling, query invalidation after mutations.
- **Compatibility:** Expo SDK 58 / React Native 0.88 / React 19.3, pinned versions from Expo bundled native modules; no browser-only libraries.
- **Testing:** unit tests for validation/utils/store, integration tests for API client/auth/request flows with mocked fetch, component/UI smoke tests for key screens. Real device/emulator checks documented honestly.

## 7. Release readiness

- Android package: `com.biitechnologies.localfinder`; iOS bundle id: `com.biitechnologies.localfinder`.
- EAS build profiles: development, preview, production. No signing credentials committed; EAS credentials managed externally.
- App name "BII LocalFinder"; icon and splash assets use forest green + ivory identity.
- Store listing metadata, privacy policy and external accounts (Expo/EAS, Apple Developer, Google Play, FCM/APNs, Sentry optional) documented in `docs/MOBILE_RELEASE.md`.
