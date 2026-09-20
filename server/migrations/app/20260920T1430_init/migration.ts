#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/e98e2e822786bb134fde970e2e0ab68a01729384ede0c32e16bad816a6178bc3/contract.d.ts';
import endContract from '../../snapshots/e98e2e822786bb134fde970e2e0ab68a01729384ede0c32e16bad816a6178bc3/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'listing',
        columns: [
          col('addedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('area', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('deposit', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('externalId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isExactAddress', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('latitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('longitude', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('price', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('rent', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('rooms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('listing_source_check_527f1cb0', "\"source\" IN ('GRATKA', 'OTODOM')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'listing',
        constraint: 'listing_source_externalId_key',
        columns: ['source', 'externalId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
