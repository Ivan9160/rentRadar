import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Listing } from './interfaces/listing.interface.js';
import { Temporal } from 'temporal-polyfill/full/implementation';

@Injectable()
export class ListingsRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async saveListings(
    listings: Listing[],
    city: string,
  ): Promise<void> {
    for (const listing of listings) {
      await this.prisma.db.Listing.upsert({
        create: this.toDatabaseListing(listing, city),
        update: this.toDatabaseListing(listing, city),

        conflictOn: {
          source: listing.source,
          externalId: listing.externalId,
        },
      });
    }
  }

  async findAll(city:string ) {
    return this.prisma.db.Listing
    .where(l => l.city.eq(city))
      .orderBy((l) => l.createdAt.desc())
      .all();
  }

  private toDatabaseListing(
    listing: Listing,
    city: string,
  ) {
    return {
      externalId: listing.externalId,
      source: listing.source,

      title: listing.title,
      url: listing.url,
      city: city,

      price: Math.round(listing.price ?? 0),
      rent: Math.round(listing.rent ?? 0),
      deposit: Math.round(listing.deposit ?? 0),

      rooms: listing.rooms,
      area: listing.area,

      address: listing.address,
      isExactAddress: listing.isExactAddress,

      latitude: listing.latitude,
      longitude: listing.longitude,

      description: listing.description,

      addedAt: listing.addedAt
        ? this.parseDate(listing.addedAt)
        : null,
    };
  }

  private parseDate(value: string): Temporal.Instant | null {
    const [day, month, year] = value.split('.').map(Number);

    if (!day || !month || !year) {
      return null;
    }

    return Temporal.Instant.fromEpochMilliseconds(
      Date.UTC(year, month - 1, day),
    );
  }


  async findExternalIds(source: 'GRATKA' | 'OTODOM'): Promise<Set<string>> {
    const rows = await this.prisma.db.Listing
      .where({ source })
      .select('externalId')
      .all();

    return new Set(rows.map((r) => r.externalId));
  }
}