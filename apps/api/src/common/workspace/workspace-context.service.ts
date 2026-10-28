import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

export interface WorkspaceContext {
  userId: string;
  workspaceId: string;
  membershipId: string;
  role: WorkspaceMemberRole;
  providerId: string | null;
}

@Injectable()
export class WorkspaceContextService {
  private readonly storage = new AsyncLocalStorage<WorkspaceContext>();

  run<T>(context: WorkspaceContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): WorkspaceContext | undefined {
    return this.storage.getStore();
  }

  getForUser(userId: string): WorkspaceContext | undefined {
    const context = this.storage.getStore();
    return context?.userId === userId ? context : undefined;
  }
}
