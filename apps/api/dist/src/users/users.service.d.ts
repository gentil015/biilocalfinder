import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { StorageService } from '../files/storage.interface';
import { VerificationService } from '../verification/verification.service';
export declare class UsersService {
    private prisma;
    private audit;
    private storage;
    private verification;
    private readonly logger;
    constructor(prisma: PrismaService, audit: AuditLogService, storage: StorageService, verification: VerificationService);
    findById(id: string): Promise<any>;
    updateMe(id: string, data: {
        phone?: string | null;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
    }): Promise<any>;
    updateLocale(id: string, locale: string): Promise<any>;
    exportMe(id: string): Promise<{
        exportedAt: string;
        formatVersion: number;
        user: any;
        personalization: {
            preference: any;
            interests: any;
            interactions: any;
            recommendations: any;
        };
    }>;
    deleteMe(id: string, password: string): Promise<{
        success: boolean;
    }>;
}
