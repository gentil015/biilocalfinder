export interface ChargeResult {
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  transactionReference: string;
}

export interface ChargeParams {
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, unknown>;
}

// The only thing SubscriptionPaymentService depends on. Every concrete
// provider (mock, MTN MoMo, Airtel Money, card) implements just this one
// method — spec §4/§17: "Implement payment abstraction ONLY for provider
// subscriptions" and "Only subscription transactions use these services."
// This interface is never used for client-to-provider service payments.
export interface PaymentProvider {
  charge(params: ChargeParams): Promise<ChargeResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
