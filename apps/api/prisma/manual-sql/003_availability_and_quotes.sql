-- Availability.@@unique([providerId, dayOfWeek]) and
-- AvailabilityException.@@unique([providerId, date]) are already expressed
-- in schema.prisma and created by `prisma migrate dev` — nothing manual
-- needed for those.
--
-- This file exists for the same reason as 001/002: fast lookups on the
-- hot paths added in this phase.

-- AvailabilityService.summariesForProviders() is called on every search
-- results page with N provider ids at once.
CREATE INDEX IF NOT EXISTS availability_exceptions_provider_date_range
  ON "availability_exceptions" ("providerId", "date");

-- QuotesService.findForRequest() and the request detail page always filter
-- by requestId, newest first.
CREATE INDEX IF NOT EXISTS quotes_request_created
  ON "quotes" ("requestId", "createdAt" DESC);
