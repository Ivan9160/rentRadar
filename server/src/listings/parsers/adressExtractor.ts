import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { textContent } from 'domutils';

export class AddressExtractor {
  public static extractExactAddress(
    description: string | null,
    locationRow: Cheerio<AnyNode>,
  ): string | null {
    if (!locationRow.length) {
      return null;
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

    if (!description) {
      return locationAddress;
    }

    const street = locationAddress
      ?.split(',')
      .map((x) => x.trim())
      .filter(Boolean)[0] ?? null;

    if (!street) {
      return locationAddress;
    }

    const text = description
      .replace(/\s+/g, ' ')
      .trim();

    const houseNumber = '(\\d+[A-Za-z]?(?:\\/\\d+)?)';

    const patterns = [
      new RegExp(`\\bprzy\\s+ulic(?:y|ą)\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\bprzy\\s+ul\\.?\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\bprzy\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\bulic(?:y|ą)\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\bul\\.?\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\balei\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\baleja\\s+(.+?)\\s+${houseNumber}`, 'i'),
      new RegExp(`\\bal\\.?\\s+(.+?)\\s+${houseNumber}`, 'i'),
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
      );

      return `${street} ${foundHouseNumber}`;
    }

    return locationAddress;
  }
}