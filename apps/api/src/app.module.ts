import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProvidersModule } from './providers/providers.module';
import { ProviderContextModule } from './providers/provider-context.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { CategoriesModule } from './categories/categories.module';
import { ServicesModule } from './services/services.module';
import { ServiceOfferingsModule } from './service-offerings/service-offerings.module';
import { LocationsModule } from './locations/locations.module';
import { SearchModule } from './search/search.module';
import { ServiceRequestsModule } from './service-requests/service-requests.module';
import { QuotesModule } from './quotes/quotes.module';
import { BookingsModule } from './bookings/bookings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProviderApplicationsModule } from './provider-applications/provider-applications.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FilesModule } from './files/files.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ReportsModule } from './reports/reports.module';
import { VerificationModule } from './verification/verification.module';
import { AvailabilityModule } from './availability/availability.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { DisputesModule } from './disputes/disputes.module';
import { AdminModule } from './admin/admin.module';
import { PersonalizationModule } from './personalization/personalization.module';
import { RequestAssistModule } from './request-assist/request-assist.module';
import { BookingAssistModule } from './booking-assist/booking-assist.module';
import { SearchAssistModule } from './search-assist/search-assist.module';
import { CustomerAssistModule } from './customer-assist/customer-assist.module';

function parseRedisUrl(url: string) {
  const u = new URL(url);
  // `rediss://` means TLS (managed providers like Upstash are TLS-only);
  // dropping it would send plaintext to a TLS port and fail.
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: decodeURIComponent(u.password) || undefined,
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({ connection: parseRedisUrl(process.env.REDIS_URL ?? 'redis://localhost:6379') }),
    PrismaModule,
    CommonModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    // Phase 2
    ClientsModule,
    ProviderContextModule,
    ProvidersModule,
    WorkspacesModule,
    CategoriesModule,
    ServicesModule,
    ServiceOfferingsModule,
    // Phase 3
    LocationsModule,
    SearchModule,
    // Phase 4
    ServiceRequestsModule,
    QuotesModule,
    BookingsModule,
    // Phase 5
    MessagingModule,
    NotificationsModule,
    // "Become a provider": client applies, admin approves, same account is
    // upgraded in place rather than re-registering.
    ProviderApplicationsModule,
    // Phase 6
    PortfolioModule,
    ReviewsModule,
    FavoritesModule,
    FilesModule,
    // Phase 7
    SubscriptionsModule,
    // Phase 8 (reports/disputes ship with admin's moderation tools)
    ReportsModule,
    DisputesModule,
    AdminModule,
    VerificationModule,
    AvailabilityModule,
    SavedSearchesModule,
    // Personalization (V1, rule-based)
    PersonalizationModule,
    // AI-assisted request writing
    RequestAssistModule,
    // AI booking assistant (Gemini) — pre-fills the request/booking form
    BookingAssistModule,
    // AI natural-language search: parses a sentence into search filters
    SearchAssistModule,
    // AI marketplace navigation: "Ask BII Assistant" guides a client from a
    // plain-language question to the right service and real providers.
    CustomerAssistModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
