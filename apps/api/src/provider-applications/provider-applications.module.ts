import { Module } from '@nestjs/common';
import { AdminProviderApplicationsController, ProviderApplicationsController } from './provider-applications.controller';
import { ProviderApplicationsService } from './provider-applications.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrustSafetyModule } from '../trust-safety/trust-safety.module';

// NotificationsModule is the only import needed: AuditLogService comes from
// CommonModule, which is @Global() and so needs no re-import here (this is why
// VerificationService can inject it without listing it either).
@Module({
  imports: [NotificationsModule, TrustSafetyModule],
  controllers: [ProviderApplicationsController, AdminProviderApplicationsController],
  providers: [ProviderApplicationsService],
  exports: [ProviderApplicationsService],
})
export class ProviderApplicationsModule {}