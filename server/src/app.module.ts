import { Module } from '@nestjs/common';
import { AppController } from './app.controller.ts';
import { AppService } from './app.service.ts';
import { ListingsModule } from './listings/listings.module.ts';
import { GeocodingModule } from './geocoding/geocoding.module.ts';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ListingsModule, GeocodingModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
