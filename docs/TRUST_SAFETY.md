# Trust and safety

## Architecture and integration

The application is a modular monolith: Next.js 14 in `apps/web`, NestJS in
`apps/api`, Prisma against PostgreSQL. This implementation reuses the existing
JWT cookie authentication, `ADMIN` role guard, Prisma service, provider and
verification records, notification preferences, and append-only `AuditLog`.
It does not introduce a second user/provider/booking/authentication subsystem.

The existing provider workflow remains authoritative: `ProviderApplication`
has `PENDING`, `APPROVED`, and `REJECTED` states, and a provider remains subject
to manual administrator approval. Verification identity/business records keep
their existing `VerificationStatus`; automated risk scores are separate and
do not approve, reject, or suspend an applicant.

## Database rollout

The additive migration is
`apps/api/prisma/migrations/20261031220000_add_trust_safety/migration.sql`.
It creates the event, assessment, indicator, provider-check, report,
restriction, appeal, and rule tables; adds the related enum values; and adds
nullable document metadata. It does not delete or rewrite user or booking
records.

Before deploying the API code:

1. Back up the target database and verify the deployment environment.
2. Deploy the migration from `apps/api` with
   `./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma`.
3. Build and deploy the API and web application.

Do not run `prisma migrate dev` against production. The schema currently has
uncommitted additions in the working tree; review and commit those additions
with the migration that corresponds to them.

## API

All routes are under `/api`. Event/report/appeal routes require a signed-in
user. Every `/trust/admin/*` route requires a signed-in `ADMIN` account.

| Method | Route | Purpose |
|---|---|---|
| POST | `/trust/events` | Record an allowlisted user event; accepts an optional idempotency key |
| POST | `/trust/reports` | Submit a report against another account; max five per reporter per day and duplicate category reports are rejected |
| POST | `/trust/reports/providers/:providerId` | Submit a provider fraud report from the existing provider-profile report control |
| GET | `/trust/reports/mine` | View the caller's submitted trust reports |
| GET | `/trust/restrictions/mine` | View the caller's restrictions and appeals |
| POST | `/trust/restrictions/:id/appeals` | Appeal an active restriction |
| GET | `/trust/admin/overview` | Summary counts and recent events |
| GET | `/trust/admin/flagged-accounts?page=1&limit=25` | Paginated accounts with pending scores of at least 25 |
| GET | `/trust/admin/accounts/:userId` | Admin-only investigation details |
| GET | `/trust/admin/assessments/:id` | Admin-only score explanation |
| POST | `/trust/admin/reassess/:userId` | Recalculate and retain an assessment snapshot |
| POST | `/trust/admin/assessments/:id/review` | Record a human review, dismissal, or confirmed finding |
| POST | `/trust/admin/accounts/:userId/provider-checks` | Record a manual provider verification check and recalculate risk |
| GET/PATCH | `/trust/admin/reports` and `/trust/admin/reports/:id` | List and investigate reports |
| POST | `/trust/admin/restrictions` | Issue an administrator-approved restriction |
| PATCH | `/trust/admin/restrictions/:id/lift` | Lift an active restriction with an audit reason |
| GET/PATCH | `/trust/admin/appeals` and `/trust/admin/appeals/:id` | Review restriction appeals |
| GET | `/trust/admin/audit-logs` | Paginated trust-related administrative actions |
| GET/PATCH | `/trust/admin/rules` and `/trust/admin/rules/:code` | Read or change supported scoring rules |

DTO validation uses the existing global Nest validation pipe. Event and report
creation are rate limited. Report details, assessment indicators, and account
investigation data are not exposed through user-facing routes.

## Risk interpretation

Scores range from 0 to 100: LOW (0–24), MODERATE (25–49), HIGH (50–74), and
CRITICAL (75–100). The score is a prioritization aid, not a probability or
finding of fraud. Identical indicator codes are counted once in a single
assessment, each assessment is retained, and rule changes increment a version.

Currently evaluated evidence is intentionally narrow:

* An administrator-recorded `DUPLICATE_IDENTITY` verification check can add
  the configurable duplicate-identity contribution.
* An administrator-recorded identity/business/document inconsistency check
  can add the configurable inconsistency contribution.
* Three or more reports that an administrator escalated in the configured
  window can add the multiple-reports contribution.

The other initial rule definitions are configuration placeholders until their
signals have a trustworthy, privacy-reviewed source. In particular, this
implementation does not use shared IP addresses, devices, protected
characteristics, unverified reports, or user-supplied event types as proof of
fraud. No score automatically applies a restriction or changes verification
status.

## Restrictions and privacy

Temporary/permanent suspension blocks login and authenticated API requests
while an active restriction is in force. Booking restrictions are checked
when providers submit quotes and clients accept them. Provider visibility
restrictions are applied to public provider profiles, comparison, and search.
Expired restrictions are treated as inactive immediately and marked expired
when the account's restrictions are viewed. A successful appeal or admin lift
preserves the restriction record and records the actor/action.

The event API does not collect raw IP addresses, device IDs, user agents, OTPs,
passwords, document contents, or full identity numbers. Report submitters see
only their own restrictions; report/investigation details require admin
authorization.

## Verification and operational limits

Existing verification uploads already use file signature sniffing in
`apps/api/src/verification/file-sniffer.ts`; this change does not add a malware
scanner, document quarantine workflow, or new object-storage encryption
configuration. The schema's new scan status defaults to `SKIPPED` until an
actual scanner is integrated. Continue to keep identity documents in the
existing private storage path and do not expose storage keys or permanent
URLs.

There is no new external service or environment variable. Notifications are
not yet sent for trust events, restrictions, or appeals. MFA for admins,
automated event producers for login/profile/booking/review changes, durable
background scoring, scheduled retention/deletion, and a complete appeal UI
remain follow-up work. Provider checks must currently be recorded by an
administrator; an uploaded document alone is never treated as authenticity
evidence.

This implementation is not a legal-compliance certification. Review Rwanda's
Law No. 058/2021, registration obligations, impact assessment requirements,
cross-border transfers, retention periods, and the hosting/storage
jurisdictions with qualified privacy counsel before production use.
