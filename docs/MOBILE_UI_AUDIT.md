# BII LocalFinder — Mobile UI/UX Audit

**Date:** 2026-11-25
**Scope:** `apps/mobile` only. Existing Expo Router, React Native, TypeScript, TanStack Query, Zustand, Socket.IO, SecureStore, and backend integration are preserved.

## Executive summary

The mobile app has a strong functional foundation: role-aware navigation, broad token adoption, reusable primitives, real API data, Socket.IO chat, pull-to-refresh on key screens, and Zod validation in core flows. It does not yet feel like a premium international marketplace.

The main problem is not missing features; it is inconsistent presentation and unfinished product surfaces:

- no shared application header, so back/title chrome is copied into roughly 27 screens;
- tab bars are generic, fixed-height, and do not surface unread state;
- cards are mostly identical bordered rectangles, with little hierarchy or media-led discovery;
- loading, error, empty, notice, and confirmation patterns are fragmented;
- many API fields already exist but are unused (`personalization.sections`, provider `logoUrl`, `responseRateSummary`, `reputationMetrics`, `serviceAreas`, review photos/subratings, quote inclusions, conversation unread counts, notification deep-link data);
- hardcoded colors and raw spacing appear in layout chrome, alerts, banners, and one-off controls;
- long forms expose raw IDs and free-text dates/times instead of guided pickers;
- accessibility state, dynamic type, reduced motion, keyboard handling, and bottom safe areas are incomplete;
- dark tokens exist but are effectively unreachable and would break several screens if enabled.

The redesign should be system-first: strengthen the theme and component kit, then apply those primitives across customer, provider, navigation, and feedback surfaces. This preserves functionality while raising consistency quickly.

## Design direction

Brand identity: Forest Green, Warm Ivory, Premium White, sophisticated neutrals, restrained Gold.

Target impression: serious, modern, trustworthy technology platform. Not a generic marketplace template or admin dashboard.

Principles:

1. **Trust before decoration.** Verification, status, provenance, and clear next actions must be visible.
2. **Calm hierarchy.** One primary action per screen, generous spacing, restrained elevation, no heavy gradients.
3. **Data honesty.** Use real API data; show “not enough data yet” instead of invented metrics.
4. **Task completion.** Remove fake affordances, expose existing deep links, make destructive actions safe.
5. **System consistency.** Centralize colors, type, spacing, radius, elevation, motion, and component states.

## Existing architecture and tokens

Key files:

- `app/_layout.tsx:13-57` — root providers, error boundary, status bar, hidden headers.
- `app/index.tsx:7-24` — bootstrap redirect and loading screen.
- `app/(customer)/_layout.tsx:5-18`, `app/(provider)/_layout.tsx:5-18` — role guards and hardcoded loading colors.
- `app/(customer)/(tabs)/_layout.tsx:5-31`, `app/(provider)/provider/(tabs)/_layout.tsx:5-31` — five-tab navigation.
- `src/theme/colors.ts:1-60` — forest/ivory palette plus unused dark palette.
- `src/theme/metrics.ts:3-30` — spacing, radius, typography scale.
- `src/theme/ThemeProvider.tsx:5-29` — fixed light mode; `setMode` unused.
- `src/components/ui/Button.tsx`, `Card.tsx`, `Screen.tsx`, `Input.tsx`, `FormInput.tsx`, `Badges.tsx`, `Skeleton.tsx`, `States.tsx`.
- `src/components/domain/ProviderCard.tsx`, `BookingCard.tsx`, `QuoteCard.tsx`, `RequestCard.tsx`, `ReviewCard.tsx`.

Current palette is appropriate but incomplete. Missing semantic tokens: `surfaceElevated`, `surfaceMuted`, `warningSoft`, `dangerSoft`, `successSoft`, `textOnPrimary`, border widths, elevation, z-index, and motion.

Measured token adoption is broadly good (hundreds of `colors`, `spacing`, `typography`, and `radius` usages), but token discipline breaks in exactly the places users notice first: app shell, guards, alerts, badges, modals, and primary conversion screens.

## Stage A findings

### 1. Shell, navigation, and system

- All stacks hide headers (`app/_layout.tsx:52`, group layouts), so every secondary screen builds its own back button/title.
- Tab bars use identical fixed 64px configuration, tint-only active state, 11px labels, no badges, no haptics, no adaptive inset handling.
- Root loading, guard loading, error boundary, and several banners hardcode hex colors.
- Route strings are inconsistent (`/explore` vs `/(customer)/(tabs)/explore`); `typedRoutes` is disabled.
- Shared messages screen is re-exported as both customer and provider tab, with customer-facing copy and a back button inside a tab.
- `return null` during role redirects causes blank flashes on guarded root screens.
- AppErrorBoundary sits outside `ThemeProvider`, shows raw error messages, and its reload button may immediately rethrow.

### 2. Customer discovery and home

- `app/(customer)/(tabs)/index.tsx:45-60` has a minimal header; only `greeting` is consumed from personalization, while `sections` and `coldStartStage` are unused.
- `index.tsx:84` renders “See all” as plain `Text`, a fake affordance.
- Category tiles reuse one icon and use fixed 30% widths.
- Search entry at `index.tsx:74-81` is a fake input with no recents/suggestions.
- `explore.tsx:28-67` keeps filters only in local state; saved-search rerun and assistant deep links pass `q`/`city`/`verifiedOnly`, which Explore ignores.
- “Save search” opens a blank form instead of prefilling current facets.
- Compare selection is ephemeral, max-3 warning appears late, profile “Compare providers” routes to Explore instead of `/compare`.
- Map markers lack price, callouts, and search-this-area behavior.
- AI search consent copy claims opt-in, but the mutation sends consent implicitly.
- Loading is plain text; no layout-matching skeletons.

### 3. Provider profiles and discovery cards

- `app/provider/[id].tsx:79-102` is text-first: small avatar, name, badges, rating. It ignores `logoUrl`, `serviceAreas`, `reputationMetrics`, `responseRateSummary`, `businessVerified`.
- Primary actions at `provider/[id].tsx:125-150` scroll away; no sticky action bar.
- Trust is reduced to small badges and a footnote.
- Reviews are sliced to five; subratings, photos, and verified flags are dropped.
- Offering selection is arbitrary (`serviceOfferings?.[0]`); users cannot choose what to request.
- Favorite mutation has no optimistic or pressed feedback.
- `ProviderCard` is information-dense but not photo-led or scannable at premium-marketplace quality.

### 4. Requests, quotes, and bookings

- `app/(customer)/(tabs)/requests.tsx:32-39,102` has duplicate creation CTAs; segmented control has no counts or tab semantics.
- `app/request/new.tsx:126-193` exposes UUID entry and free-text date/time fields; no progress, sections, or draft persistence.
- AI consent switch is cosmetic; payload hardcodes consent.
- Photo upload shows one global notice with no per-file state.
- `app/request/[id].tsx:119-200` repeats counter-offer forms under each quote; one pending flag disables all quotes; destructive cancel has no confirmation.
- Quote details drop materials, inclusions, exclusions, expiry, and attachments.
- `app/booking/[id].tsx` has no status timeline, no message/dispute action, and review ratings are numeric text fields defaulting to 5.
- Detail routes have no explicit back control.

### 5. Messaging

- Socket integration is sound: singleton, auth refresh on reconnect, room join, message/typing events, HTTP fallback (`src/services/socket.ts`, `app/messages/[id].tsx`).
- Conversation list has no unread badges despite `unreadCount`, no search/filter, no pull-to-refresh, and customer-only empty copy in provider tab.
- Chat header says only “Conversation”; participant, avatar, verification, and linked request are unused.
- No timestamps, day separators, read/delivery states, pending/failed sends, or retry.
- Attachments render as “📎 Attachment” with no preview or tap target.
- Typing indicator is plain text; composer can sit under the home indicator.
- Disputes use a different message metaphor (cards + form composer).

### 6. Profile, account, preferences, notifications

- Customer and provider profiles are long undifferentiated menu lists.
- Customer experience switch contradicts its label (`profile.tsx:75-78` always sets provider mode).
- Account duplicates profile links; data export shows raw JSON rather than a real file handoff.
- Delete account has password only, no typed confirmation or consequence list.
- Notifications are not actionable; `NotificationItem.data` is ignored; no unread count, grouping, or deep-link routing.
- Personalization mixes auto-save toggles with manual save filters; interests show raw “Score N”.
- Sign out has no confirmation.

### 7. Provider business product

- Overview has four isolated counters while backend returns nine analytics fields; `conversionRate`, `serviceViews`, `topSearchedService`, `mostViewedService` are unused.
- Loading and zero are indistinguishable (`Metric` renders `—`).
- Verification appears in three separate overview surfaces with inconsistent status logic.
- Profile shows `INACTIVE` before data loads and displays a long temporary-billing sentence as plain text.
- Menu has 11 flat rows with no grouping.
- Insights duplicates percentage text and a generic checklist; opportunity provenance copy is weaker than web.
- Services expose read-only Service ID, fixed price type, no edit, no confirmation, and wrong-color error notices.
- Portfolio/experience/education use raw text inputs, duplicate “More provider tools”, and no unsaved-close guard.
- Verification records always use warning tone; document-size copy is not enforced.
- Workspaces show “No workspaces” during loading and have no invitation states.
- Availability initializes slots from hardcoded defaults and never hydrates saved hours — saving immediately can overwrite server data.
- There is no subscription screen; only an honest unavailable status card. Do not invent plans, prices, or benefits.

### 8. Feedback, states, accessibility, and motion

- `notice` local string state appears in roughly 30 files and is often danger-colored for success/info messages.
- No toast/snackbar, confirm sheet, or global feedback surface.
- Skeletons exist but many primary screens show plain “Loading…”.
- Pull-to-refresh is missing on several refetchable screens.
- No NetInfo dependency or offline banner; socket reconnect state is not surfaced.
- Hardcoded colors bypass theme in layouts, alerts, badges, modals, and forms.
- Some touch targets are 22–34px; selected chips rarely expose `accessibilityState`.
- No `accessibilityHint`, live regions, focus-first-invalid, reduced-motion handling, or dynamic type strategy.
- Reanimated and Gesture Handler are installed but unused; only Skeleton animates.

## Stage B design system plan

Create/extend:

- semantic tokens: elevation, motion, border widths, z-index, tone surfaces;
- `AppScreenHeader` with back/title/subtitle/actions;
- `IconButton`, `Chip`, `SegmentedControl`, `Notice`, `Toast`, `ConfirmDialog`;
- `ProviderCard`, `StatusBadge`, `RatingDisplay`, `MenuRow`, `SearchBar`;
- `LoadingState`, `ListSkeleton`, `ProfileSkeleton`;
- `BottomSheet`, `ImageUploader`, `StarRatingInput`;
- shared tab screen options with active indicator and badge support;
- `StatusTone` helper for request/booking/quote/verification statuses.

Remove hardcoded hex values in shell/loading/error surfaces and replace them with tokens.

## Stage C customer redesign plan

1. Home: premium greeting hero, real location selector, functional search entry, category navigation from API data, personalized sections, featured/nearby curated modules.
2. Explore: URL-driven filters, filter summary chips, view-mode control, compare tray, premium result cards, map callouts, layout-matched skeletons.
3. Provider profile: hero/trust panel, selectable offerings, sticky action bar, richer reviews, verified review/response-rate signals.
4. Requests/bookings: one creation CTA, guided form with service/date/time pickers, quote comparison, status timeline, safe cancel, star review input.
5. Messaging: role-appropriate conversation list, unread badges, contextual chat header, message timestamps/day separators, attachment previews, typing bubble, pending/failed states.
6. Profile/account/settings: sectioned menus, correct experience switch, notifications deep links, confirmation sheets, unified save semantics.

## Stage D provider redesign plan

1. Overview: identity header, verification stepper, all existing analytics fields, funnel, conversion rate, honest empty data copy, priority action, shortcuts.
2. Services: named service picker, price type/duration, edit action, per-row pending state, delete confirmation.
3. Requests: status counts, structured request detail, quote fields, status-specific tones.
4. Profile: skeleton while loading, grouped menus, honest subscription status card, verification status component.
5. Portfolio/experience/education: consistent editor patterns, validation, date hints, before/after grouping, timeline presentation.
6. Verification/workspaces/availability: status journey, loading/error/empty states, saved-hours hydration, email validation, role/status copy.

## Stage E navigation and interactions plan

- Shared premium tab bar config: active pill/indicator, better label typography, badge slots, safe-area inset, press feedback.
- Branded redirect/loading state instead of `return null`.
- Reusable bottom sheet for Explore filters and AI assist.
- Semantic notices and confirmations for destructive actions.
- Consistent skeletons, pull-to-refresh, and retry actions.
- Reduced-motion aware skeleton/press/list transitions using existing Reanimated.
- Keyboard avoidance and larger accessible touch targets.

## Stage F QA checklist

Run from `apps/mobile`:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform android --output-dir /tmp/opencode/mobile-ui-export
```

Manual checks:

- authentication, welcome/login/register/reset/verify;
- customer home → explore filters/map/compare → provider profile → request creation → quote revision/accept → booking → review;
- customer messages socket send/attach/typing/fallback;
- provider overview → services CRUD → incoming request → quote → profile tools → verification/workspaces/availability;
- notification deep links, reports, disputes, saved searches, personalization;
- small Android, large Android, iPhone safe areas, keyboard open, low network.

## Stage G final polish checklist

- no hardcoded brand colors in app-shell chrome;
- all primary buttons functional and visually dominant;
- consistent typography, spacing, radius, icon size, and status tone;
- no raw fake data and no invented metrics;
- all loading/empty/error states intentional;
- accessibility labels/states on interactive controls;
- no regressions to routes, API client, SecureStore, Socket.IO, or backend integration.

## Non-negotiables

- Do not rebuild the backend or create a separate app.
- Do not change API endpoints, database models, or auth behavior for design.
- Do not replace real data with mock content.
- Do not fabricate ratings, reviews, bookings, subscription plans, prices, or financial data.
- Do not leave nonfunctional buttons or visually inconsistent screens.
- Do not claim verification without running commands.
