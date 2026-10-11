import { Injectable, NotImplementedException } from '@nestjs/common';
import { ChargeParams, ChargeResult, PaymentProvider } from '../payment-provider.interface';

// Real integration point for Airtel Money.
@Injectable()
export class AirtelMoneyPaymentProvider implements PaymentProvider {
  async charge(_params: ChargeParams): Promise<ChargeResult> {
    throw new NotImplementedException('Airtel Money integration is not yet configured');
  }
}
