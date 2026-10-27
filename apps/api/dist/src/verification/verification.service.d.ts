import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { StorageService } from '../files/storage.interface';
import { ProviderContextService } from '../providers/provider-context.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { ApproveVerificationDto, ReinstateVerificationDto, VerificationQueueQueryDto, VerificationReasonDto } from './dto/admin-verification.dto';
type Db = Prisma.TransactionClient | PrismaService;
export declare class VerificationService {
    private prisma;
    private notifications;
    private auditLog;
    private storage;
    private providerContext;
    private readonly logger;
    constructor(prisma: PrismaService, notifications: NotificationsService, auditLog: AuditLogService, storage: StorageService, providerContext: ProviderContextService);
    recomputeProvider(db: Db, providerId: string, now?: Date): Promise<import("./verification-status").ProviderVerificationState>;
    recomputeForUser(userId: string): Promise<void>;
    private providerFor;
    uploadDocument(userId: string, file: Express.Multer.File | undefined): Promise<{
        storageKey: string;
        mimeType: import("./file-sniffer").SniffedMime;
        sizeBytes: number;
        originalName: string;
    }>;
    submit(userId: string, dto: SubmitVerificationDto, now?: Date): Promise<any>;
    myStatus(userId: string, now?: Date): Promise<{
        status: any;
        identityVerified: any;
        businessVerified: any;
        expiresAt: any;
        phoneVerified: any;
        emailVerified: any;
        hasPhone: boolean;
        nextSteps: string[];
        records: any;
        offerings: any;
    }>;
    private toProviderView;
    queue(query: VerificationQueueQueryDto): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
    }>;
    getForReview(id: string, adminId: string): Promise<any>;
    private loadForDecision;
    private assertTransition;
    approve(id: string, adminId: string, dto: ApproveVerificationDto, now?: Date): Promise<any>;
    reject(id: string, adminId: string, dto: VerificationReasonDto, now?: Date): Promise<any>;
    suspend(id: string, adminId: string, dto: VerificationReasonDto, now?: Date): Promise<any>;
    reinstate(id: string, adminId: string, dto: ReinstateVerificationDto, now?: Date): Promise<any>;
    sweepExpired(now?: Date): Promise<{
        expired: number;
        reminded: number;
    }>;
    private notifyProvider;
}
export {};
