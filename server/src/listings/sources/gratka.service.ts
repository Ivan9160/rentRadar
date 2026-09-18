import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { Listing } from '../interfaces/listing.interface';
import { AddressExtractor } from '../parsers/adressExtractor';
import { DepositExtractor } from '../parsers/depositExtractor';
import { RentExtractor } from '../parsers/rentExtractor';
import { GeocodingService } from '../../geocoding/geocoding.service';

@Injectable()
export class GratkaService {
  constructor(
    private readonly geocodingService: GeocodingService,
  ) {}
  private readonly baseUrl = 'https://gratka.pl';

  async findAll(city = 'lodz'): Promise<Listing[]> {
    const url = `${this.baseUrl}/nieruchomosci/mieszkania/${city}/wynajem`;

    console.log(`Fetching Gratka: ${url}`);

    const { data } = await axios.get<string>(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://gratka.pl/',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);

    const listings: Listing[] = [];

    $('[data-property-id]').each((_, element) => {
      const card = $(element);

      const href = card
        .find('a[data-cy="propertyUrl"]')
        .first()
        .attr('href');

      const listingUrl = href
        ? new URL(href, this.baseUrl).toString()
        : null;

      const text = card
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const title = card
        .find('a.property-card__link')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      let price: number | null = null;

      const priceMatches = text.match(
        /([\d\s.]+)\s*zł\b/gi,
      );

      if (priceMatches?.length) {
        const parsedPrices = priceMatches
          .map((value) => {
            const match = value.match(
              /([\d\s.]+)\s*zł/i,
            );

            if (!match) {
              return null;
            }

            return Number(
              match[1]
                .replace(/\s/g, '')
                .replace(/\./g, ''),
            );
          })
          .filter(
            (value): value is number =>
              value !== null && !Number.isNaN(value),
          );

        price = parsedPrices[0] ?? null;
      }

      let area: number | null = null;

      const areaMatch = text.match(
        /([\d\s.,]+)\s*m²/i,
      );

      if (areaMatch) {
        area = Number(
          areaMatch[1]
            .replace(/\s/g, '')
            .replace(',', '.'),
        );
      }

      let rooms: number | null = null;

      const roomsMatch = text.match(
        /(\d+)\s*pok(?:ój|oje|oi)/i,
      );

      if (roomsMatch) {
        rooms = Number(roomsMatch[1]);
      }

      let address: string | null = null;

      if (title) {
        const addressMatch = title.match(
          /\b([\p{L}ĄĆĘŁŃÓŚŹŻąćęłńóśźż.\- ]+,\s*(?:Śródmieście|Bałuty|Widzew|Polesie|Górna|Łódź)[^]*)$/iu,
        );

        if (addressMatch) {
          address = addressMatch[1].trim();
        }
      }

      if (!address) {
        const cityMatch = text.match(
          /([A-ZĄĆĘŁŃÓŚŹŻ][^,]+),\s*(Śródmieście|Bałuty|Widzew|Polesie|Górna),\s*Łódź,\s*łódzkie/i,
        );

        if (cityMatch) {
          address = `${cityMatch[1].trim()}, ${cityMatch[2]}, Łódź, łódzkie`;
        }
      }

      const description =
        card
          .find('.description__content')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim() || null;

      const addedAt =
        card
          .find('[data-cy="descriptionAddedAtDate"]')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .replace(/^Dodane:\s*/i, '')
          .trim() || null;

      if (!title && !listingUrl) {
        return;
      }

      listings.push({
        title,
        url: listingUrl,
        price,
        rent: null,
        deposit: null,
        address,
        rooms,
        area,
        description,
        addedAt,
      });
    });

    const uniqueListings = Array.from(
      new Map(
        listings.map((listing) => [
          listing.url ?? listing.title,
          listing,
        ]),
      ).values(),
    );

  const detailedListings = (
    await Promise.all(
      uniqueListings.map(async (listing) => {
        if (!listing.url) {
          return null;
        }

        console.log(`Checking Gratka listing: ${listing.url}`);

        try {
          return await this.checkListing(
            listing.url,
            city,
        );
        } catch (error) {
          console.error(
            `Failed to check listing: ${listing.url}`,
            error,
          );

          return null;
        }
      }),
    )
  ).filter(
    (listing): listing is Listing => listing !== null,
  );


    return detailedListings;

  }

  private parseNumber(
    value: string | undefined | null,
  ): number | null {
    if (!value) {
      return null;
    }

    const normalized = value
      .replace(/\u00a0/g, ' ')
      .replace(/\s/g, '')
      .replace(',', '.');

    const match = normalized.match(
      /\d+(?:\.\d+)?/,
    );

    return match ? Number(match[0]) : null;
  }

  private getInfoMap($: cheerio.CheerioAPI) {
    const map = new Map<string, string>();

    $('[data-cy="informationTableRow"]').each(
      (_, row) => {
        const label = $(row)
          .find('[data-cy="informationTableLabel"]')
          .first()
          .text()
          .trim();

        const value = $(row)
          .find('[data-cy="itemValue"]')
          .first()
          .text()
          .trim();

        if (label && value) {
          map.set(label, value);
        }
      },
    );

    return map;
  }




  async checkListing(
    url: string,
    city: string,
  ): Promise<Listing | null> {
    try {
      console.log(
        `Checking Gratka listing: ${url}`,
      );

      const response = await axios.get<string>(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language':
            'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://gratka.pl/',
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      console.log(
        `Gratka response status: ${response.status}`,
      );

      if (response.status !== 200) {
        console.log(
          `Listing unavailable: HTTP ${response.status}`,
        );

        return null;
      }

      const $ = cheerio.load(response.data);

      
      const detailsPage = $('[data-cy="pageDetailsProperty"]');

      if (!detailsPage.length) {
        console.log(`Gratka detail page not found: ${url}`);
        return null;
      }

      const title =
        $('[data-cy="pageDetailsPropertyTitle"]')
          .first()
          .text()
          .trim() || null;

      if (!title) {
        console.log(
          `Listing title not found: ${url}`,
        );

        return null;
      }

      const priceText = $(
        '[data-cy="priceRowPrice"]',
      )
        .first()
        .text()
        .trim();

      const price = this.parseNumber(priceText);

      const info = this.getInfoMap($);

      const area =
        this.parseNumber(
          info.get('Pow. całkowita'),
        ) ??
        this.parseNumber(
          $('[data-cy="detailsHighlightedParametersItem"]')
            .filter((_, el) =>
              $(el)
                .find(
                  '[data-cy="detailsHighlightedParametersLabel"]',
                )
                .text()
                .trim()
                .toLowerCase()
                .includes('powierzchnia'),
            )
            .find(
              '[data-cy="detailsHighlightedParametersValue"]',
            )
            .text(),
        );

      const rooms =
        this.parseNumber(
          info.get('Liczba pokoi'),
        ) ??
        this.parseNumber(
          $('[data-cy="detailsHighlightedParametersItem"]')
            .filter((_, el) =>
              $(el)
                .find(
                  '[data-cy="detailsHighlightedParametersLabel"]',
                )
                .text()
                .trim()
                .toLowerCase() === 'pokoje',
            )
            .find(
              '[data-cy="detailsHighlightedParametersValue"]',
            )
            .text(),
        );

      const rentText =
        info.get('Czynsz') ??
        info.get('Czynsz administracyjny') ??
        info.get('Opłata administracyjna') ??
        info.get('Dodatkowe koszty');

      
     
      const description =
        $('.details-description__content')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim() || null;
      let rent = this.parseNumber(rentText);
      if (rent === null) {
        rent = RentExtractor.extract(description, rent);
      }

      let deposit = this.parseNumber(
        info.get('Depozyt za wynajem'),
      );

      if (deposit === null) {
       deposit = DepositExtractor.extract(description, deposit);
      }
      const locationRow = $('[data-cy="locationRowTitle"]').first();

      const address = AddressExtractor.extractExactAddress(
        description,
        locationRow,
      );

      
      const addedAt =
        info.get('Data dodania') ?? null;


      const canonicalUrl =
        $('link[rel="canonical"]')
          .attr('href')
          ?.trim() || url;

      const coordinates = await this.geocodingService.geocode(address, city);
      const latitude = coordinates?.latitude ?? null;
      const longitude = coordinates?.longitude ?? null;


      const listing: Listing = {
        title,
        url: canonicalUrl,
        price,
        rent,
        rooms,
        area,
        deposit,
        address,
        description,
        latitude,
        longitude,
        addedAt,
      };


      return listing;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Gratka request failed: ${error.response?.status ?? error.message}`,
        );
      } else {
        console.error(
          'Gratka check failed:',
          error,
        );
      }

      return null;
    }
  }
}