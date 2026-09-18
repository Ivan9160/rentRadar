import { Module } from '@nestjs/common';
import { ListingsService } from './listings.service.js';
import { ListingsController } from './listings.controller.js';
import { OtodomService } from './sources/otodom.service.js';
import { GratkaService } from './sources/gratka.service.js';

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, GratkaService, OtodomService],
})
export class ListingsModule {}
