# Multi-provider workspace architecture

## Why this exists

The platform originally modeled one `Provider` profile per `User`
(`Provider.userId` is `@unique`). The multi-provider-workspace brief asks
for a provider's operating identity to be separable from their login
account, so a user can own or belong to several dashboards without
several accounts.

Two ways to close that gap were considered:

1. **Additive**: add `Workspace` + `WorkspaceMembership` as a layer
   around the existing `Provider` model, leaving every other table
   (bookings, quotes, reviews, subscriptions, search, analytics — ~20
   models) untouched.
2. **Full retrofit**: re-key every `providerId` foreign key in the
   schema to `workspaceId`.

**Option 1 was chosen** (confirmed with the project owner) — it satisfies
the brief without destabilizing ~60 already-working backend modules.

## What Phase 2 (this change) delivers

- `Workspace` and `WorkspaceMembership` models
  (`apps/api/prisma/schema.prisma`), backfilled for every existing
  provider by `apps/api/prisma/manual-sql/008_workspaces.sql` (one
  `Workspace` + one `OWNER` membership per existing `Provider`, run
  after 001–007 — see `prisma/migrations_notes/README.md`). No existing
  row's behavior changes.
- `WorkspacesModule` (`apps/api/src/workspaces/`): list-mine (the
  workspace switcher's data source), get-context, update, list/invite/
  remove members, accept-invite, and role changes.
- `WorkspaceMembershipGuard` + `@WorkspaceRoles(...)`
  (`apps/api/src/common/`): backend-enforced, re-derives membership and
  role from the database on every request — never trusts a
  frontend-supplied workspace ID or role (spec §8).
- Role rules already enforced: only `OWNER`/`MANAGER` can invite or
  remove members; only `OWNER` can change a member's role; the `OWNER`
  membership itself can't be demoted or removed through these endpoints.
- Every membership/role change is audit-logged via the existing
  `AuditLogService`.
- Unit tests: `workspaces/workspaces.service.spec.ts`,
  `common/guards/workspace-membership.guard.spec.ts`.

**Known simplification**: `POST /workspaces/:id/members` only invites an
*existing* BII LocalFinder account by email — inviting someone with no
account yet (email-only invite + registration linking) isn't built. This
is a small, separate follow-up; it doesn't change the workspace/
membership model.

## What Phase 2 did NOT do yet (resolved in Phase 5, below)

A user could already be invited into workspaces they don't own, with an
enforced role (a business owner adding staff, a team owner adding
members). What was **not** yet possible at the end of Phase 2: one user
**owning** two independent workspaces of different types — e.g. a
plumber's individual workspace *and* a separate cleaning-business
workspace — because `Provider.userId` was still `@unique`. **This is
done now — see "Phase 5" at the bottom of this doc.** The plan below is
kept as a record of what Phase 5 actually did.

Enabling that requires, in one coordinated change:

1. Drop `@unique` on `Provider.userId`; keep `Provider.workspaceId
   @unique` as the real identity key.
2. Move every `prisma.provider.findUnique({ where: { userId } })` call
   site to resolve the provider via workspace context instead (an
   `x-workspace-id` header or route param, checked against
   `WorkspaceMembership`). Known call sites as of this change:
   - `providers/providers.service.ts`
   - `verification/verification.service.ts`
   - `service-requests/service-requests.service.ts`
   - `quotes/quotes.service.ts` (multiple)
   - `reviews/reviews.service.ts` (multiple)
   - `service-offerings/service-offerings.service.ts`
   - `portfolio/portfolio.service.ts`
   - (a full `grep -rn "provider.findUnique({ where: { userId" apps/api/src`
     will turn up any added since)
3. Add a "create workspace" endpoint (`POST /workspaces`) that creates a
   new `Provider` + `Workspace` + `OWNER` membership for an already-
   registered user, gated by the entitlements added in the subscription-
   engine phase.
4. Extend the four type-specific dashboards (Phase 3 of the original
   brief) and the subscription/entitlement engine (Phase 4) on top of
   this foundation.

## Environment note

This change could not be validated against a live database or a
regenerated Prisma client in the environment it was written in (no
network access to `binaries.prisma.sh` to fetch Prisma's query/schema
engine). Before relying on this:

```bash
cd apps/api
npx prisma generate
psql "$DATABASE_URL" -f prisma/manual-sql/008_workspaces.sql
npm test
```

The pre-existing test suite already fails identically (stale generated
client) in the sandboxed environment this was authored in — every test
that *did* run, including the new workspace tests, passed.

## Phase 3 — the four dashboard experiences

Delivered under `apps/web/app/dashboard/`:

- **Shared shell** (`[workspaceId]/layout.tsx`): workspace switcher +
  type-specific nav, wrapping every workspace page — one shell, not four
  apps (spec §6). Nav config lives in `lib/workspace-nav.ts`, mapped per
  `WorkspaceType`; most items link to pages that already existed
  (services, requests, bookings, availability, reviews, verification,
  analytics) — this is what makes them reachable per type, not a rebuild.
- **Type-specific overview** (`[workspaceId]/page.tsx`): one component,
  tailored per type by what it fetches and which extra card it shows
  (member/staff count for Team/Business, managed-provider count for
  Agency) — reuses the existing provider-insights endpoint rather than
  adding new aggregation endpoints (that's Phase 4/5 analytics work).
- **Members page** (`[workspaceId]/members/page.tsx`): invite (by email,
  existing accounts only — see the Phase 2 simplification above), role
  change, and removal, calling the Phase 2 `workspacesApi` directly. Used
  by TEAM ("Members") and BUSINESS ("Staff & Permissions").
- **Managed-providers page** (`[workspaceId]/managed-providers/page.tsx`,
  AGENCY only): reuses the *pre-existing* `ProviderTeamMember` roster
  (`providerOnboardingApi.listTeamMembers/addTeamMember/removeTeamMember`)
  rather than building a new one. This is deliberately a **different**
  concept from the Members page above: a roster of provider businesses
  the agency represents, not people who can log into the agency's own
  dashboard. Reconciling or merging these two rosters into one mental
  model is a reasonable later cleanup, not required for either to work.
- **Dashboard entry point** (`dashboard/page.tsx`): redirects into the
  user's first ACTIVE workspace, or — new in this phase — shows pending
  invitations with an Accept action if the user has none active yet
  (`WorkspacesService.listMine` now returns `INVITED` rows too, not just
  `ACTIVE`, specifically so an invitee has somewhere to discover and
  accept an invite before `WorkspaceMembershipGuard` will let them
  through to anything else).

**Verified**: `npx tsc --noEmit` across the whole web app passes clean;
the Phase 2 API unit tests still pass after the `listMine` change.

**Not built in this phase** (left for Phase 4/5 of the original brief,
or explicitly out of scope per the option-1 decision):
- Type-specific subscription plans and the entitlement engine (§7).
- New aggregation/analytics endpoints — the overview page reuses what
  already exists rather than inventing new backend stats.
- "Job Assignments" / "Team Calendar" / "Customer Management" as their
  own pages — the brief's spec lists these, but nothing on the backend
  models job-assignment-to-member yet; adding that is real product work,
  not a rewiring task, so it wasn't invented here.
- A `POST /workspaces` "create a second workspace" flow — still blocked
  on the Phase 3 (workspace-foundation) TODO above, dropping
  `Provider.userId`'s uniqueness constraint.

## Phase 4 — type-specific plans + entitlement enforcement

Delivered under `apps/api/src/subscriptions/`:

- **Schema**: `SubscriptionPlan.workspaceType` (required — every plan
  targets exactly one of the four types), `maxTeamMembers`,
  `maxManagedProviders`. Migration in `009_subscription_entitlements.sql`,
  backfills existing plans to `INDIVIDUAL` without touching any live
  subscription.
- **Seed data**: replaced the 3 generic plans with 12 (FREE/STANDARD/PRO
  × 4 types), matching the brief's illustrative structure — seed values,
  not final business rules, editable via the existing admin plan
  endpoints.
- **`EntitlementsService`** (new): the "centralized subscription and
  entitlement system" spec §7 asks for. `getEffectivePlan` resolves a
  provider's active-subscription plan or their type's FREE plan — never
  an unbounded fallback. `assertCanAdd(provider, resource)` is the single
  enforcement point for services, portfolio items, team members, and
  managed providers; `assertPlanMatchesType` blocks subscribing to a plan
  meant for a different workspace type, server-side, not just filtered
  out of the UI.
- **Replaced two pre-existing hardcoded checks**
  (`service-offerings.service.ts`, `portfolio.service.ts`, both marked
  with `TODO(subscriptions)`/`TODO(Phase 7)` before this) with real calls
  into the engine.
- **New caps wired in**: `maxTeamMembers` on workspace invites
  (`workspaces.service.ts`, Team/Business), `maxManagedProviders` on the
  agency roster endpoint (`providers.service.ts`, AGENCY only — Team's
  legacy roster is deliberately left uncapped, since it's a different,
  pre-workspace concept; see the Phase 3 section above).
- **Downgrade handling**: satisfied for free, by construction —
  `assertCanAdd` only blocks *new* additions once at/over the limit; it
  never touches existing rows, so a downgrade can never delete data
  (spec §7).
- **Frontend**: `/dashboard/[workspaceId]/billing` — current plan, usage
  vs. limits, a plan picker (pre-filtered to the workspace's own type),
  subscribe/cancel. Added to every type's nav.

**Verified**: `npx tsc --noEmit` passes clean across the whole web app.
On the API side, this sandbox's generated Prisma client is a near-empty
stub (network access to `binaries.prisma.sh` was never available here,
even before this project started — confirmed by pre-existing,
unrelated files failing to type-check the same way), so `jest`/`tsc`
could not be run end-to-end for the new Prisma-typed code; verified by
brace/paren balance checks and manual review instead. Run
`npx prisma generate && npm test` in a networked environment before
relying on this phase.

**Not built in this phase**: `maxMonthlyRequests` is resolvable through
the engine but not enforced anywhere new — no existing call site defines
what "a monthly request" means for enforcement purposes (client-created
request vs. provider-received one), and inventing that product rule
un-reviewed felt riskier than leaving it configurable-but-unenforced
until a real decision is made. Also out of scope: real payment-gateway
wiring (the existing mock/MTN/Airtel/card provider abstraction is
untouched), and admin UI for managing the 12 seeded plans (the API
endpoints exist; no frontend admin screen was built).

## Phase 5 — Provider.userId uniqueness dropped; a user can now own two workspaces

This is the change every earlier phase's "Phase 3 TODO" pointed at:
`Provider.userId` is no longer `@unique` (migration
`010_provider_multi_ownership.sql`). `Provider.workspaceId` (unique since
Phase 2) is the real 1:1 identity key now.

- **`ProviderContextService`** (new, global module —
  `providers/provider-context.service.ts`): replaces every
  `prisma.provider.findUnique({ where: { userId } })` in the codebase
  (18 call sites across `providers`, `verification`, `service-requests`,
  `quotes`, `reviews`, `service-offerings`, `portfolio`, `subscriptions`,
  `messaging`, `bookings`, `availability` — Prisma's `findUnique`
  requires a unique field, so once `userId` stopped being one, every one
  of these was a compile error waiting to happen with a real client, not
  an optional cleanup). Three methods, matched to what each call site
  actually needed:
  - `resolveForUser(userId)` — "the provider acting for this request."
    Identical result to the old lookup for every account that predates
    this change (one workspace, unambiguous); throws a clear error
    instead of guessing for an account with more than one.
  - `userHasAccessToProvider(userId, providerId)` — participant checks
    (quotes/reviews/requests/bookings) that already know *which*
    provider they're asking about; correct even for a multi-workspace
    user, since it doesn't need to pick one.
  - `getProviderIdsForUser(userId)` — "across every provider this user
    can act as" list/OR queries (conversations, a provider's own
    booking list); never throws, just returns however many providers
    there are.
- **`POST /workspaces`** (`WorkspacesService.create`): the actual
  feature — creates a Workspace + Provider + OWNER membership together,
  in one transaction, already-complete (`onboardingStep: 'COMPLETED'`)
  rather than routed through the step-by-step onboarding flow, since an
  owner adding a second workspace already knows the platform. Immediately
  usable through everything Phases 2-4 built (switcher, overview,
  members, billing).
- **Fixed a real bug this change would otherwise have introduced**:
  registration (`auth.service.ts`) was creating a bare `Provider` row
  with no `Workspace` at all — would have violated Phase 2's `NOT NULL`
  constraint on `Provider.workspaceId` for every new PROVIDER signup
  going forward. Rewrote it as one transaction (User → Workspace →
  Provider → OWNER membership), covered by a new test.
- `User.provider` → `User.providers[]` in the schema (confirmed nothing
  in the codebase read the old singular relation before renaming it).

**Known, intentional limit**: this makes owning a second workspace
*possible* and makes every endpoint *safe* (correct for single-workspace
accounts, loud instead of wrong for multi-workspace ones) — it does not
make every endpoint *workspace-aware*. A user with two workspaces will
get a clear "doesn't support choosing one yet" error from
`resolveForUser`-based endpoints (onboarding, single-provider profile
edits, subscriptions) until each is upgraded to read an explicit
workspace id (a header or route param, checked against
`WorkspaceMembership` — the mechanism `ProviderContextService` was built
to slot under). That upgrade is real, incremental product work
per-endpoint, not a foundational blocker anymore — this phase's job was
removing the blocker and making sure nothing breaks or behaves
ambiguously in the meantime, not finishing every endpoint's UI for it.

**Verified**: full `npx jest` run — 32 tests passed (0 failed) across
every suite that could compile; the other suites fail identically to
every phase before this one, for the same pre-existing reason (this
sandbox's Prisma client was never generated with real network access —
confirmed again here by files this phase never touched, like
`categories.service.ts` and `bookings/booking-state-machine.ts`, failing
the exact same way). `auth.service.spec.ts` and `workspaces.service.spec.ts`
— the two files carrying this phase's riskiest logic (the registration
transaction, the workspace-creation transaction) — both compiled and
passed in full. Run `npx prisma generate && npm test` in a networked
environment for a complete signal.
