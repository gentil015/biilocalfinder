import { NotificationCategory, NotificationType } from '@prisma/client';

// The single source of truth for which NotificationType falls under which
// NotificationCategory (see the enum's doc comment in schema.prisma for
// why categories exist at all — one settings row per category, not per
// exact type).
export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  NEW_SERVICE_REQUEST: 'QUOTES',
  NEW_QUOTE: 'QUOTES',
  QUOTE_ACCEPTED: 'QUOTES',
  QUOTE_REJECTED: 'QUOTES',
  QUOTE_UPDATED: 'QUOTES',
  NEW_MESSAGE: 'MESSAGES',
  BOOKING_CREATED: 'BOOKINGS',
  BOOKING_UPDATED: 'BOOKINGS',
  BOOKING_COMPLETED: 'BOOKINGS',
  BOOKING_REMINDER: 'BOOKINGS',
  DISPUTE_OPENED: 'BOOKINGS',
  DISPUTE_RESPONSE: 'BOOKINGS',
  DISPUTE_UNDER_REVIEW: 'BOOKINGS',
  DISPUTE_RESOLVED: 'BOOKINGS',
  NEW_REVIEW: 'REVIEWS',
  REVIEW_RESPONSE: 'REVIEWS',
  VERIFICATION_UPDATED: 'TRUST',
  VERIFICATION_EXPIRING: 'TRUST',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION',
  FAVORITE_PROVIDER_AVAILABLE: 'DISCOVERY',
  NEW_PROVIDER_MATCH: 'DISCOVERY',
};

// A category's human label + short description for the preferences screen.
export const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  QUOTES: { label: 'Requests & quotes', description: 'New quotes received and updates to ones you sent' },
  MESSAGES: { label: 'Messages', description: 'When a provider or client replies to you' },
  BOOKINGS: { label: 'Bookings', description: 'Confirmations, changes, and upcoming-booking reminders' },
  REVIEWS: { label: 'Reviews', description: 'New reviews and responses to yours' },
  TRUST: { label: 'Verification', description: 'Updates on your verification status' },
  SUBSCRIPTION: { label: 'Subscription', description: 'Billing and renewal reminders' },
  DISCOVERY: { label: 'Discovery', description: 'Favorite providers becoming available, matches for saved searches' },
};

// Applied when a user has no NotificationPreference row for a category yet
// — mirrors the schema's own column defaults so behavior is identical
// whether or not the row has been materialized.
export const DEFAULT_PREFERENCE = { inApp: true, push: true, email: false } as const;
