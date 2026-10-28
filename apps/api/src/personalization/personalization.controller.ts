import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PersonalizationService } from './personalization.service';
import { RecommendationService } from './recommendation/recommendation.service';
import { RankingConfigService } from './recommendation/ranking-config.service';
import { UpdateRankingWeightsDto } from './dto/update-ranking-weights.dto';
import { ProviderAnalyticsService } from './analytics/provider-analytics.service';

@ApiTags('personalization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personalization')
export class PersonalizationController {
  constructor(
    private personalizationService: PersonalizationService,
    private recommendationService: RecommendationService,
    private rankingConfig: RankingConfigService,
    private providerAnalyticsService: ProviderAnalyticsService,
  ) {}

  @Get('home')
  getHome(
    @CurrentUser() user: { id: string; firstName?: string },
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.personalizationService.getHome({
      userId: user.id,
      firstName: user.firstName ?? 'there',
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    });
  }

  @Get('providers')
  recommendProviders(
    @CurrentUser() user: { id: string },
    @Query('serviceId') serviceId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.recommendationService.recommendProviders({
      userId: user.id,
      serviceId,
      categoryId,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    });
  }

  @Get('services')
  recommendServices(@CurrentUser() user: { id: string }) {
    return this.recommendationService.recommendServices({ userId: user.id });
  }

  @Get('interests')
  interests(@CurrentUser() user: { id: string }) {
    return this.recommendationService.getInterestSummary(user.id);
  }

  // Provider dashboard insights (spec §14-15) — aggregated, never
  // exposing any individual client's identity or activity.
  @RequireWorkspacePermission('analytics.view')
  @Get('provider-insights')
  providerInsights(@CurrentUser() user: { id: string }) {
    return this.personalizationService.getProviderInsights(user.id);
  }

  // Provider analytics dashboard (spec §7): profile/service views, requests,
  // quotes sent, bookings, conversion, top searched + most viewed service.
  @RequireWorkspacePermission('analytics.view')
  @Get('provider-analytics')
  providerAnalytics(@CurrentUser() user: { id: string }) {
    return this.providerAnalyticsService.getMonthlySummary(user.id);
  }

  // --- Admin (spec §34) ---

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('admin/ranking-weights')
  getRankingWeights() {
    return this.rankingConfig.getWeights();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/ranking-weights')
  updateRankingWeights(@Body() dto: UpdateRankingWeightsDto) {
    return this.rankingConfig.updateWeights(dto);
  }
}
