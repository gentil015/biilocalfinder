import { DisputeStatus } from '@prisma/client';

// The graph behind the spec §14 flow. OPEN -> RESPONDED happens
// automatically (DisputesService.addMessage, on the respondent's first
// reply) rather than being a status an admin sets by hand. An admin can
// pull a dispute into review from either OPEN or RESPONDED — a
// slow-to-reply respondent shouldn't be able to stall a dispute forever.
const ALLOWED: Record<DisputeStatus, DisputeStatus[]> = {
  OPEN: ['RESPONDED', 'UNDER_REVIEW'],
  RESPONDED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};

export function canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function isOpenForActivity(status: DisputeStatus): boolean {
  return status === 'OPEN' || status === 'RESPONDED' || status === 'UNDER_REVIEW';
}
