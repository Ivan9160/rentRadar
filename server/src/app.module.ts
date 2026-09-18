import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ListingsModule } from './listings/listings.module.js';

@Module({
  imports: [ListingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
