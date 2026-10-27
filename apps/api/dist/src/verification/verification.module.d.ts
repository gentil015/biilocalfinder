import { OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
export declare class VerificationModule implements OnModuleInit {
    private queue;
    private readonly logger;
    constructor(queue: Queue);
    onModuleInit(): Promise<void>;
}
