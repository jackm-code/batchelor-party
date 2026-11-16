import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { CODES, bundleFor, count, freshDb, rows, rpcFor } from './db';
import type { Rpc } from '../src/data/pgliteRpc';
import { costFor } from '../src/lib/model';
import { wholeUnits } from '../src/lib/format';

let db: PGlite;
let rpc: Rpc;
const org = { p_code: CODES.organiser };
const grp = { p_code: CODES.group };
const groom = { p_code: CODES.groom };

beforeAll(async () => {
  db = await freshDb();
  rpc = rpcFor(db);
});

describe('passcodes', () => {
  it('rejects an unknown passcode', async () => {
    await expect(rpc('api_bundle', { p_code: 'nope' })).rejects.toThrow(/not recognised/);
  });
  it('stores only a hash of each passcode', async () => {
    const stored = await rows(db, `select code_hash from access_codes`);
    expect(stored.length).toBe(3);
    for (const r of stored) expect(Object.values(CODES)).not.toContain(r.code_hash);
  });
});

describe('organiser edits', () => {
  it('changes an input, and every total follows', async () => {
    const before = await bundleFor(db);
    const rate = before.options.find((o) => o.slug === 'stay-boston-budget')!;
    await rpc('api_upsert', { ...org, p_table: 'options', p_row: { id: rate.id, price_amount: 50000 } });
    const after = await bundleFor(db);
    const s = { nights: 2, groupSize: 12, localGuests: 4, groomCovered: true };
    expect(wholeUnits(costFor(before, 'boston', 'budget', s).result.visitorPays)).toBe(540);
    expect(wholeUnits(costFor(after, 'boston', 'budget', s).result.visitorPays)).toBe(603);
    await rpc('api_upsert', { ...org, p_table: 'options', p_row: { id: rate.id, price_amount: 40000 } });
  });

  it('logs who, when and the old value', async () => {
    const log = (await bundleFor(db)).audit_log.find((a) => a.table_name === 'options' && a.action === 'update')!;
    expect(log.actor).toBe('Jack');
    expect(log.at).toBeTruthy();
    expect(log.old_row!.price_amount).toBe(50000);
  });

  it('adds a new option as unverified', async () => {
    const o = await rpc<any>('api_upsert', {
      ...org, p_table: 'options',
      p_row: { name: 'Test escape room', category: 'activity', city_id: 'boston', price_unit: 'per_person', price_amount: 4000 },
    });
    expect(o.verified).toBe(false);
    expect(o.status).toBe('shortlist');
  });

  it('will not mark a figure verified until it has a source', async () => {
    const o = (await rows(db, `select id from options where name = 'Test escape room'`))[0];
    await expect(rpc('api_upsert', { ...org, p_table: 'options', p_row: { id: o.id, verified: true } })).rejects.toThrow(/Add a source/);
    await rpc('api_add_source', {
      ...org, p_entity_type: 'option', p_entity_id: o.id, p_title: 'Venue price page',
      p_url: 'https://example.com/prices', p_date_checked: '2026-11-16', p_publisher: 'Venue', p_quote: '$40',
    });
    const saved = await rpc<any>('api_upsert', { ...org, p_table: 'options', p_row: { id: o.id, verified: true } });
    expect(saved.verified).toBe(true);
  });

  it('keeps exchange-rate history: a new rate is added, old ones cannot be edited', async () => {
    const old = (await rows(db, `select id from fx_rates limit 1`))[0];
    await expect(rpc('api_upsert', { ...org, p_table: 'fx_rates', p_row: { id: old.id, rate: 1.5 } })).rejects.toThrow(/history/);
    await rpc('api_upsert', { ...org, p_table: 'fx_rates', p_row: { from_ccy: 'GBP', to_ccy: 'USD', rate: 1.25, as_of: '2026-12-01' } });
    expect(await count(db, `select 1 from fx_rates`)).toBe(2);
    await db.exec(`delete from fx_rates where rate = 1.25`);
  });
});

describe('decisions are append-only', () => {
  it('cannot be deleted through the site', async () => {
    await expect(rpc('api_delete', { ...org, p_table: 'decisions', p_id: 1 })).rejects.toThrow(/cannot be deleted/);
  });

  it('can be superseded, and the old one stays in the log', async () => {
    const made = await rpc<any>('api_supersede_decision', {
      ...org, p_old_id: 1,
      p_row: { date: '2026-11-20', title: 'Three nights', decision: 'The party is three nights.', reason: 'Test', decided_by: 'Jack' },
    });
    const b = await bundleFor(db);
    expect(b.decisions.find((d) => d.id === 1)!.superseded_by).toBe(made.id);
    expect(b.decisions.length).toBe(7);
    await expect(rpc('api_supersede_decision', { ...org, p_old_id: 1, p_row: { date: '2026-11-21', title: 'x', decision: 'x', decided_by: 'Jack' } }))
      .rejects.toThrow(/already been superseded/);
  });

  it('shows who edited a decision and when', async () => {
    await rpc('api_upsert', { ...org, p_table: 'decisions', p_row: { id: 2, reason: 'Confirmed with the group.' } });
    const history = (await bundleFor(db, 'group')).decision_history.filter((h) => h.row_id === '2' && h.action === 'update');
    expect(history.length).toBe(1);
    expect(history[0].actor).toBe('Jack');
    expect(history[0].old_row!.reason).toBe('Assumed agreed; confirm with the group.');
  });
});

describe('open questions', () => {
  it('cannot be closed without the decision that answers it', async () => {
    const q = (await bundleFor(db)).open_questions.find((x) => x.status === 'open')!;
    await expect(rpc('api_upsert', { ...org, p_table: 'open_questions', p_row: { id: q.id, status: 'answered', answer: 'Sat-Sun' } }))
      .rejects.toThrow(/answered_needs_decision/);
    const closed = await rpc<any>('api_upsert', {
      ...org, p_table: 'open_questions', p_row: { id: q.id, status: 'answered', answer: 'Sat-Sun', closed_by_decision_id: 2 },
    });
    expect(closed.status).toBe('answered');
  });
});

describe('group members', () => {
  it('cannot edit inputs, options, decisions or settings', async () => {
    await expect(rpc('api_upsert', { ...grp, p_table: 'options', p_row: { id: 1, price_amount: 1 } })).rejects.toThrow(/permission/);
    await expect(rpc('api_upsert', { ...grp, p_table: 'assumptions', p_row: { id: 1, value: 1 } })).rejects.toThrow(/permission/);
    await expect(rpc('api_upsert', { ...grp, p_table: 'decisions', p_row: { date: '2026-11-16', title: 'x', decision: 'x', decided_by: 'x' } })).rejects.toThrow(/permission/);
    await expect(rpc('api_set_setting', { ...grp, p_key: 'groom_view_published', p_value: 'true' })).rejects.toThrow(/permission/);
    await expect(rpc('api_delete', { ...grp, p_table: 'scenarios', p_id: 1 })).rejects.toThrow(/permission/);
  });

  it('can vote, change a vote, take it back, and comment', async () => {
    const guest = await rpc<any>('api_upsert', { ...org, p_table: 'guests', p_row: { name: 'Sam', home_country: 'UK', currency: 'GBP' } });
    const opt = (await bundleFor(db)).options.find((o) => o.slug === 'boda-borg')!;
    await rpc('api_vote', { ...grp, p_guest_id: guest.id, p_option_id: opt.id, p_vote: 1 });
    await rpc('api_vote', { ...grp, p_guest_id: guest.id, p_option_id: opt.id, p_vote: -1 });
    let b = await bundleFor(db, 'group');
    expect(b.votes.filter((v) => v.option_id === opt.id).map((v) => v.vote)).toEqual([-1]);
    await rpc('api_vote', { ...grp, p_guest_id: guest.id, p_option_id: opt.id, p_vote: 0 });
    await rpc('api_comment', { ...grp, p_guest_id: guest.id, p_entity_type: 'option', p_entity_id: opt.id, p_body: ' Looks great ' });
    b = await bundleFor(db, 'group');
    expect(b.votes.length).toBe(0);
    expect(b.comments.map((c) => c.body)).toEqual(['Looks great']);
  });

  it('cannot vote as the groom', async () => {
    const toby = (await bundleFor(db)).guests.find((g) => g.role === 'groom')!;
    await expect(rpc('api_vote', { ...grp, p_guest_id: toby.id, p_option_id: 1, p_vote: 1 })).rejects.toThrow(/Choose your name/);
  });
});

describe('the groom', () => {
  it('cannot vote, comment or edit', async () => {
    await expect(rpc('api_vote', { ...groom, p_guest_id: 1, p_option_id: 1, p_vote: 1 })).rejects.toThrow(/permission/);
    await expect(rpc('api_comment', { ...groom, p_guest_id: 1, p_entity_type: 'option', p_entity_id: 1, p_body: 'hi' })).rejects.toThrow(/permission/);
    await expect(rpc('api_upsert', { ...groom, p_table: 'options', p_row: { id: 1, price_amount: 1 } })).rejects.toThrow(/permission/);
  });
});
