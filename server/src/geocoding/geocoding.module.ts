import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service.ts';

@Module({
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
