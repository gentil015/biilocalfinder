# Bii Localfinder Terms — implementation and owner review

**Assessment date:** 8 November 2026
**Terms draft:** version 1.0, effective 8 November 2026
**Status:** Implemented in code; not approved for production legal use. The owner and qualified Rwandan counsel must review and approve the draft and the pending decisions below.

## 1. Platform assessment from code

Bii Localfinder is a Next.js web app backed by a NestJS REST API and PostgreSQL/Prisma. The app has separate client and provider roles, provider workspaces, public provider profiles, service requests, structured quotes and negotiation, messaging, bookings, reviews, provider verification, subscriptions, reports, disputes, notifications, and account settings.

| Area | Finding |
|---|---|
| Client/provider accounts | **Implemented.** Public registration accepts `CLIENT` and `PROVIDER`; client profiles are created on client signup. A provider signup creates a provider/workspace and continues through onboarding. Existing clients also have a “become a provider” application path with administrator review. Admin accounts cannot self-register. |
| Authentication and account access | **Implemented.** Passwords are hashed; auth uses access/refresh tokens and cookies. Login rejects inactive or actively suspended accounts. Account export and deletion/anonymization flows exist. |
| Provider onboarding and discovery | **Implemented.** Providers manage profiles, services, prices, coverage, availability, portfolio and professional history. Public discovery hides incomplete profiles and profiles subject to visibility restrictions. Public location data is rounded; exact address/full precision is omitted from the public profile response. |
| Provider verification | **Implemented.** Providers submit identity, business or service-offering verification records and supporting documents. Documents are private and reviewed by administrators; records can be approved, rejected, suspended, renewed and expired. Identity badge status depends on a live approved identity record and verified phone; business verification is separate. A submitted document is not approval. |
| Requests, quotes and bookings | **Implemented.** Clients can create private/direct, client-opened or broadcast requests. Providers submit structured quotes; parties can negotiate revisions; a client accepting a pending quote creates an `ACCEPTED` booking. Either party can confirm; providers progress work and mark completion. Current cancellation transitions stop before work is in progress. No distinct rescheduling feature exists. |
| Payments and monetization | **Split implementation.** Client-to-provider service payments are expressly direct and are not processed by the marketplace; no commission on those payments is implemented. Provider subscriptions are implemented with admin-managed plans, billing intervals, entitlements and transaction records. The default payment provider is a mock; other providers are integration points, not proof that all real payment rails are live. Subscription cancellation exists. No general subscription refund policy is implemented. |
| Notifications and communication | **Implemented.** In-app messaging, notifications and booking reminders exist. A client/provider can communicate about a service request and booking. |
| Reviews | **Implemented with moderation.** Only a client on a completed booking can review it, once, within the review window. Administrators can hide/restore reviews. Published reviews affect public ratings. |
| Reports, disputes and restrictions | **Partially implemented.** Users can report accounts/providers. Booking participants can open disputes, exchange messages/evidence, and administrators can review and resolve them. Administrators can restrict visibility, bookings or accounts, and suspend verification. The API supports appeals for active restrictions, but the web interface has no dedicated appeal form. |
| Privacy controls | **Partially implemented.** Users can update account information, export data and request deletion/anonymization. Verification documents are private and administrator access is audited. AI search and assistance features may send prompts and feature-specific context (including request photos, search coordinates, recent conversation history, or limited account/workspace records) to Anthropic, Groq or Google Gemini, depending on the configured feature/provider; otherwise a local mock is used. Some text is pattern-redacted, but this is not comprehensive and does not redact images. The web client sets `consentToProcess: true` automatically rather than asking separately for each AI feature. There is no published Privacy Policy, no documented retention schedule, and no configured general support/contact channel. |
| Localization | **Implemented for the interface.** English and Kinyarwanda catalogs exist; the selected language is stored on a signed-in account. The Terms page has an on-page language switch and both draft texts. Legal Kinyarwanda needs professional validation. |

### Existing backend rules and responsibility split

- **Platform responsibilities represented by code:** provide discovery/request/quote/booking and messaging tools; record provider verification decisions; administer reports, review moderation, disputes and account restrictions; manage subscription plans and subscription transactions; provide current account export/deletion controls.
- **Client responsibilities:** submit accurate requests; assess quotes and providers; agree scope, price, materials, timing and service-payment arrangements with the provider; communicate respectfully; cancel only through available booking transitions; review only a genuine completed booking.
- **Provider responsibilities:** maintain accurate profile/service/price/coverage details; provide honest quotes; perform agreed work and communicate about changes; hold any qualifications and authorizations required for their particular work.
- **Platform role:** the code implements a connection marketplace rather than an employer, service contractor, escrow or processor for client-to-provider service payments. Verification is a limited, time-bound check and is not a service-quality or safety guarantee.

## 2. Implemented Terms and user interface

The public [Terms page](../apps/web/app/terms/page.tsx) contains 17 numbered sections, a responsive table of contents, version/effective/updated dates, an English/Kinyarwanda switch, and prominent notices that the text and Kinyarwanda translation require review. The page and registration form use the existing translation catalogs.

The draft follows the implemented request/quote/booking and verification workflows, states that service payments are direct, describes the separate provider-subscription feature without inventing a refund rule, and describes reporting, moderation, appeal limitations, privacy, user content and the marketplace’s limited role. It identifies Rwanda as the intended governing law/jurisdiction subject to counsel confirmation and calls out Law No. 058/2021 relating to personal-data protection and privacy for legal review. It does not state that the product is compliant or invent a legal entity, registered address or registration number.

**Privacy notice:** no separate Privacy Policy existed in the inspected code. The Terms do not purport to replace one; the page/footer disclose that it is not yet published. No Privacy Policy was fabricated as part of this change.

**AI-processing disclosure:** the Terms now disclose the configured third-party AI providers and the types of data that may be sent by feature, the limits of text redaction, and the automatic consent flag used by the web client. This describes current code, not a finding that the consent mechanism or provider contracts satisfy legal requirements. The owner must approve a clear opt-in, vendor/processor disclosures, international transfer details, retention and deletion terms, and user controls before production use.

## 3. Acceptance, database and API changes

- Registration now shows an unchecked, required Terms checkbox with a link to the full page.
- `POST /api/auth/register` requires `termsAccepted: true` and the current Terms version. DTO validation and a service-level check reject missing, false or stale acceptance; the server does not trust browser validation.
- `TermsAcceptance` stores the user ID, document type, version, account role and database timestamp. It is created in the same transaction as the user account and provider/client setup. A unique constraint prevents duplicate acceptance records for the same user/document/version.
- No public API exposes acceptance records; there is no user/admin write endpoint to alter them. Existing users are not blocked or migrated into forced reacceptance.
- The new additive Prisma migration is `apps/api/prisma/migrations/20261108200000_add_terms_acceptances/migration.sql`. It has **not** been applied to any database in this implementation session. Deploy it through the project’s normal reviewed migration process before deploying the API.
- The active version is defined in both web and API source as `1.0`; keep the two constants synchronized. Preserve prior text and increment the version before any later change that needs an auditable historical acceptance.

## 4. Owner decisions required before production

1. **Legal identity and notice:** approve the name presented to users, identify the actual contracting entity (if any), and provide its approved service address and reliable support/privacy contact channel. Do not add company details until verified.
2. **Legal approval:** have qualified Rwandan counsel review enforceability, required disclosures, consumer rights, electronic acceptance, liability language, dispute language, applicable Rwanda law (including Law No. 058/2021), and both English and Kinyarwanda texts.
3. **Privacy Policy and data governance:** approve purposes, legal bases, recipients/processors (including Anthropic, Groq and Google Gemini where configured), public profile/contact fields, storage/transfer locations, security disclosures, retention/deletion rules, privacy-rights requests and a contact route. Decide whether AI features need an explicit opt-in; the web client currently sets `consentToProcess: true` automatically. Publish a separate Privacy Policy before treating this draft’s general data summary as a full notice.
4. **Subscription terms:** decide and publish plan-specific billing, renewal, cancellation timing, failed-payment/chargeback handling and refund rules. Confirm which payment providers are actually live. The current mock charge must not be presented as a live payment method.
5. **Account appeals and compromise:** provide a user-accessible appeal form/route and a documented compromised-account contact/recovery process. The restriction appeal endpoint exists, but the web UI does not.
6. **Booking policy:** decide how cancellations, late cancellations, provider no-shows, rescheduling, deposits, partially completed work and service refunds should be handled, especially because the current state machine does not permit cancelling once work is in progress.
7. **Provider eligibility and verification:** approve any eligibility rules, required licences/qualifications, verification scope, validity/renewal expectations and retention periods. No numeric age threshold or universal provider qualification rule was invented.
8. **Version changes:** decide when a change is material, what channels deliver notice, whether affected existing users must reaccept, and how the product will preserve and display each historical version. No existing-user reacceptance gate is currently implemented.

## 5. Exclusions and limitations

Not implemented or claimed by this change: a Privacy Policy, legal entity/contact information, payment/refund/commission rules beyond code-backed facts, subscription renewal policy, new age or provider eligibility rules, a provider quality/safety guarantee, a general customer-support channel, a web appeal workflow, an account-compromise route, an existing-user reacceptance migration, or a legal-compliance certification. Legal/commercial choices remain owner decisions rather than hardcoded assumptions.

## 6. Changes and quality checks

Implementation changes cover the Terms page and translation catalogs, registration UI and request payload, registration DTO/service validation, the Prisma schema and additive migration, and focused API tests. Existing account/login behavior is otherwise unchanged.

Validation results:

- Prisma schema validation passed; the API build completed successfully.
- Focused registration/authentication tests passed: 2 suites, 23 tests (`auth.service.spec.ts` and `email-normalisation.spec.ts`).
- The Next.js production build completed successfully. It reported six hook-dependency lint warnings in existing, unrelated files; no build/type errors were reported.
- Production-browser checks passed for the Terms page render, all 17 sections, the Kinyarwanda switch, section-anchor navigation, and no horizontal overflow at a 390px mobile viewport. Registration acceptance was initially unchecked; with all other required form fields valid, native form validation rejected missing Terms acceptance and passed after the checkbox was checked.
- `git diff --check` passed.

A database migration was not run against a live or development database. The complete repository test suite and authenticated/API end-to-end flows were not run as part of this focused validation.
