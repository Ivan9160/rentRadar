import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { OtodomService } from './sources/otodom.service.js';
import {GratkaService} from './sources/gratka.service.js';
import { Listing } from './interfaces/listing.interface.js';
import { ListingsRepository } from './listings.repository.ts';

@Injectable()
export class ListingsService {
  constructor(
    private readonly otodomService: OtodomService,
    private readonly gratkaService: GratkaService,
    private readonly listingsRepository: ListingsRepository,
  ) {}

  async sync(city: string) : Promise<Listing[]>{
    const knownExternalIds = await this.listingsRepository.findExternalIds('GRATKA');
    const gratkaListings = await this.gratkaService.findAll(city, knownExternalIds);
    console.log(`Found ${gratkaListings.length} listings from Gratka for city ${city}`);
    await this.listingsRepository.saveListings(gratkaListings, city);
    return gratkaListings;
  }

  async findAll(city: string) {
    return this.listingsRepository.findAll(city);
  
  }

  findOne(id: number) {
    return `This action returns a #${id} listing`;
  }
}