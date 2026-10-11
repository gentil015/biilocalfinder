import { Injectable, NotImplementedException } from '@nestjs/common';
import { ChargeParams, ChargeResult, PaymentProvider } from '../payment-provider.interface';

// Real integration point for MTN Mobile Money. Wire up the MTN MoMo API
// (collections/disbursements) here — the rest of the app never changes,
// since callers only depend on PaymentProvider.
@Injectable()
export class MtnMomoPaymentProvider implements PaymentProvider {
  async charge(_params: ChargeParams): Promise<ChargeResult> {
    throw new NotImplementedException('MTN MoMo integration is not yet configured');
  }
}
