// Shared enums/types used by both apps/api and apps/web. Kept in sync
// manually for now; in a later phase this package can be built and
// imported directly instead of duplicated.

export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';

export type BookingStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export type PortfolioMediaType = 'IMAGE' | 'VIDEO';
export type BeforeAfterRole = 'BEFORE' | 'AFTER';
