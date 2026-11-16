import type { PGlite } from '@electric-sql/pglite';

export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

/** Calls an api_* database function on an in-process Postgres (demo mode and tests). */
export function pgliteRpc(db: PGlite): Rpc {
  return async <T>(fn: string, args: Record<string, unknown> = {}) => {
    if (!/^api_[a-z_]+$/.test(fn)) throw new Error('Unknown function');
    const keys = Object.keys(args);
    const isJson = (v: unknown) => v !== null && typeof v === 'object';
    const list = keys.map((k, i) => `${k} => ${isJson(args[k]) ? `($${i + 1}::text)::jsonb` : `$${i + 1}`}`);
    const params = keys.map((k) => (isJson(args[k]) ? JSON.stringify(args[k]) : args[k]));
    const res = await db.query<{ r: T }>(`select ${fn}(${list.join(', ')}) as r`, params);
    return res.rows[0].r;
  };
}
