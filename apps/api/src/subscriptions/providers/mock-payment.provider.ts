import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ChargeParams, ChargeResult, PaymentProvider } from '../payment-provider.interface';

// Default provider (SUBSCRIPTION_PAYMENT_PROVIDER=mock) — always succeeds
// instantly, so the whole subscription flow works end-to-end in
// development without any real payment credentials.
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async charge(params: ChargeParams): Promise<ChargeResult> {
    return {
      status: 'SUCCEEDED',
      transactionReference: `mock_${crypto.randomUUID()}`,
    };
  }
}
