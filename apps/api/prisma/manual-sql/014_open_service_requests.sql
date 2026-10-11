-- 014: Clients can open a direct (pinned) request to the marketplace.
--
-- Additive only: a single nullable-free boolean column on service_requests.
-- Nothing existing is altered or dropped, so this is safe on a live database.
--
-- Why this exists: a request sent to one provider is private to that
-- provider by design (providerId is the governance flag). But when
-- negotiating with that provider stalls, the client has no way to invite
-- competing quotes. This column is the client-controlled opt-in: isPublic
-- opens a *direct* request so other matching providers can also see it and
-- quote, while the pinned provider stays the primary participant and quote
-- amounts stay hidden from rival providers (the client — and the pinned
-- provider — still see everything). Broadcast requests (providerId IS NULL)
-- are already public by construction and ignore this flag.
--
-- Idempotent: re-running is a no-op.

ALTER TABLE "service_requests"
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;