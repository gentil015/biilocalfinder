import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AdminTrustController, TrustController } from './trust-safety.controller';
import { RiskScoringService } from './risk-scoring.service';
import { TrustSafetyService } from './trust-safety.service';

@Module({
  imports: [CommonModule],
  controllers: [TrustController, AdminTrustController],
  providers: [TrustSafetyService, RiskScoringService],
  exports: [TrustSafetyService],
})
export class TrustSafetyModule {}
