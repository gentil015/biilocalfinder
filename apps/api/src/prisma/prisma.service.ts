import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Remote Postgres adds ~300ms per round trip, so Prisma's 5s interactive
    // transaction default is too tight for multi-statement transactions.
    super({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
