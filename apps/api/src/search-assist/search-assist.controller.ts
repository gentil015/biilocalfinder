import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { SearchAssistService } from './search-assist.service';
import { ParseSearchDto } from './dto/parse-search.dto';

@ApiTags('search-assist')
@Controller('search-assist')
export class SearchAssistController {
  constructor(private searchAssistService: SearchAssistService) {}

  // No auth guard: natural-language search sits on the same public surface
  // as GET /api/search/providers (anonymous visitors on the landing page
  // must be able to try it). The cost is bounded instead by a tight
  // per-IP throttle — every call fans out to a paid external AI request,
  // so 6/min is deliberately below the app-wide 100/min default.
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('parse')
  parse(@Body() dto: ParseSearchDto) {
    return this.searchAssistService.parse(dto);
  }
}
