import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
const { PrismaClient } = require('@prisma/client');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
