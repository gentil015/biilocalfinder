import { ContactChannel } from '@prisma/client';
import { OtpSender } from './otp-sender';
export declare class WaapiOtpSender implements OtpSender {
    private readonly logger;
    send(channel: ContactChannel, target: string, code: string): Promise<void>;
}
