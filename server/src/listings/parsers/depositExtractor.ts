export class DepositExtractor {
  public static extract(
    description: string | null,
    currentDeposit: number | null,
  ): number | null {
    if (currentDeposit !== null || !description) {
      return currentDeposit;
    }

    const text = description
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /kaucja\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /kaucję\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /kaucji\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /depozyt\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /depozytu\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /depozyt\s+zwrotny\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /kaucja\s+zwrotna\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
    ];

    for (const regex of patterns) {
      const match = text.match(regex);

      if (!match?.[1]) {
        continue;
      }

      const value = this.parseMoney(match[1]);

      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  private static parseMoney(value: string): number | null {
    const normalized = value
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(?:,|$))/g, '')
      .replace(',', '.');

    const number = Number(normalized);

    return Number.isFinite(number) ? number : null;
  }
}