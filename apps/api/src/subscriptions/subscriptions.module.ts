import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { EntitlementsService } from './entitlements.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { MtnMomoPaymentProvider } from './providers/mtn-momo.provider';
import { AirtelMoneyPaymentProvider } from './providers/airtel-money.provider';
import { CardPaymentProvider } from './providers/card-payment.provider';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    EntitlementsService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        // SUBSCRIPTION_PAYMENT_PROVIDER selects the implementation; every
        // option implements the same PaymentProvider interface, so nothing
        // else in the app needs to change when a real provider goes live.
        switch (process.env.SUBSCRIPTION_PAYMENT_PROVIDER) {
          case 'mtn_momo':
            return new MtnMomoPaymentProvider();
          case 'airtel_money':
            return new AirtelMoneyPaymentProvider();
          case 'card':
            return new CardPaymentProvider();
          default:
            return new MockPaymentProvider();
        }
      },
    },
  ],
  exports: [SubscriptionsService, EntitlementsService],
})
export class SubscriptionsModule {}
