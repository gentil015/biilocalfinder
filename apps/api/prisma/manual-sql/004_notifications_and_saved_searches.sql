-- NotificationsProcessor writes one Notification row per channel-enabled
-- category on every dispatch; the bell/center always filters by userId and
-- orders by createdAt, and unread counts filter readAt IS NULL.
CREATE INDEX IF NOT EXISTS notifications_user_created
  ON "notifications" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON "notifications" ("userId")
  WHERE "readAt" IS NULL;

-- BookingReminderProcessor's hourly sweep filters exactly this triple.
CREATE INDEX IF NOT EXISTS bookings_confirmed_scheduled_unreminded
  ON "bookings" ("scheduledAt")
  WHERE "status" = 'CONFIRMED' AND "reminderSentAt" IS NULL;

-- SavedSearchSweepProcessor's daily job scans every active saved search.
CREATE INDEX IF NOT EXISTS saved_searches_active
  ON "saved_searches" ("isActive")
  WHERE "isActive" = true;
