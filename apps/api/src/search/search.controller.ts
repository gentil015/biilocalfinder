import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PROVIDER_SEARCH_SERVICE, ProviderSearchService } from './provider-search.interface';
import { SearchProvidersDto } from './dto/search-providers.dto';
import { AvailabilityService } from '../availability/availability.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    @Inject(PROVIDER_SEARCH_SERVICE) private providerSearch: ProviderSearchService,
    private availability: AvailabilityService,
  ) {}

  // "Find plumbers near me" — spec §9. The controller only knows about the
  // ProviderSearchService interface, never about Postgres/PostGIS or (later)
  // OpenSearch directly.
  //
  // Schedule-derived availability ("Available today" / "Next available:
  // Friday", spec §3) is attached here rather than baked into
  // ProviderSearchResultItem, so the search interface stays swappable
  // (OpenSearch etc. don't need to know about weekly schedules) while
  // result cards still get it.
  @Get('providers')
  async searchProviders(@Query() dto: SearchProvidersDto) {
    const result = await this.providerSearch.search(dto);
    const availabilityByProvider = await this.availability.summariesForProviders(result.items.map((i) => i.id));
    return {
      ...result,
      items: result.items.map((item) => ({ ...item, availability: availabilityByProvider.get(item.id) ?? null })),
    };
  }
}
