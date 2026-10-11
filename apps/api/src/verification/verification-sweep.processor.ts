import { Processor, WorkerHost } from '@nestjs/bullmq';
import { VERIFICATION_QUEUE } from './verification.constants';
import { VerificationService } from './verification.service';

// Runs once a day (scheduled in VerificationModule): flips lapsed approvals
// to EXPIRED — which also drops the provider's search boost/badge, since
// search filters on the denormalized Provider.verificationStatus — and sends
// "expires soon" reminders.
@Processor(VERIFICATION_QUEUE)
export class VerificationSweepProcessor extends WorkerHost {
  constructor(private verification: VerificationService) {
    super();
  }

  async process() {
    return this.verification.sweepExpired();
  }
}
