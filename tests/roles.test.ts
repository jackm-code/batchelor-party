import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { CODES, bundleFor, freshDb, rpcFor } from './db';
import type { Rpc } from '../src/data/pgliteRpc';
import { costFor } from '../src/lib/model';
import { wholeUnits } from '../src/lib/format';

let db: PGlite;
let rpc: Rpc;

beforeAll(async () => {
  db = await freshDb();
  rpc = rpcFor(db);
  // Some private data that must never leak to the wrong role.
  const org = { p_code: CODES.organiser };
  const guest = await rpc<any>('api_upsert', { ...org, p_table: 'guests', p_row: { name: 'Sam', home_country: 'UK', currency: 'GBP' } });
  await rpc('api_upsert', { ...org, p_table: 'payments', p_row: { guest_id: guest.id, amount: 54000, currency: 'GBP', quoted_amount: 40900 } });
  await rpc('api_comment', { ...org, p_guest_id: guest.id, p_entity_type: 'option', p_entity_id: 1, p_body: 'Do not tell Toby' });
});

describe('groom view before publish', () => {
  it('returns nothing but the role', async () => {
    const raw = await rpc<any>('api_bundle', { p_code: CODES.groom });
    expect(raw).toEqual({ role: 'groom', published: false });
  });
});

describe('group member', () => {
  it('sees options, decisions and questions, but not payments or the change log', async () => {
    const raw = await rpc<any>('api_bundle', { p_code: CODES.group });
    expect(raw.role).toBe('group');
    expect(raw.options.length).toBeGreaterThan(40);
    expect(raw.decisions.length).toBe(6);
    expect(raw.open_questions.length).toBe(10);
    expect(raw).not.toHaveProperty('payments');
    expect(raw).not.toHaveProperty('audit_log');
  });

  it('cannot publish the groom view', async () => {
    await expect(rpc('api_set_setting', { p_code: CODES.group, p_key: 'groom_view_published', p_value: 'true' })).rejects.toThrow(/permission/);
    await expect(rpc('api_set_setting', { p_code: CODES.groom, p_key: 'groom_view_published', p_value: 'true' })).rejects.toThrow(/permission/);
  });
});

describe('organiser', () => {
  it('sees payments and the change log', async () => {
    const b = await bundleFor(db, 'organiser');
    expect(b.payments.length).toBe(1);
    expect(b.audit_log.length).toBeGreaterThan(0);
  });
});

describe('groom view after publish', () => {
  it('shows what Verdict and Workings need, read-only, and nothing else', async () => {
    await rpc('api_set_setting', { p_code: CODES.organiser, p_key: 'groom_view_published', p_value: 'true' });
    const raw = await rpc<any>('api_bundle', { p_code: CODES.groom });
    expect(raw.published).toBe(true);
    for (const hidden of ['decisions', 'open_questions', 'guests', 'votes', 'comments', 'payments', 'audit_log', 'decision_history']) {
      expect(raw).not.toHaveProperty(hidden);
    }
    expect(raw.options.some((o: any) => o.category === 'payment')).toBe(false);
    expect(JSON.stringify(raw)).not.toContain('Do not tell Toby');

    // He can follow the workings: the seeded total still reproduces from what he is sent.
    const b = await bundleFor(db, 'groom');
    const r = costFor(b, 'boston', 'budget', { nights: 2, groupSize: 12, localGuests: 4, groomCovered: true }).result;
    expect(wholeUnits(r.visitorPays)).toBe(540);
    expect(b.sources.length).toBeGreaterThan(0);

    await expect(rpc('api_upsert', { p_code: CODES.groom, p_table: 'assumptions', p_row: { id: 1, value: 0 } })).rejects.toThrow(/permission/);
  });

  it('hides again when the organiser unpublishes', async () => {
    await rpc('api_set_setting', { p_code: CODES.organiser, p_key: 'groom_view_published', p_value: 'false' });
    expect(await rpc<any>('api_bundle', { p_code: CODES.groom })).toEqual({ role: 'groom', published: false });
  });

  it('logs who published and when', async () => {
    const log = (await bundleFor(db)).audit_log.filter((a) => a.table_name === 'app_settings' && a.row_id === 'groom_view_published');
    expect(log.length).toBe(2);
    expect(log[0].actor).toBe('Jack');
  });
});
