import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './services/audit-log.service';
import { HealthController } from './health.controller';
import { WorkspaceContextService } from './workspace/workspace-context.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [AuditLogService, WorkspaceContextService],
  exports: [AuditLogService, WorkspaceContextService],
})
export class CommonModule {}
