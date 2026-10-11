import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

// A booking is created directly in ACCEPTED status once a client accepts a
// quote (the earlier REQUESTED/QUOTED/NEGOTIATING states describe the
// ServiceRequest/Quote lifecycle that precedes booking creation — see
// QuotesService.accept). From ACCEPTED onward, this is the only place that
// decides whether a transition is legal; controllers/services never
// mutate `status` directly.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ['QUOTED', 'CANCELLED'],
  QUOTED: ['NEGOTIATING', 'ACCEPTED', 'CANCELLED'],
  NEGOTIATING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// Who is allowed to *initiate* each transition. Backend-enforced per spec
// §25 ("Never rely only on frontend role checks").
const TRANSITION_ACTOR: Record<string, ('CLIENT' | 'PROVIDER')[]> = {
  'ACCEPTED->CONFIRMED': ['CLIENT', 'PROVIDER'],
  'CONFIRMED->IN_PROGRESS': ['PROVIDER'],
  'IN_PROGRESS->COMPLETED': ['PROVIDER'],
  'ACCEPTED->CANCELLED': ['CLIENT', 'PROVIDER'],
  'CONFIRMED->CANCELLED': ['CLIENT', 'PROVIDER'],
};

@Injectable()
export class BookingStateMachine {
  canTransition(from: BookingStatus, to: BookingStatus): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  actorAllowed(from: BookingStatus, to: BookingStatus, actor: 'CLIENT' | 'PROVIDER'): boolean {
    const allowed = TRANSITION_ACTOR[`${from}->${to}`];
    if (!allowed) return false;
    return allowed.includes(actor);
  }
}
