#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d07646c7e51112f55427c15acce364874ac15b770a554eb5f608da29ab34bd5a/contract';
import endContract from '../../snapshots/d07646c7e51112f55427c15acce364874ac15b770a554eb5f608da29ab34bd5a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e98e2e822786bb134fde970e2e0ab68a01729384ede0c32e16bad816a6178bc3/contract';
import startContract from '../../snapshots/e98e2e822786bb134fde970e2e0ab68a01729384ede0c32e16bad816a6178bc3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'listing',
        column: col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
