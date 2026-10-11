import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestAssistService } from './request-assist.service';
import { SuggestRequestDto } from './dto/suggest-request.dto';

@ApiTags('request-assist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('request-assist')
export class RequestAssistController {
  constructor(private requestAssistService: RequestAssistService) {}

  // Tighter than the app-wide 100/min default (app.module.ts) — this
  // endpoint fans out to a paid external AI call per request.
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Roles('CLIENT')
  @Post('suggest')
  suggest(@Body() dto: SuggestRequestDto) {
    return this.requestAssistService.suggest(dto);
  }
}
