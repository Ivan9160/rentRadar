import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { Listing, ListingSource } from '../interfaces/listing.interface.js';

@Injectable()
export class OtodomService {
  async findAll(city: string): Promise<Listing[]> {
    const url =
      `https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/lodzkie/${city}/${city}/${city}` +
      `?limit=1000&by=DEFAULT&direction=DESC`;

    console.log(`Fetching Otodom: ${url}`);

    const { data } = await axios.get<string>(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/58.0.3029.110 Safari/537.3',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    const $ = cheerio.load(data);

    const listings: Listing[] = [];

    $('article').each((_, element) => {
      const card = $(element);

      const title = card
        .find('.css-135367')
        .first()
        .text()
        .trim();

      const href = card
        .find('a[href*="/pl/oferta/"]')
        .first()
        .attr('href');

      const listingUrl = href
        ? new URL(href, 'https://www.otodom.pl').toString()
        : null;

      const text = card.text().trim();

      const priceText = card
        .find('.css-6t3bie')
        .first()
        .text()
        .trim();

      const price = priceText
        ? Number(priceText.replace(/[^\d]/g, ''))
        : null;

      // Czynsz
      const rentMatch = text.match(
        /czynsz\s*:\s*([\d\s]+)\s*zł/i,
      );

      const rent = rentMatch
        ? Number(rentMatch[1].replace(/\s/g, ''))
        : null;

      // Kaucja
      const depositMatch = text.match(
        /kaucja\s*:?\s*([\d\s.,]+)\s*zł/i,
      );

      const deposit = depositMatch
        ? Number(
            depositMatch[1]
              .replace(/\s/g, '')
              .replace(',', '.'),
          )
        : null;

      let address =
        card
          .find('.css-oxb2ca')
          .first()
          .text()
          .trim() || null;

      if (address && title) {
        const streetMatch = title.match(
          /(?:ul\.\s*)?([A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż.\- ]+?)\s+(\d+[A-Za-z]?(?:\/\d+)?)/i,
        );

        if (streetMatch) {
          const streetName = streetMatch[1].trim();
          const houseNumber = streetMatch[2].trim();

          if (
            address
              .toLowerCase()
              .includes(streetName.toLowerCase())
          ) {
            address = address.replace(
              new RegExp(
                `^ul\\.\\s*${streetName}`,
                'i',
              ),
              `ul. ${streetName} ${houseNumber}`,
            );
          }
        }
      }

      if (!title && !listingUrl) {
        return;
      }
      const rooms = null;
      const area = null;

      listings.push({
        title,
        url: listingUrl!,
        price,
        rent,
        source: ListingSource.OTODOM,
        isExactAddress: false,
        externalId: listingUrl!.split('/').pop() || '',
        deposit,
        address,
        description: null,
        rooms,
        area,
      });
    });

    console.log(
      `Otodom listings found: ${listings.length}`,
    );

    return listings;
  }
}