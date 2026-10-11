import { Injectable, NotImplementedException } from '@nestjs/common';
import { ChargeParams, ChargeResult, PaymentProvider } from '../payment-provider.interface';

// Real integration point for a card processor (Stripe, Flutterwave, etc.).
@Injectable()
export class CardPaymentProvider implements PaymentProvider {
  async charge(_params: ChargeParams): Promise<ChargeResult> {
    throw new NotImplementedException('Card payments are not yet configured');
  }
}
