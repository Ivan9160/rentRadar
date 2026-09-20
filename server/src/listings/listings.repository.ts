import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { Listing } from './interfaces/listing.interface.js';

@Injectable()
export class ListingsRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async saveListings(
    listings: Listing[],
  ): Promise<void> {
    for (const listing of listings) {
      await this.prisma.db.Listing.upsert({
        create: this.toDatabaseListing(listing),
        update: this.toDatabaseListing(listing),

        conflictOn: {
          source: listing.source,
          externalId: listing.externalId,
        },
      });
    }
  }

  private toDatabaseListing(
    listing: Listing,
  ) {
    return {
      externalId: listing.externalId,
      source: listing.source,

      title: listing.title,
      url: listing.url,

      price: listing.price,
      rent: listing.rent,
      deposit: listing.deposit,

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

  private parseDate(
    value: string,
  ): Date | null {
    const [day, month, year] =
      value.split('.').map(Number);

    if (!day || !month || !year) {
      return null;
    }

    return new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );
  }
}