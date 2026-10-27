import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findById(id: string): Promise<any>;
    updateMe(id: string, data: {
        phone?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
    }): Promise<any>;
    updateLocale(id: string, locale: string): Promise<any>;
}
