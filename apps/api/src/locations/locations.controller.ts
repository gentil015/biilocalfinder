import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MAP_PROVIDER, MapProvider } from './map-provider.interface';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(@Inject(MAP_PROVIDER) private mapProvider: MapProvider) {}

  // Powers the "Where do you need it?" location selector on the frontend.
  @Get('search')
  search(@Query('q') q: string) {
    return this.mapProvider.geocode(q ?? '');
  }
}
