import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { OtodomService } from './sources/otodom.service.js';
import {GratkaService} from './sources/gratka.service.js';
import { Listing } from './interfaces/listing.interface.js';

@Injectable()
export class ListingsService {
  constructor(
    private readonly otodomService: OtodomService,
    private readonly gratkaService: GratkaService,
  ) {}

  async findAll(city: string) : Promise<Listing[]>{
    return this.gratkaService.findAll(city);
  }

  findOne(id: number) {
    return `This action returns a #${id} listing`;
  }
}