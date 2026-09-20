import { Injectable } from '@nestjs/common';

import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../../prisma/contract.d.js';
import contractJson from '../../prisma/contract.json' with { type: 'json' };

@Injectable()
export class PrismaService {
  private readonly client = postgres<Contract>({
    contractJson,
    url: process.env['DATABASE_URL']!,
  });

  public readonly db = this.client.orm.public;
}