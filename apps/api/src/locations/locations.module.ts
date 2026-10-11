import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { MockMapProvider } from './providers/mock-map.provider';
import { MapboxProvider } from './providers/mapbox.provider';
import { MAP_PROVIDER } from './map-provider.interface';

export { MAP_PROVIDER } from './map-provider.interface';

@Module({
  controllers: [LocationsController],
  providers: [
    {
      provide: MAP_PROVIDER,
      useFactory: () => {
        const hasKey = !!process.env.MAP_PROVIDER_KEY;
        if (hasKey && process.env.MAP_PROVIDER === 'mapbox') return new MapboxProvider();
        // Google Maps implementation would slot in here behind the same
        // interface; falls back to the mock provider without a key so the
        // app runs fully offline in development.
        return new MockMapProvider();
      },
    },
  ],
  exports: [MAP_PROVIDER],
})
export class LocationsModule {}
