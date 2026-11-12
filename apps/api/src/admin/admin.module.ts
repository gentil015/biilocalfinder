import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [VerificationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
