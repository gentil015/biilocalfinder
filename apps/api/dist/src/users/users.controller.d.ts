import { UsersService } from './users.service';
import { UpdateLocaleDto } from './dto/update-locale.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    me(user: {
        id: string;
    }): Promise<any>;
    updateMe(user: {
        id: string;
    }, dto: any): Promise<any>;
    updateLocale(user: {
        id: string;
    }, dto: UpdateLocaleDto): Promise<any>;
}
