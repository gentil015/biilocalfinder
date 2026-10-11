import { Global, Module } from '@nestjs/common';
import { ProviderContextService } from './provider-context.service';

// @Global() so every module that resolves "the provider for this user"
// (verification, quotes, reviews, service-requests, service-offerings,
// portfolio, subscriptions, availability, providers itself) can inject
// ProviderContextService without adding this to each one's own imports
// array — mirrors CommonModule's pattern for AuditLogService. Kept as
// its own module rather than folded into ProvidersModule so the many
// consumers don't transitively pull in ProvidersModule's own
// dependencies (NotificationsModule, AvailabilityModule, ...).
@Global()
@Module({
  providers: [ProviderContextService],
  exports: [ProviderContextService],
})
export class ProviderContextModule {}
