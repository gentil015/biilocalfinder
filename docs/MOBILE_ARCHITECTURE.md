# BII LocalFinder Mobile — Architecture (Stage 2)

## 1. System boundary

```
Expo app (apps/mobile)
 ├─ Expo Router screens (features)
 ├─ TanStack Query (server state) + Zustand (UI/session hints)
 ├─ Typed API client ──HTTP Bearer──> NestJS /api (apps/api)
 ├─ Socket.IO client ──WS Bearer────> messaging gateway /socket.io
 └─ expo-notifications / expo-location / expo-image-picker
                                      │
                        NestJS → PostgreSQL/PostGIS, Redis/BullMQ, S3
```

The mobile app never connects to PostgreSQL, Redis or object storage directly. It uses only the public API and signed URLs returned by it. Uploads go to `POST /api/files/upload` (or domain-specific attachment endpoints).

## 2. Directory structure

```
apps/mobile/
  app/
    _layout.tsx                 Root providers, session bootstrap, error boundary
    index.tsx                   Initial routing gate
    (onboarding)/welcome.tsx
    (auth)/login.tsx, register.tsx, forgot-password.tsx, reset-password.tsx, verify-contact.tsx
    (customer)/_layout.tsx, (tabs)/{index,explore,requests,messages,profile}.tsx, ...
    (provider)/_layout.tsx, (tabs)/{index,services,requests,messages,profile}.tsx, ...
    profile/, notifications/, location/, map/ (shared nested screens)
  src/
    components/     ui/ (Button, Card, Input, Avatar, Badge, Skeleton, EmptyState, ErrorState), layout/, marketplace/
    features/       authentication/, marketplace/, search/, providers/, bookings/, messaging/,
                    favorites/, notifications/, subscriptions/, location/, provider/
    services/       api/ (client, auth, endpoints/*), socket/, notifications/, storage/
    hooks/          useAuth, useLocation, useNetwork, useRoleNavigation
    stores/         auth.store.ts, app.store.ts
    navigation/     role-routes.ts, deep-links.ts
    theme/          colors.ts, spacing.ts, typography.ts, shadows.ts, ThemeProvider.tsx
    constants/      config.ts, enums.ts, terms.ts
    types/          api.ts, models.ts
    utils/          format.ts, validation.ts, image.ts, errors.ts, date.ts
  assets/           images, fonts, icon, splash
  tests/            unit + integration + component tests
  app.json, eas.json, tsconfig.json, package.json, babel.config.js, jest.config.js
```

Feature folders own their screens' hooks and components; cross-feature UI lives in `src/components`. API endpoint modules are grouped by domain to mirror the backend.

## 3. Dependency choices (Expo SDK 58, pinned)

| Need | Package | Reason |
| --- | --- | --- |
| Framework | `expo ~58.0.26`, `react-native 0.88.1`, `react 19.3.0`, `expo-router ~58.0.32` | Latest SDK; versions from Expo's `bundledNativeModules.json` |
| Navigation primitives | `react-native-screens ~4.30.1`, `react-native-safe-area-context ~5.11.1`, `react-native-gesture-handler ~3.3.0` | Expo-bundled, required by Router |
| Animations | `react-native-reanimated 4.7.1`, `react-native-worklets 0.13.0` | Expo-bundled compatible pair |
| Server state | `@tanstack/react-query ^5.108.4` | Already used by web; pagination, caching, invalidation |
| UI state | `zustand` | Lightweight session/UI state, no provider boilerplate |
| Forms/validation | `react-hook-form`, `zod`, `@hookform/resolvers` | Same stack as web; shared schema style |
| Credentials | `expo-secure-store ~58.0.3` | Keychain/Keystore-backed |
| Notifications | `expo-notifications ~58.1.9` | Local + token lifecycle |
| Location | `expo-location ~58.0.22` | Foreground location only |
| Images | `expo-image ~58.0.18`, `expo-image-picker ~58.0.10`, `expo-camera ~58.0.14` | Efficient cached images; uploads |
| Maps | `react-native-maps 1.29.11` | Native Google Maps/Mobile MapKit, Expo-bundled; browser Leaflet not reused |
| Realtime | `socket.io-client ^4.8.4` | Matches server v4 |
| Icons | `lucide-react-native ^1.79.0` + `react-native-svg 15.16.1` | Consistent icon set (peer requires svg) |
| Init/storage | `expo-constants`, `expo-linking`, `expo-status-bar`, `@react-native-async-storage/async-storage 2.2.0` | Env/linking/status bar and non-sensitive caches only |
| Tests | `jest`, `jest-expo`, `@testing-library/react-native`, `typescript ~5.9.3` | Expo-supported test stack |

`packages/types` is intentionally **not** imported yet: it is not built/aliased for Metro, and duplicating four unions in typed API models is safer than introducing a monorepo package change. Revisit if more shared types emerge.

## 4. Configuration and environments

- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL` in `apps/mobile/.env*` (gitignored); sane dev defaults in `src/constants/config.ts`.
- Production API base is `https://api.biilocalfinder.com` (web convention); no secret values are public.
- `app.json`: name/slug `bii-localfinder`, scheme `biilocalfinder`, Android package + iOS bundle id `com.biitechnologies.localfinder`, edge-to-edge, plugin config for expo-router, reanimated, notifications, location, image-picker, camera, maps.
- `eas.json`: `development` (dev client), `preview` (internal testing), `production` (store builds). Credentials handled in EAS, not in repo.

## 5. API client design (`src/services/api/client.ts`)

1. `request<T>(path, init, { auth })` builds `${API_URL}/api${path}` with `AbortSignal.timeout` (default 15 s; uploads 60 s).
2. JSON by default; `FormData` passed through untouched.
3. Auth: `Authorization: Bearer <accessToken>`; single-flight refresh on 401 (`/auth/refresh` with stored refresh token), replay once, then `session.reset()` + navigate to login.
4. Errors: normalized `ApiError { status, message, details }` from Nest JSON (`string | string[] message`), network errors mapped to a friendly "Cannot reach the server" message; never include token values in messages or logs.
5. Workspace header: `x-workspace-id` from active workspace store when present.
6. Endpoint modules expose typed functions (e.g. `searchApi.providers(params)`, `requestsApi.create(dto)`), keeping DTO shapes in `src/types/api.ts` with Zod schemas where validation matters.
7. Query keys centralized (`queryKeys.ts`): `['providers','search',params]`, `['requests','mine']`, etc. Mutation success invalidates affected keys.
8. Network reconnect hook invalidates current queries when connectivity returns.

## 6. Auth and role state flow

```
Bootstrap (app/_layout.tsx)
  read SecureStore tokens (if any) -> GET /users/me -> GET /workspaces (if PROVIDER)
  -> set auth store { user, role, activeWorkspaceId }
  -> router.replace(role === 'PROVIDER' ? '/(provider)/(tabs)' : '/(customer)/(tabs)')
  no tokens -> router.replace('/(onboarding)/welcome')
```

- Tokens never in Zustand persistence; the store holds only user/profile/role/activeWorkspace in memory. A non-sensitive `onboardingComplete` flag may live in AsyncStorage.
- Role switcher calls a store action and re-routes; server role is refreshed on app resume.
- `useAuthGuard` in each protected layout redirects unauthenticated users and shows a bootstrap splash while resolving.
- Multi-workspace selection uses `/workspaces`; active id stored in memory + AsyncStorage (non-sensitive) and sent as header.

## 7. Design system

Tokens in `src/theme`:

| Token | Value | Use |
| --- | --- | --- |
| `forest` | `#174D38` | Primary actions, headers, active tab, focus ring |
| `forestDark` | `#103A2B`, `forestSoft #E8F0EA` | Pressed states, tinted surfaces |
| `ivory` | `#F6F1E7` | Page background |
| `surface` | `#FFFFFF` | Cards, inputs, sheets |
| `gold` | `#D8A64E` | Ratings, premium/verification highlights (sparingly) |
| `ink` | `#1B2620` / `#5B6A61` / `#87948B` | Primary/secondary/muted text (AA for body at 500+) |
| `line` | `#E6E2D8` | Hairline borders |
| `success/warning/danger/info` | accessible semantic ramps | Status only |

Rules: 8 pt spacing grid; 12–20 px radii by component size; hairline borders over shadows; one primary action per screen; typography scale 12/14/16/18/22/28 with ≥14 px body; skeletons for loading; no heavy gradients; dark mode facade via theme tokens (light implemented now).

Components: `Button`, `IconButton`, `Card`, `PressableCard`, `Input`, `TextArea`, `Select/Sheet`, `Chip`, `Avatar`, `Badge`, `VerificationBadge`, `RatingRow`, `PriceLabel`, `Skeleton`, `EmptyState`, `ErrorState`, `SectionHeader`, `Screen`, `AppHeader`, `TabBar`, `ImageUploader`, `LocationPicker`, `StatusPill`.

## 8. Data flow examples

**Discovery:** Search screen → `searchApi.providers(params)` → TanStack Query (keepPreviousData) → `ProviderCard` list → `expo-router.push('/provider/[id]')` → record interaction → provider detail query with coords → contact button gated by booking state.

**Request creation:** form (RHF + Zod) → image picker → `/files/upload` per image → `requestsApi.create(dto)` → invalidate `['requests','mine']` → navigate to request detail. No optimistic "accepted" state.

**Messaging:** conversation query (REST) → socket connect with Bearer → join conversation room → `message:new` updates query cache; send uses socket ack with REST fallback; `notification:new` invalidates notification queries and shows local notification when app is foregrounded.

**Notifications:** `expo-notifications` permission and token obtained on explicit user opt-in; token cached locally; in-app/socket notifications are authoritative. Native-token backend registration is a documented extension point (`NativePushTokenService` interface) with a no-op implementation until endpoint exists; UI never displays "push enabled" based only on local token.

## 9. Security design

- SecureStore for tokens; no tokens in AsyncStorage, query cache, logs, Sentry breadcrumbs or URLs.
- All protected operations go through the API; UI permission checks are advisory only.
- Zod validation at form boundaries; file type/size checks before upload; server remains final validator.
- Error messages from server are shown as-is if safe strings; generic fallback for network/5xx.
- Certificate/HTTPS enforced by configuration in production; ATS default on iOS; Android cleartext only in dev config.
- Logout: call `/auth/logout`, clear SecureStore, Zustand state, AsyncStorage caches, Query cache and socket connection.

## 10. Testing strategy

- **Unit:** Zod schemas, formatters, API error normalization, auth store transitions, query keys, status label mapping.
- **Integration (mocked fetch):** login/refresh/401 replay, request creation DTO, provider offering CRUD, role-aware routing helpers, notification deep-link parsing.
- **Component:** render key screens with MockedResponse providers; assert loading/empty/error states and that primary buttons call handlers.
- **Device:** Android emulator/physical device required; iOS simulator only if available (document honestly). Check navigation, keyboard, permissions, image picker, location, notifications, network failures.

## 11. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Expo 58 / RN 0.88 package drift | Pin versions from bundled modules; run `npx expo-doctor` and typecheck |
| Backend subscription code currently broken/deleted | Honest status UI, no purchase simulation, documented follow-up |
| No native push endpoint | Socket + in-app notifications now; interface-ready extension later |
| Working tree already dirty | Never reset/stage/commit unrelated changes; only add mobile + docs |
| API unavailable during development | Screens show real empty/network errors; no fake data fallback |
| Multiple providers per user | Workspace header from `/workspaces`; server-validated |
