import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Listing } from '../interfaces/listing.interface';

@Injectable()
export class GratkaService {
  private readonly baseUrl = 'https://gratka.pl';

  async findAll(city = 'lodz'): Promise<Listing[]> {
    const url = `${this.baseUrl}/nieruchomosci/mieszkania/${city}/wynajem`;

    console.log(`Fetching Gratka: ${url}`);

    const { data } = await axios.get<string>(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://gratka.pl/',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);

    const listings: Listing[] = [];

    /*
     * Na Gratka każda karta posiada:
     *
     * <div data-property-id="1542920071">
     *
     * dlatego jest to dobry punkt startowy do parsowania.
     */
    $('[data-property-id]').each((_, element) => {
      const card = $(element);

      /*
       * URL
       *
       * Przykład:
       * /nieruchomosci/mieszkanie-lodz-srodmiescie-.../ob/48781359
       */
      const href = card
        .find('a[data-cy="propertyUrl"]')
        .first()
        .attr('href');

      const listingUrl = href
        ? new URL(href, this.baseUrl).toString()
        : null;

      /*
       * Tekst całej karty.
       */
      const text = card.text().replace(/\s+/g, ' ').trim();

      /*
       * TITLE
       *
       * Przykład:
       * "3 pokoje-skrzyżowanie Piłsudskiego-Śmigłego-Rydza 47 m²
       *  2 000 zł Aleja Marszałka Józefa Piłsudskiego,
       *  Śródmieście, Łódź, łódzkie"
       *
       * Najbezpieczniej wziąć pierwszy link property-card__link.
       */
      const title = card
        .find('a.property-card__link')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      /*
       * PRICE
       *
       * У Gratka ціна знаходиться в тексті картки.
       *
       * Спочатку шукаємо "... zł".
       */
      let price: number | null = null;

      const priceMatches = text.match(
        /([\d\s.]+)\s*zł\b/gi,
      );

      if (priceMatches?.length) {
        const parsedPrices = priceMatches
          .map((value) => {
            const match = value.match(/([\d\s.]+)\s*zł/i);

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

        /*
         * Перший zł у більшості карток — ціна оренди.
         */
        price = parsedPrices[0] ?? null;
      }

      /*
       * AREA
       *
       * Наприклад:
       * 47 m²
       */
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

      /*
       * ROOMS
       *
       * Наприклад:
       * "3 pokoje"
       */
      let rooms: number | null = null;

      const roomsMatch = text.match(
        /(\d+)\s*pok(?:ój|oje|oi)/i,
      );

      if (roomsMatch) {
        rooms = Number(roomsMatch[1]);
      }

      /*
       * ADDRESS
       *
       * У title з твого HTML є:
       *
       * Aleja Marszałka Józefa Piłsudskiego,
       * Śródmieście, Łódź, łódzkie
       *
       * Спробуємо витягнути адресу після площі/ціни.
       */
      let address: string | null = null;

      if (title) {
        const addressMatch = title.match(
          /\b([\p{L}ĄĆĘŁŃÓŚŹŻąćęłńóśźż.\- ]+,\s*(?:Śródmieście|Bałuty|Widzew|Polesie|Górna|Łódź)[^]*)$/iu,
        );

        if (addressMatch) {
          address = addressMatch[1].trim();
        }
      }

      /*
       * Окремо перевіряємо адресу в тексті.
       */
      if (!address) {
        const cityMatch = text.match(
          /([A-ZĄĆĘŁŃÓŚŹŻ][^,]+),\s*(Śródmieście|Bałuty|Widzew|Polesie|Górna),\s*Łódź,\s*łódzkie/i,
        );

        if (cityMatch) {
          address = `${cityMatch[1].trim()}, ${cityMatch[2]}, Łódź, łódzkie`;
        }
      }

      /*
       * DESCRIPTION
       *
       * У твоєму HTML:
       *
       * .description__content
       */
      const description = card
        .find('.description__content')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim() || null;

      /*
       * DATE
       *
       * У HTML:
       *
       * [data-cy="descriptionAddedAtDate"]
       */
      const addedAt = card
        .find('[data-cy="descriptionAddedAtDate"]')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .replace(/^Dodane:\s*/i, '')
        .trim() || null;

      /*
       * OWNER / AGENCY
       */
      const company =
        card
          .find('.agency .company')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim() || null;

      const agent =
        card
          .find('.agency .name')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim() || null;

      /*
       * Якщо немає ні title, ні URL — пропускаємо.
       */
      if (!title && !listingUrl) {
        return;
      }

      listings.push({
        title,
        url: listingUrl,
        text,
        price,
        rent: null,
        deposit: null,
        address,


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

    console.log(
      `Gratka listings found: ${uniqueListings.length}`,
    );

    return uniqueListings;
  }
}