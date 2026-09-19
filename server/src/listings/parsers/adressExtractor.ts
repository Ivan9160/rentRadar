import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { textContent } from 'domutils';

export class AddressExtractor {
  public static extractExactAddress(
    description: string | null,
    locationRow: Cheerio<AnyNode>,
  ): { address: string | null; isExactAddress: boolean } {
    if (!locationRow.length) {
      return { address: null, isExactAddress: false };
    }

    const locationParts = locationRow
      .find('span')
      .toArray()
      .map((el) => textContent(el).trim())
      .filter(Boolean);

    const locationAddress =
      locationParts
        .join(', ')
        .replace(/(?:,\s*)+/g, ', ')
        .replace(/\s+/g, ' ')
        .trim() || null;

    const locationHasHouseNumber =
      locationParts[0]?.match(
        /\s\d+[A-Za-z]?(?:\/\d+)?\s*$/i,
      ) !== null;

    if (!description) {
      return { address: locationAddress, isExactAddress: locationHasHouseNumber };
    }

    const street = locationAddress
      ?.split(',')
      .map((x) => x.trim())
      .filter(Boolean)[0] ?? null;

    if (!street) {
      return {  address: locationAddress, isExactAddress: locationHasHouseNumber };
    }

    const text = description
      .replace(/\s+/g, ' ')
      .trim();

    const houseNumberPattern = '(\\d+[A-Za-z]?(?:\\/\\d+)?)';

    const patterns = [
      new RegExp(`\\bprzy\\s+ulic(?:y|ą)\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\bprzy\\s+ul\\.?\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\bprzy\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\bulic(?:y|ą)\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\bul\\.?\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\balei\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\baleja\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
      new RegExp(`\\bal\\.?\\s+(.+?)\\s+${houseNumberPattern}`, 'i'),
    ];

    const canonicalStreet = street
      .replace(/^(ul\.?|ulica|al\.?|aleja)\s+/i, '')
      .trim();

    for (const regex of patterns) {
      const match = text.match(regex);

      if (!match) {
        continue;
      }

      const foundStreet = match[1]
        .replace(/[.,]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      const foundHouseNumber = match[2];

      if (!foundStreet || !foundHouseNumber) {
        continue;
      }

      const canonicalLast =
        canonicalStreet.split(/\s+/).at(-1)?.toLowerCase();

      const foundLast =
        foundStreet.split(/\s+/).at(-1)?.toLowerCase();

      const streetMatches =
        canonicalLast &&
        foundLast &&
        (
          foundLast === canonicalLast ||
          foundLast.startsWith(canonicalLast.slice(0, 6)) ||
          canonicalLast.startsWith(foundLast.slice(0, 6))
        );

      if (!streetMatches) {
        continue;
      }

      console.log(
        'EXACT ADDRESS FOUND:',
        `${street} ${foundHouseNumber}`,
        'FOUND HOUSE NUMBER:',
        foundHouseNumber,
      );

      return {
        address: `${street} ${foundHouseNumber}`,
        isExactAddress: true,
      };
    }

    return { address: locationAddress, isExactAddress: locationHasHouseNumber };
  }
}