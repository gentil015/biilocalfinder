import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './services/audit-log.service';
import { HealthController } from './health.controller';

@Global()
@Module({
  controllers: [HealthController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class CommonModule {}
