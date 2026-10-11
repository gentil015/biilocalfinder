import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Every sensitive admin action goes through here (spec §45): "Admin
// verified provider", "Admin suspended user", "Admin changed subscription
// plan", "Admin resolved dispute", etc.
@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(actorId: string, action: string, entity: string, entityId?: string, metadata?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entity, entityId, metadata: metadata as any },
    });
  }
}
