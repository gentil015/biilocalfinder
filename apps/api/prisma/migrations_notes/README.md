# PostGIS geography column

Prisma doesn't model `geography(Point,4326)` natively, so it's added with a
plain SQL file rather than a Prisma migration (running it as a Prisma
migration would fail — it runs before Prisma has created the tables).

**Run once, after your first `prisma migrate dev`:**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/001_add_postgis.sql
```

That script:

1. Enables the extension: `CREATE EXTENSION IF NOT EXISTS postgis;`
2. Adds `geom geography(Point,4326)` to `locations` and `service_areas`.
3. Adds a trigger that keeps `geom` in sync with `latitude`/`longitude` on
   insert/update, so application code (Prisma) never touches `geom` directly.
4. Adds GiST indexes for fast radius/distance queries.

Radius/distance queries (in `src/search`) use `$queryRaw` with
`ST_DWithin` / `ST_Distance`, as required by the spec ("let
PostgreSQL/PostGIS perform geographic calculations") — never plain JS
haversine math.

# Multi-provider workspace layer

Same reasoning as 007: hand-authored SQL rather than `prisma migrate dev`,
since this repo has no committed migrations directory.

**Run once, after 001-007:**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/008_workspaces.sql
```

That script:

1. Creates `workspaces` and `workspace_memberships`.
2. Adds `providers."workspaceId"`.
3. Backfills one `Workspace` + one `OWNER` `WorkspaceMembership` per
   existing provider, then makes `providers."workspaceId"` `NOT NULL
   UNIQUE`.

See the `Workspace` model's doc comment in `schema.prisma` for the scope
and known limits of this phase (a user can already be invited into
workspaces they don't own with an enforced role, but can't yet *own* two
independent workspaces of different types — that's Phase 3).

# Type-specific subscription plans and entitlement enforcement (Phase 4)

**Run once, after 001-008:**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/009_subscription_entitlements.sql
```

Adds `subscription_plans."workspaceType"`, `"maxTeamMembers"`, and
`"maxManagedProviders"`; replaces the old global-unique `name` constraint
with `unique(workspaceType, name)`. Existing plans and subscriptions are
backfilled/left as-is — see `docs/WORKSPACES.md` for the entitlement
engine this unlocks.

# Provider multi-ownership (drops Provider.userId's uniqueness)

**Run once, after 001-009:**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/010_provider_multi_ownership.sql
```

Drops the `providers_userId_key` unique constraint (replaced with a plain
index) so a user can own more than one `Provider`/`Workspace`. No
existing row changes — see `docs/WORKSPACES.md` for what this unlocks and
`ProviderContextService` for how "the provider for this request" now
gets resolved.

# Case-insensitive email uniqueness

**Run once, after 001-010:**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/011_case_insensitive_email.sql
```

Adds a unique index on `lower(email)`. Prisma can't model a functional
(unique) index, hence the plain SQL file.

Without it, `users_email_key` is a case-sensitive B-tree on `TEXT`, so
`Dushimegentil0@Gmail.com` and `dushimegentil0@gmail.com` are two separate
accounts for one mailbox — and the duplicate pre-check in
`AuthService.register` can't see them either. The DTOs now normalise to
lowercase, so the app layer is correct on its own; this index makes the
*database* enforce it too, for any write path the DTOs don't cover.

It's additive on purpose: `users_email_key` stays because
`AuthService.login` uses `findUnique({ where: { email } })`, which resolves
against that named constraint.

The backfill **aborts** if two existing rows differ only by case, rather than
deleting one. Merging such a pair means moving bookings/messages/payouts
across by hand — do that deliberately, then re-run.

# pgvector embeddings column

Same reasoning as above: Prisma has no native `vector` type, so it's added
with a plain SQL file too.

**Run once, after 001-005 (and after your first `prisma migrate dev`):**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/006_add_pgvector.sql
```

That script:

1. Enables the extension: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Adds `embedding vector(512)`, `embeddingModel`, and `embeddingUpdatedAt`
   to `service_offerings`.
3. Adds an HNSW index for cosine-distance nearest-neighbor queries.

512 dimensions matches `voyage-3-lite` (see
`src/search/embedding/providers/voyage-embedding.provider.ts`). Switching
to a model with a different output size needs a follow-up migration to
change the column's dimension, and a full re-embed — old and new vectors
aren't comparable.

**Local Docker Postgres:** `infra/docker/postgres.Dockerfile` builds
`postgis/postgis:16-3.4` with `postgresql-16-pgvector` layered on top — the
stock image only has PostGIS. Both `docker-compose.yml` and
`docker-compose.prod.yml` build from it now instead of pulling
`postgis/postgis` directly.

**Managed/external Postgres (production):** if you swap the `postgres`
service in `docker-compose.prod.yml` for a managed database per that
file's own comment, confirm pgvector is available there too (RDS,
Supabase, Neon, and Cloud SQL all support it via a plain
`CREATE EXTENSION vector;`) before running this migration.

**Backfill:** `npm run embeddings:backfill` (in `apps/api`) embeds every
active offering that doesn't have one yet. New/edited offerings are
embedded automatically afterwards via `EmbeddingIndexService`, triggered
from `ServiceOfferingsService.create`/`update` and processed off the
request path by `EmbeddingIndexProcessor` (BullMQ). Without a
`VOYAGE_API_KEY` set, everything still runs —`MockEmbeddingProvider` is an
offline, deterministic (but NOT truly semantic) fallback so local dev, CI,
and this repo's build/test stay fully offline, matching
`MockAssistProvider`/`MockMapProvider`/`MockPaymentProvider`.

# Workspace/provider type + onboarding-step drift

`Provider.providerType`/`onboardingStep` and `Workspace.type`/`onboardingStep`
are the same facts about the same thing, stored on two rows — and they were
being written independently:

- `AuthService.register` creates the workspace with a hardcoded
  `type: 'INDIVIDUAL'` (the real type isn't known until the onboarding
  type-selection step) and never sets its `onboardingStep`.
- Each onboarding step advanced only the provider row.

So a provider who picked TEAM/BUSINESS/AGENCY and progressed kept a workspace
still saying `INDIVIDUAL` / `TYPE_SELECTION` — which is what
`components/workspace-switcher.tsx` renders.

**Fix (code):** `ProvidersService.applyOnboardingChange` now writes both rows
in one transaction, and `selectProviderType`, `updateOnboardingProfile`, and
`completeOnboarding` all route through it.

**Run once, to repair rows created before the fix:**

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/012_sync_workspace_provider_type.sql
```

That backfills `workspaces.type` from `providers."providerType"`. Note it does
**not** touch `workspaces.onboardingStep`: nothing read that column, so the
historical values are arbitrary, and the code now keeps it in sync going
forward. If you want it seeded correctly for existing rows, set each
workspace's step from its provider's:

```sql
UPDATE "workspaces" w
SET "onboardingStep" = p."onboardingStep"
FROM "providers" p
WHERE p."workspaceId" = w.id
  AND w."onboardingStep" IS DISTINCT FROM p."onboardingStep";
```

## 013 — Provider applications ("become a provider")

```bash
psql "$DATABASE_URL" -f prisma/manual-sql/013_provider_applications.sql
```

Additive only (new enum `ProviderApplicationStatus`, new table
`provider_applications`, its indexes). Nothing existing is altered.

**Why:** `/account`'s "Become a provider" link pointed at `/register`, so an
existing client trying to start trading created a **second `users` row** with a
second login. Their service requests, bookings, reviews and conversations stayed
on the client account — two logins for one person, with history split across
them. This table backs the fix: the client applies from their existing session,
an admin decides, and approval flips `users.role` to `PROVIDER` in place while
creating the Workspace/Provider/Membership rows the provider surfaces expect.

**Note on the partial unique index** `provider_applications_one_pending_per_user`
(`WHERE status = 'PENDING'`): it makes "one application in review at a time" a
database invariant rather than only a service-level check, so a double submit
from two browser tabs cannot queue two reviews. The service also maps the
`P2002` it raises into a 409. It is partial, so a rejected applicant can apply
again without tripping it.

**ClientProfile is deliberately not deleted on approval.** A provider can still
hire other providers, so they should keep their own request history — losing it
is the exact failure this feature exists to prevent.

`service_offerings.embedding*` shows as drift in `prisma migrate diff`; that is
pre-existing (pgvector, manual-sql/006) and unrelated.
