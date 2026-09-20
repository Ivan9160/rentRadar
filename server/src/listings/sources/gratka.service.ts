import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { Listing, ListingSource } from '../interfaces/listing.interface.ts';
import { AddressExtractor } from '../parsers/adressExtractor.ts';
import { DepositExtractor } from '../parsers/depositExtractor.ts';
import { RentExtractor } from '../parsers/rentExtractor.ts';
import { GeocodingService } from '../../geocoding/geocoding.service.ts';





@Injectable()
export class GratkaService {
  constructor(
    private readonly geocodingService: GeocodingService,
  ) {}
  private readonly baseUrl = 'https://gratka.pl';
  private readonly maxPages = 40;
  private readonly pageDelayMs = 3000;
  private readonly listingDelayMs = 2000;
  private readonly concurrency = 2;
  private blocked = false;

  private readonly headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://gratka.pl/',
};

private buildPageUrl(city: string, page: number): string {
  const base = `${this.baseUrl}/nieruchomosci/mieszkania/${city}/wynajem`;
  return page === 1 ? base : `${base}?page=${page}`;
}

private externalIdFromUrl(url: string): string {
  return url.split('/').pop() || '';
}

private sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

private async fetchListingUrls(pageUrl: string): Promise<string[]> {
  const { data } = await axios.get<string>(pageUrl, {
    headers: this.headers,
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const urls: string[] = [];

  $('[data-property-id]').each((_, element) => {
    const href = $(element)
      .find('a[data-cy="propertyUrl"]')
      .first()
      .attr('href');

    if (href) {
      urls.push(new URL(href, this.baseUrl).toString());
    }
  });

  return urls;
}

private async mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

async findAll(
  city: string,
  knownExternalIds: Set<string>,
): Promise<Listing[]> {
  this.blocked = false;

  const urls = new Set<string>();
  let knownPagesInRow = 0;

  for (let page = 1; page <= this.maxPages; page++) {
    const pageUrl = this.buildPageUrl(city, page);
    console.log(`Fetching Gratka page ${page}: ${pageUrl}`);

    let pageUrls: string[];
    try {
      pageUrls = await this.fetchListingUrls(pageUrl);
    } catch (error) {
      console.error(`Failed to fetch page ${page}`, error);
      break; // 403/429/404: зупиняємось, а не наполягаємо
    }

    if (pageUrls.length === 0) break;

    const fresh = pageUrls.filter(
      (u) =>
        !knownExternalIds.has(this.externalIdFromUrl(u)) && !urls.has(u),
    );
    fresh.forEach((u) => urls.add(u));

    // дві сторінки поспіль без нових оголошень: далі йдуть старіші
    knownPagesInRow = fresh.length === 0 ? knownPagesInRow + 1 : 0;
    if (knownPagesInRow >= 2) break;

    await this.sleep(this.pageDelayMs);
  }

  console.log(`New listings to check: ${urls.size}`);

  const results = await this.mapLimit(
    [...urls],
    this.concurrency,
    async (url) => {
      if (this.blocked) return null;

      try {
        const listing = await this.checkListing(url, city);
        await this.sleep(this.listingDelayMs);
        return listing;
      } catch (error) {
        console.error(`Failed to check listing: ${url}`, error);
        return null;
      }
    },
  );

  return results.filter((l): l is Listing => l !== null);
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

      const { address, isExactAddress } = AddressExtractor.extractExactAddress(
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
        source: ListingSource.GRATKA,
        externalId: url.split('/').pop() || '',
        isExactAddress,
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