-- DisputesService.findAllForAdmin filters by status, oldest first; the
-- participant-side findMine filters by raisedById/respondentId, both
-- already indexed via @@index in schema.prisma. This one supports the
-- one-open-dispute-per-booking check in DisputesService.create.
CREATE INDEX IF NOT EXISTS disputes_booking_open_status
  ON "disputes" ("bookingId", "status");
