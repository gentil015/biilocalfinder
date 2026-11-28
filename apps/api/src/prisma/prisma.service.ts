import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
const { PrismaClient } = require('@prisma/client');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      transactionOptions: { maxWait: 10_000, timeout: 30_000 },
    });
  }

  async onModuleInit() {
    const maxAttempts = Number(process.env.PRISMA_CONNECT_MAX_ATTEMPTS ?? 5);
    const baseDelayMs = Number(process.env.PRISMA_CONNECT_RETRY_DELAY_MS ?? 1000);
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) this.logger.log(`Database connected after ${attempt} attempts`);
        return;
      } catch (error) {
        lastError = error;
        const delayMs = baseDelayMs * attempt;
        this.logger.error(
          `Database connection attempt ${attempt}/${maxAttempts} failed: ${(error as Error).message}`,
        );
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
