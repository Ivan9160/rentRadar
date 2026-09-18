import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface AddressToGeocode {
  street: string;
  houseNumber: string | null;
  city: string;
  country: string;
}

interface BatchCreateResponse {
  id: string;
  status: string;
  url: string;
}

interface GeoapifyResult {
  query?: {
    text?: string;
  };
  lat?: number;
  lon?: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(
    GeocodingService.name,
  );

  private readonly batchUrl =
    'https://api.geoapify.com/v1/batch/geocode/search';

  private readonly cache = new Map<
    string,
    GeoCoordinates | null
  >();

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async geocode(
    address: string | null,
    city: string | null,
  ): Promise<GeoCoordinates | null> {
    if (!address?.trim()) {
      return null;
    }

    const addressToGeocode =
      this.buildAddressToGeocode(
        address,
        city ?? '',
      );

    const result = await this.geocodeMany([
      addressToGeocode,
    ]);

    return (
      result.get(
        this.normalizeAddress(addressToGeocode),
      ) ?? null
    );
  }

  async geocodeMany(
    addresses: AddressToGeocode[],
  ): Promise<
    Map<string, GeoCoordinates | null>
  > {
    const result = new Map<
      string,
      GeoCoordinates | null
    >();

    const apiKey =
      this.configService.get<string>(
        'GEOAPIFY_API_KEY',
      );

    if (!apiKey) {
      throw new Error(
        'GEOAPIFY_API_KEY is not configured',
      );
    }

    // Унікальні structured addresses
    const uniqueAddresses = Array.from(
      new Map(
        addresses.map((address) => [
          this.normalizeAddress(address),
          address,
        ]),
      ).values(),
    );

    const addressesToGeocode: AddressToGeocode[] =
      [];

    // Перевіряємо кеш
    for (const address of uniqueAddresses) {
      const key = this.normalizeAddress(address);

      if (this.cache.has(key)) {
        result.set(
          key,
          this.cache.get(key) ?? null,
        );
      } else {
        addressesToGeocode.push(address);
      }
    }

    if (!addressesToGeocode.length) {
      return result;
    }

    // Максимум 1000 за batch
    for (
      let i = 0;
      i < addressesToGeocode.length;
      i += 1000
    ) {
      const batch =
        addressesToGeocode.slice(i, i + 1000);

      const batchResults =
        await this.processBatch(batch);

      for (const address of batch) {
        const key =
          this.normalizeAddress(address);

        const coordinates =
          batchResults.get(key) ?? null;

        this.cache.set(key, coordinates);
        result.set(key, coordinates);
      }
    }

    return result;
  }

  private async processBatch(
    addresses: AddressToGeocode[],
  ): Promise<
    Map<string, GeoCoordinates | null>
  > {
    const apiKey =
      this.configService.get<string>(
        'GEOAPIFY_API_KEY',
      );

    if (!apiKey) {
      throw new Error(
        'GEOAPIFY_API_KEY is not configured',
      );
    }

    // Geoapify отримує strings
    const queries = addresses.map((address) =>
      this.formatAddress(address),
    );

    const response =
      await axios.post<BatchCreateResponse>(
        this.batchUrl,
        queries,
        {
          params: {
            apiKey,
            lang: 'pl',
            countrycodes: 'pl',
          },
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 15000,
          validateStatus: (status) =>
            status === 202,
        },
      );

    const jobId = response.data.id;

    this.logger.log(
      `Geoapify batch created: ${jobId} (${addresses.length} addresses)`,
    );

    return this.pollBatch(
      jobId,
      addresses,
    );
  }

  private async pollBatch(
    jobId: string,
    addresses: AddressToGeocode[],
  ): Promise<
    Map<string, GeoCoordinates | null>
  > {
    const maxAttempts = 60;
    const pollInterval = 1000;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      await this.sleep(pollInterval);

      const apiKey =
        this.configService.get<string>(
          'GEOAPIFY_API_KEY',
        );

      try {
        const response =
          await axios.get<
            GeoapifyResult[] | { status: string }
          >(this.batchUrl, {
            params: {
              id: jobId,
              apiKey,
              format: 'json',
            },
            timeout: 15000,
          });

        if (response.status === 202) {
          this.logger.debug(
            `Geoapify batch ${jobId} is still processing (${attempt}/${maxAttempts})`,
          );

          continue;
        }

        if (response.status !== 200) {
          throw new Error(
            `Unexpected Geoapify status: ${response.status}`,
          );
        }

        const data = response.data;

        if (!Array.isArray(data)) {
          throw new Error(
            `Unexpected Geoapify response for job ${jobId}`,
          );
        }

        return this.mapResults(
          addresses,
          data,
        );
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 202
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `Geoapify batch ${jobId} timed out`,
    );
  }

  private mapResults(
    addresses: AddressToGeocode[],
    results: GeoapifyResult[],
  ): Map<string, GeoCoordinates | null> {
    const resultMap = new Map<
      string,
      GeoCoordinates | null
    >();

    // Спочатку всі адреси = null
    for (const address of addresses) {
      resultMap.set(
        this.normalizeAddress(address),
        null,
      );
    }

    for (const item of results) {
      const query =
        item.query?.text?.trim();

      if (
        !query ||
        item.lat === undefined ||
        item.lon === undefined
      ) {
        continue;
      }

      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        continue;
      }

      // Знаходимо наш structured address
      const address = addresses.find(
        (item) =>
          this.normalizeString(
            this.formatAddress(item),
          ) === this.normalizeString(query),
      );

      if (!address) {
        continue;
      }

      resultMap.set(
        this.normalizeAddress(address),
        {
          latitude,
          longitude,
        },
      );
    }

    return resultMap;
  }

  private normalizeAddress(
    address: AddressToGeocode,
  ): string {
    return [
      address.street,
      address.houseNumber,
      address.city,
      address.country,
    ]
      .filter(Boolean)
      .map((value) =>
        String(value)
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase(),
      )
      .join('|');
  }

  private formatAddress(
    address: AddressToGeocode,
  ): string {
    return [
      address.street,
      address.houseNumber,
      address.city,
      address.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private normalizeString(
    value: string,
  ): string {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private buildAddressToGeocode(
    address: string,
    city: string,
  ): AddressToGeocode {
    const normalized = address
      .replace(/\s+/g, ' ')
      .trim();

    const firstPart =
      normalized.split(',')[0].trim();

    const match = firstPart.match(
      /^(.+?)\s+(\d+[A-Za-z]?(?:\/\d+)?)$/,
    );

    if (match) {
      return {
        street: match[1].trim(),
        houseNumber: match[2].trim(),
        city,
        country: 'Poland',
      };
    }

    return {
      street: firstPart,
      houseNumber: null,
      city,
      country: 'Poland',
    };
  }

  private sleep(
    ms: number,
  ): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(resolve, ms),
    );
  }
}