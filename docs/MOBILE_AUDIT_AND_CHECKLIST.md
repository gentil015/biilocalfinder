# BII LocalFinder Mobile — Complete Audit & Implementation Checklist

**Date:** 2026-11-28  
**Scope:** `apps/mobile` (screens, routing, components, API layer, state, theme, tests). Backend files were read only to verify actual API contracts. No endpoints or fields were invented.  
**Stack:** Expo `~58.0.26`, React Native `0.88.1`, React `19.3.0`, Expo Router `~58.0.32`, TanStack Query `5`, Zustand `5`, Socket.IO client, `expo-secure-store`.

## Executive summary

The app already has a strong functional base: real API integration, role-aware shells, a semantic theme, reusable UI primitives, validated request forms, native maps, AI assistance, socket chat, and negotiation/booking flows.

The main risks are no longer “missing screens”. They are:

1. **Safety/reliability defects** that can cause failed submissions or stale private data: invalid report category enum, session/workspace caches not cleared together, forced AI consent, messaging send confirmation via socket echo only.
2. **Role/navigation gaps**: provider-only root screens are unguarded, auth/onboarding groups allow authenticated deep links, notification taps are not handled, mixed group-qualified routes.
3. **Unclear high-value journeys**: customer “accepted, waiting for provider” state is hidden; provider cannot respond to client counter-offers though backend allows it; provider request detail drops images/context; “Contact provider” only shows a notice.
4. **Design-system drift**: dark theme is unreachable, touch targets below the project’s own 44px minimum, several component APIs duplicate behavior, form errors not associated with inputs, modals do not confine screen-reader focus.
5. **No real localization layer**: locale is persisted but has no client effect; user-facing strings are literals throughout.
6. **Backend-contract mismatches**: report enum, `locationId` cast from a nonexistent id, loose numeric validation, Explore filter constraints, saved-search fields.

This checklist prioritizes safe, reversible improvements that preserve existing business rules, followed by product/backend-dependent items that are explicitly marked as needing confirmation.

---

## Audit findings

### P0 — must fix

| ID | Finding | Evidence | Safe action |
| --- | --- | --- | --- |
| P0-1 | Provider report submissions use invalid enum values. | Mobile `REPORT_CATEGORIES` includes `FRAUD_OR_SCAM`, `FAKE_LISTING`, etc. Backend `FraudReportCategory` is `FAKE_PROVIDER_IDENTITY`, `SUSPICIOUS_PROVIDER_BEHAVIOR`, `MISLEADING_SERVICE_INFO`, `SUSPECTED_SCAM`, `SUSPICIOUS_BOOKING_ACTIVITY`, `IMPERSONATION`, `OTHER`. `app/reports.tsx:66` defaults to invalid `FRAUD_OR_SCAM`. | Use a fraud-report-specific enum matching backend, with clear labels. |
| P0-2 | Session, workspace, and Query caches are not cleared together. | `client.ts:133-135` clears tokens; root handler only calls auth reset. `cacheStore.clearSessionData()` and `queryClient.clear()` have no callers. Workspace-scoped query keys omit `activeWorkspaceId`. | Export one QueryClient, clear cache/session data on 401 and sign-out/workspace switch, include workspace id in workspace-scoped keys. |
| P0-3 | AI consent is implicitly `true` in API helpers. | `parity-customer.ts:250-273` defaults `consentToProcess` to `true`; Explore AI sheet has no opt-in; Assistant has a switch but still sends `true`. | Remove implicit consent; add explicit opt-in in Explore; pass real consent from Assistant. |
| P0-4 | Provider-only root screens are unguarded. | `verification.tsx`, `availability.tsx`, `workspaces.tsx` use provider/workspace APIs with no `useRoleGuard(['PROVIDER'])`. | Add guards (backend enforcement remains unchanged). |
| P0-5 | Auth/onboarding groups allow authenticated deep links. | `(auth)/_layout.tsx` and `(onboarding)/_layout.tsx` only hide headers; index redirect only applies to `/`. | Add guest-only guard at group level. |

### P1 — high-impact UX/clarity

| ID | Finding | Evidence | Safe action |
| --- | --- | --- | --- |
| P1-1 | Customer “accepted, waiting for provider confirmation” is hidden. | `requests.tsx:40-47` defines `bookingGroups.needsAction = ACCEPTED` but renders only `upcoming`/`history`. | Add a dedicated section/status card and clear copy. |
| P1-2 | Provider cannot respond to client counter-offers. | Customer has revision create/respond at `request/[id].tsx:76-81,222-233`; provider detail is read-only at `(provider)/provider/request/[id].tsx:274-287`. Backend allows the other party to respond (`quotes.service.ts:252-263`). | Add accept/reject controls for client-proposed revisions using existing `acceptRevision`/`rejectRevision`. |
| P1-3 | Provider request detail drops existing context. | Customer renders offering, location, attribute snapshots, images; provider detail shows only “Images: N attached”. | Render the same existing fields/images for providers. |
| P1-4 | “Contact provider” is misleading. | `provider/[id].tsx:114-121` only writes contact details into a notice; CTA says “Contact provider”. | Rename to “View contact details” and show the details in a sheet/card, or open a real action when supported. |
| P1-5 | Provider messages empty state tells providers to message a client, but backend only allows clients to start conversations. | `messages.tsx:126-128`; backend rejects provider-initiated starts. | Replace with accurate copy: conversations appear when a client contacts you. |
| P1-6 | Messaging sends rely on socket echo. | `messages/[id].tsx:117-129,170-173`; backend gateway emits `message:new` with no ack. REST send exists. | Use REST as authoritative send path; keep socket for receive/typing; invalidate conversation cache after read. |
| P1-7 | Notification taps are not wired. | `notifications.tsx:32-52` has route logic only for in-app taps; no response listener found in root/local notifications. | Extract route mapping and handle `useLastNotificationResponse` in root. |
| P1-8 | Reset-password success UI is unreachable. | `reset-password.tsx:42-44` immediately replaces route after setting `done`. | Keep success state until user acknowledges. |
| P1-9 | Saved searches pass unsupported `sort`/`radiusKm`. | Explore sends them; `CreateSavedSearchDto` does not support them. | Stop passing unsupported params; show only persisted filters on rerun. |
| P1-10 | Explore filters are not clamped to backend constraints. | Backend `radiusKm` 1–200, `minRating` 0–5, `limit` 1–50; Explore uses raw strings and `limit: 30`. | Clamp/validate before building `ProviderSearchParams`. |

### P2 — design system / accessibility

| ID | Finding | Evidence | Safe action |
| --- | --- | --- | --- |
| P2-1 | Touch targets below 44px. | `Button size="sm"` 40, `Chip` 40, `SegmentedControl` 38, back/remove buttons 36/22. | Use `hit.min` or add `hitSlop`; preserve compact prop where density is needed. |
| P2-2 | Form errors not associated with inputs. | `Input.tsx` sets `accessibilityLabel` only; no `accessibilityState.invalid` or hint. | Add `accessibilityHint={error ?? hint}` and `accessibilityState`. |
| P2-3 | Error/loading states not announced. | `States.tsx` `ErrorState`/`LoadingState`, `Skeleton`, `RoleGuardLoading`. | Add roles, live regions, labels. |
| P2-4 | Modals do not confine screen-reader focus. | `BottomSheet`/`ConfirmDialog` lack `accessibilityViewIsModal` and dialog role. | Add modal/header semantics. |
| P2-5 | Toast icon map diverges from Notice. | `Toast` warning uses `Info`; `Notice` uses `TriangleAlert`. | Share one tone icon map. |
| P2-6 | `AppScreenHeader title=""` produces “Go back from ” on provider profile. | `provider/[id].tsx:146`; `AppScreenHeader.tsx:37`. | Fallback to “Go back”. |
| P2-7 | Dark theme is dead code. | `ThemeProvider.tsx` hardcodes `light`; `setMode` unused. | Keep light-only intentionally or wire a setting; do not leave half-wired. |
| P2-8 | Raw colors/radii/font sizes bypass tokens. | Shell, alerts, modal handles, several detail screens. | Replace with existing tokens where behavior-preserving. |

### P3 — product/backend-dependent (do not fake)

| ID | Finding | Needed decision/backend support |
| --- | --- | --- |
| P3-1 | Provider onboarding “Location” checklist loops to discovery-only `/location`; `providerApi.updateLocation` exists but is unused. | Decide whether discovery location should also persist provider profile location. |
| P3-2 | Provider-initiated conversations are not supported by backend. | Backend endpoint needed before adding UI. |
| P3-3 | No earnings/payout/withdraw/invoice flow exists on mobile. | Backend/payment product decision needed; keep honest placeholder. |
| P3-4 | Native push token registration is absent; backend supports only Web Push. | Backend endpoint needed for Expo push tokens. |
| P3-5 | Verification UI accepts `application/pdf` in validation but picker only supports images. | Add document picker or remove PDF copy/validation. |
| P3-6 | Dispute creation allows providers but lists only client bookings. | Use role-based booking list or restrict entry. |
| P3-7 | `locationId` is cast from a nonexistent `SelectedLocation.id`. | Persist real backend location id or omit until supported. |
| P3-8 | No localization layer; locale setting has no UI effect. | Add architecture and migrate strings incrementally; translate core strings first. |

---

## Implementation checklist

Status legend: `[x]` implemented in this transformation pass, `[~]` partially implemented/architecture only, `[ ]` pending, `[?]` needs product/backend decision.

### Phase 1 — shared foundation and safety

- [x] Fix provider report category enum to match backend `FraudReportCategory`.
- [x] Add explicit AI consent to Explore AI search and pass real Assistant consent.
- [x] Add provider role guards to `verification`, `availability`, `workspaces`.
- [x] Add guest-only guards to auth/onboarding layouts.
- [x] Reset-password success state must be acknowledged before redirect.
- [x] Clear session cache and Query cache on unauthorized/sign-out/workspace switch.
- [x] Include active workspace id in workspace-scoped query keys.
- [x] Harden `Input`, `States`, `Skeleton`, `Toast`, `ConfirmDialog`, `BottomSheet`, `AppScreenHeader` accessibility.
- [x] Raise core touch targets to `hit.min` (44px).
- [x] Normalize group-qualified route strings to public routes.
- [x] Handle system notification taps with shared notification route mapping.
- [~] Add lightweight i18n string module and locale-aware formatting foundation.

### Phase 2 — customer journey

- [x] Modernize service request form (already shipped before this audit).
- [x] Modernize provider search/explore screen (already shipped before this audit).
- [x] Add customer “accepted / waiting for provider” booking section.
- [x] Make Explore filter values safe against backend constraints.
- [x] Stop saving unsupported saved-search fields.
- [x] Replace misleading “Contact provider” CTA with “View contact details”.
- [ ] Add explicit provider report path from provider profile if product wants it.
- [ ] Add q/keyword support to saved searches only if backend `CreateSavedSearchDto` supports it.
- [ ] Add pagination/infinite list to Explore when backend page contract is confirmed in UI.
- [ ] Add a status timeline to `booking/[id].tsx`.
- [ ] Add confirmation before cancelling a booking.

### Phase 3 — provider journey

- [x] Add provider response controls for client-proposed revisions.
- [x] Render full request context/images for providers.
- [ ] Rename “Upcoming bookings” to “Recent bookings” or filter by status/date.
- [ ] Remove duplicate verification CTA from provider overview.
- [ ] Add Negotiating filter to provider requests.
- [ ] Reject non-finite numeric attribute inputs in service catalogue.
- [x] Correct provider messages empty-state copy.
- [ ] Make verification identity next step actionable or reword it.
- [ ] Make insights opportunity cards actionable or label them informational.
- [ ] Clarify service radius vs service areas copy.
- [?] Persist provider location via `providerApi.updateLocation` from onboarding.

### Phase 4 — reliability, a11y, localization, performance

- [x] Use REST as authoritative messaging send path; invalidate conversations after mark-read.
- [ ] Add component tests for a11y-critical primitives.
- [ ] Add NetInfo-based offline banner using a new dependency only if justified.
- [ ] Align onboarding/profile/review zod schemas with backend DTO ranges.
- [ ] Invalidate public provider review caches after review create/response.
- [ ] Replace raw hex/radius/font size outliers with tokens.
- [ ] Make elevation shadow color theme-aware.
- [ ] Extract `PasswordField` and `StarRating` shared components.
- [ ] Replace duplicate `DetailRow`/`ChecklistRow` implementations.
- [~] Use locale setting in formatting helpers; full UI translation remains incremental.

### Phase 5 — QA

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test -- --runInBand`
- [ ] Android/iOS export smoke check after final batch.
- [ ] Runtime backend smoke test for report submission, AI consent, negotiation, messaging, notifications.
