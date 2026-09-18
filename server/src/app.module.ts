import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ListingsModule } from './listings/listings.module.js';
import { GeocodingModule } from './geocoding/geocoding.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ListingsModule, GeocodingModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
