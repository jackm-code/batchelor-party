import { pgliteRpc, type Rpc } from './pgliteRpc';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** With no Supabase project configured, the site runs on a throwaway database in the browser. */
export const DEMO = !url || !key;

export const DEMO_CODES = {
  organiser: 'demo-organiser-code',
  group: 'demo-group-code-0000',
  groom: 'demo-groom-code-0000',
} as const;

const supabaseRpc: Rpc = async <T>(fn: string, args: Record<string, unknown> = {}) => {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? 'Something went wrong. Try again.');
  return body as T;
};

async function demoRpc(): Promise<Rpc> {
  const { PGlite } = await import('@electric-sql/pglite');
  const migrations = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
  const seed = (await import('../../supabase/seed.sql?raw')).default;
  const devSeed = (await import('../../supabase/dev_seed.sql?raw')).default;
  const db = new PGlite();
  for (const name of Object.keys(migrations).sort()) await db.exec(await migrations[name]());
  await db.exec(seed);
  await db.exec(devSeed);
  return pgliteRpc(db);
}

let rpc: Promise<Rpc> | undefined;
export function getRpc(): Promise<Rpc> {
  return (rpc ??= DEMO ? demoRpc() : Promise.resolve(supabaseRpc));
}
