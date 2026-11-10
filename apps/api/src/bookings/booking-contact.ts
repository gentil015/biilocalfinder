export const BOOKING_CONTACT_VISIBLE_STATUSES = [
  'ACCEPTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

export function bookingAllowsContact(status: string | null | undefined): boolean {
  return !!status && (BOOKING_CONTACT_VISIBLE_STATUSES as readonly string[]).includes(status);
}
