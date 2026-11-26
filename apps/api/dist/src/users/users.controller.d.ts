import { UsersService } from './users.service';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    me(user: {
        id: string;
    }): Promise<any>;
    updateMe(user: {
        id: string;
    }, dto: UpdateMeDto): Promise<any>;
    updateLocale(user: {
        id: string;
    }, dto: UpdateLocaleDto): Promise<any>;
    exportMe(user: {
        id: string;
    }): Promise<{
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
    deleteMe(user: {
        id: string;
    }, dto: DeleteAccountDto): Promise<{
        success: boolean;
    }>;
}
