import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListingsService } from './listings.service.js';


@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}



  @Get()
  findAll(@Query('city') city: string) {
    return this.listingsService.findAll(city);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(+id);
  }

}
