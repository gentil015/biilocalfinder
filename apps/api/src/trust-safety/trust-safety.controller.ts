import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RiskAssessmentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateFraudReportDto,
  CreateProviderFraudReportDto,
  CreateProviderVerificationCheckDto,
  CreateRestrictionDto,
  CreateSecurityEventDto,
  LiftRestrictionDto,
  ListAppealsDto,
  ListTrustRecordsDto,
  ReviewAppealDto,
  RestrictionAppealDto,
  ReviewRiskAssessmentDto,
  UpdateFraudReportDto,
  UpdateFraudRuleDto,
} from './dto/trust-safety.dto';
import { TrustSafetyService } from './trust-safety.service';
import { ProviderFraudDetectionService } from './provider-fraud-detection.service';

@ApiTags('trust')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trust')
export class TrustController {
  constructor(private readonly trustSafety: TrustSafetyService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('events')
  recordEvent(@CurrentUser() user: { id: string }, @Body() dto: CreateSecurityEventDto) {
    return this.trustSafety.recordEvent(user.id, dto.eventType, dto.dedupeKey);
  }

  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post('reports')
  createReport(@CurrentUser() user: { id: string }, @Body() dto: CreateFraudReportDto) {
    return this.trustSafety.createReport(user.id, dto);
  }

  @Get('reports/mine')
  reportsFiledBy(@CurrentUser() user: { id: string }) {
    return this.trustSafety.reportsFiledBy(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post('reports/providers/:providerId')
  createProviderReport(
    @CurrentUser() user: { id: string },
    @Param('providerId') providerId: string,
    @Body() dto: CreateProviderFraudReportDto,
  ) {
    return this.trustSafety.createProviderReport(user.id, providerId, dto);
  }

  @Get('restrictions/mine')
  myRestrictions(@CurrentUser() user: { id: string }) {
    return this.trustSafety.myRestrictions(user.id);
  }

  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @Post('restrictions/:id/appeals')
  appealRestriction(
    @CurrentUser() user: { id: string },
    @Param('id') restrictionId: string,
    @Body() dto: RestrictionAppealDto,
  ) {
    return this.trustSafety.appealRestriction(user.id, restrictionId, dto.reason);
  }
}

@ApiTags('trust-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('trust/admin')
export class AdminTrustController {
  constructor(
    private readonly trustSafety: TrustSafetyService,
    private readonly providerFraudDetection: ProviderFraudDetectionService,
  ) {}

  @Get('overview')
  overview() {
    return this.trustSafety.overview();
  }

  @Get('flagged-accounts')
  flaggedAccounts(@Query() query: ListTrustRecordsDto) {
    return this.trustSafety.flaggedAccounts(query);
  }

  @Get('accounts/:userId')
  accountDetails(@Param('userId') userId: string) {
    return this.trustSafety.accountDetails(userId);
  }

  @Get('assessments/:id')
  assessment(@Param('id') assessmentId: string) {
    return this.trustSafety.assessment(assessmentId);
  }

  @Post('reassess/:userId')
  reassess(@CurrentUser() admin: { id: string }, @Param('userId') userId: string) {
    return this.trustSafety.reassess(userId, admin.id);
  }

  @Post('accounts/:userId/provider-checks')
  recordProviderCheck(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
    @Body() dto: CreateProviderVerificationCheckDto,
  ) {
    return this.trustSafety.recordProviderCheck(admin.id, userId, dto);
  }

  @Post('accounts/:userId/provider-screening')
  screenProvider(
    @CurrentUser() admin: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.providerFraudDetection.screenUser(userId, 'admin_manual', admin.id);
  }

  @Post('assessments/:id/review')
  reviewAssessment(
    @CurrentUser() admin: { id: string },
    @Param('id') assessmentId: string,
    @Body() dto: ReviewRiskAssessmentDto,
  ) {
    return this.trustSafety.reviewAssessment(admin.id, assessmentId, dto.status, dto.note);
  }

  @Get('reports')
  reports(@Query() query: ListTrustRecordsDto) {
    return this.trustSafety.reports(query);
  }

  @Patch('reports/:id')
  updateReport(
    @CurrentUser() admin: { id: string },
    @Param('id') reportId: string,
    @Body() dto: UpdateFraudReportDto,
  ) {
    return this.trustSafety.updateReport(admin.id, reportId, dto.status, dto.resolution);
  }

  @Post('restrictions')
  createRestriction(@CurrentUser() admin: { id: string }, @Body() dto: CreateRestrictionDto) {
    return this.trustSafety.createRestriction(admin.id, dto);
  }

  @Patch('restrictions/:id/lift')
  liftRestriction(
    @CurrentUser() admin: { id: string },
    @Param('id') restrictionId: string,
    @Body() dto: LiftRestrictionDto,
  ) {
    return this.trustSafety.liftRestriction(admin.id, restrictionId, dto.reason);
  }

  @Get('appeals')
  appeals(@Query() query: ListAppealsDto) {
    return this.trustSafety.listAppeals(query);
  }

  @Patch('appeals/:id')
  reviewAppeal(
    @CurrentUser() admin: { id: string },
    @Param('id') appealId: string,
    @Body() dto: ReviewAppealDto,
  ) {
    return this.trustSafety.reviewAppeal(admin.id, appealId, dto.status, dto.decisionNote);
  }

  @Get('audit-logs')
  auditLogs(@Query() query: ListTrustRecordsDto) {
    return this.trustSafety.auditLogs(query);
  }

  @Get('rules')
  rules() {
    return this.trustSafety.rules();
  }

  @Patch('rules/:code')
  updateRule(
    @CurrentUser() admin: { id: string },
    @Param('code') code: string,
    @Body() dto: UpdateFraudRuleDto,
  ) {
    return this.trustSafety.updateRule(admin.id, code, dto);
  }
}
