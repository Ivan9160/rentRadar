export class RentExtractor {
  public static extract(
    description: string | null,
    currentRent: number | null,
  ): number | null {
    if (currentRent !== null || !description) {
      return currentRent;
    }

    const text = description
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /czynsz\s+administracyjny\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /czynsz\s+administracyjny\s+(?:w\s+)?(?:wysokości|kwocie|wynosi)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /dolicz(?:yć|amy|any)?\s+(?:.*?)?czynsz\s+administracyjny\s+(?:w\s+)?(?:wysokości|kwocie|wynosi)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /czynsz\s+adm\.?\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /czynsz\s+adm\.?\s+(?:w\s+)?(?:wysokości|kwocie|wynosi)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /opłat(?:a|y)\s+administracyjn(?:a|e)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /opłat(?:a|y)\s+administracyjn(?:a|e)\s+(?:w\s+)?(?:wysokości|kwocie|wynosi)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /czynsz\s+(?:do|dla)\s+wspólnoty\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /czynsz\s+(?:do|dla)\s+wspólnoty\s+(?:w\s+)?(?:wysokości|kwocie|wynosi)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /opłat(?:a|y)\s+(?:do|dla)\s+wspólnoty\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /zaliczka\s+na\s+koszty\s+eksploatacji\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /zaliczka\s+na\s+opłat(?:y|ę)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /zaliczka\s+na\s+czynsz\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /zaliczka\s+na\s+czynsz.*?wynosi\s+łącznie\s*[-:]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /(?:opłat(?:a|y)|koszt(?:y)?)\s+eksploatacyjn\w*\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /opłat(?:a|y)\s+za\s+mieszkanie\s*(?:i\s+media)?\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /opłat(?:a|y)\s+za\s+media\s+\(łącznie\)\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /opłat(?:a|y)\s+związane\s+z\s+administracj[ąa]\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /dodatkowe\s+koszty\s*[:\-]?\s*([\d\s.]+(?:,\d{1,2})?)/iu,
      /czynsz\s+administracyjny\s*[:\-]?\s*(?:ok\.?\s*)?([\d\s.]+(?:,\d{1,2})?)/iu,
      /dolicz(?:yć|amy|any)?\s+(?:.*?)?czynsz\s+administracyjny\s+(?:w\s+)?(?:wysokości|kwocie|wynosi)\s*[:\-]?\s*(?:ok\.?\s*)?([\d\s.]+(?:,\d{1,2})?)/iu,
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