import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = join(import.meta.dirname, '..', 'supabase');

/** A fresh in-process Postgres with every migration applied, then the seed. */
export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  const dir = join(root, 'migrations');
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
  return db;
}

export async function rows<T = Record<string, any>>(db: PGlite, sql: string, params: any[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

export async function count(db: PGlite, sql: string): Promise<number> {
  return Number((await rows(db, `select count(*) as n from (${sql}) q`))[0].n);
}
