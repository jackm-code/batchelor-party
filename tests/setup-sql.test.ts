import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
// @ts-expect-error plain JS build script
import { buildSetupSql } from '../scripts/build-setup-sql.mjs';

const file = readFileSync(join(import.meta.dirname, '..', 'supabase', 'setup.sql'), 'utf8');

describe('supabase/setup.sql (the file pasted into the SQL editor)', () => {
  it('is up to date with the migrations and seed', () => {
    expect(file).toBe(buildSetupSql());
  });

  it('runs cleanly on an empty database and leaves no passcodes set', async () => {
    const db = new PGlite();
    await db.exec(file);
    const n = async (sql: string) => Number((await db.query<{ n: number }>(`select count(*) as n from ${sql}`)).rows[0].n);
    expect(await n('options')).toBe(52);
    expect(await n('decisions')).toBe(6);
    expect(await n('access_codes')).toBe(0);
    expect(file).not.toContain('demo-organiser-code');
  });
});
