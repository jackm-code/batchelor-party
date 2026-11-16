import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { count, freshDb, rows } from './db';

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
});

describe('schema (requirements section 4)', () => {
  it('has the ten core tables and four supporting tables', async () => {
    const found = (await rows(db, `select table_name from information_schema.tables where table_schema = 'public'`)).map(
      (r) => r.table_name,
    );
    for (const t of [
      'cities', 'options', 'scenarios', 'assumptions', 'fx_rates', 'sources', 'source_links', 'conflicts',
      'decisions', 'open_questions', 'guests', 'payments', 'votes', 'comments',
    ]) {
      expect(found).toContain(t);
    }
  });

  it('stores money as whole USD cents', async () => {
    const cols = await rows(
      db,
      `select table_name, column_name, data_type from information_schema.columns
       where (table_name = 'options' and column_name in ('price_amount', 'price_amount_high', 'quoted_amount'))
          or (table_name = 'payments' and column_name in ('amount', 'quoted_amount'))`,
    );
    expect(cols.length).toBe(5);
    for (const c of cols) expect(c.data_type).toBe('integer');
    expect(await count(db, `select 1 from assumptions where unit = 'usd_cents' and value <> trunc(value)`)).toBe(0);
  });

  it('new options and assumptions are unverified by default', async () => {
    await db.exec(`insert into options (slug, category, name, price_unit) values ('tmp-default', 'food', 'Tmp', 'flat')`);
    await db.exec(`insert into assumptions (key, value, unit) values ('tmp_default', 1, 'flag')`);
    expect((await rows(db, `select verified from options where slug = 'tmp-default'`))[0].verified).toBe(false);
    expect((await rows(db, `select verified from assumptions where key = 'tmp_default'`))[0].verified).toBe(false);
  });

  it('has row-level security on every table', async () => {
    expect(await count(db, `select 1 from pg_tables where schemaname = 'public' and not rowsecurity`)).toBe(0);
  });
});

describe('seed (requirements section 7)', () => {
  it('loads Boston and NYC', async () => {
    expect((await rows(db, `select id from cities order by id`)).map((r) => r.id)).toEqual(['boston', 'nyc']);
  });

  it('loads every price and estimate as unverified', async () => {
    expect(await count(db, `select 1 from options where verified`)).toBe(0);
    expect(await count(db, `select 1 from assumptions where verified and unit <> 'text'`)).toBe(0);
  });

  it('only marks a fact verified when it has a source', async () => {
    expect(
      await count(
        db,
        `select 1 from assumptions a where a.verified and not exists
           (select 1 from source_links l where l.entity_type = 'assumption' and l.entity_id = a.id)`,
      ),
    ).toBe(0);
  });

  it('created every source link it listed (no slug typos)', async () => {
    expect(await count(db, `select 1 from source_links where entity_type = 'option'`)).toBe(23);
    expect(await count(db, `select 1 from source_links where entity_type = 'assumption'`)).toBe(19);
    expect(await count(db, `select 1 from source_links where entity_type = 'fx_rate'`)).toBe(1);
  });

  it('has one modelled room rate and one transfer fare per tier', async () => {
    const stay = await rows(
      db,
      `select city_id, tier, price_amount from options where model_input and category = 'stay' order by city_id, price_amount`,
    );
    expect(stay.map((r) => [r.city_id, r.tier, r.price_amount])).toEqual([
      ['boston', 'budget', 40000], ['boston', 'mid', 55000], ['boston', 'premium', 85000],
      ['nyc', 'budget', 33000], ['nyc', 'mid', 42000], ['nyc', 'premium', 80000],
    ]);
    const transfer = await rows(
      db,
      `select tier, price_amount from options where model_input and category = 'transport' order by price_amount`,
    );
    expect(transfer.map((r) => [r.tier, r.price_amount])).toEqual([['budget', 3500], ['mid', 8000], ['premium', 18000]]);
  });

  it('has the tax, fee, beds, daily spend and activity inputs', async () => {
    const get = async (key: string, city: string | null) =>
      Number(
        (await rows(db, `select value from assumptions where key = $1 and city_id is not distinct from $2`, [key, city]))[0]
          .value,
      );
    expect(await get('hotel_tax_pct', 'boston')).toBe(14.95);
    expect(await get('hotel_tax_pct', 'nyc')).toBe(14.75);
    expect(await get('hotel_nightly_fee', 'nyc')).toBe(350);
    expect(await get('beds_per_room_budget', null)).toBe(4);
    expect(await get('beds_per_room_mid', null)).toBe(2);
    expect(await get('beds_per_room_premium', null)).toBe(2);
    expect(await get('daily_spend_budget', 'boston')).toBe(9500);
    expect(await get('daily_spend_budget', 'nyc')).toBe(10500);
    expect(await get('activity_budget_premium', 'nyc')).toBe(32500);
    expect(await count(db, `select 1 from assumptions where key like 'daily_spend_%' or key like 'activity_budget_%'`)).toBe(12);
  });

  it('keeps flights out of totals', async () => {
    expect(await count(db, `select 1 from options where name like 'Flight:%' and not excluded_from_totals`)).toBe(0);
    expect(await count(db, `select 1 from options where excluded_from_totals`)).toBe(5);
    expect(await count(db, `select 1 from options where excluded_from_totals and model_input`)).toBe(0);
  });

  it('uses FX of 1 GBP = 1.32 USD dated 16 Nov 2026, with a source', async () => {
    const fx = (
      await rows(
        db,
        `select f.rate, f.as_of::text as as_of, s.url from fx_rates f join sources s on s.id = f.source_id
         where from_ccy = 'GBP' and to_ccy = 'USD' order by as_of desc, f.id desc limit 1`,
      )
    )[0];
    expect(Number(fx.rate)).toBe(1.32);
    expect(fx.as_of).toBe('2026-11-16');
    expect(fx.url).toContain('exchangerates.org.uk');
  });

  it('loads the six known source conflicts, each with the value used and why', async () => {
    const c = await rows(db, `select title, used, why from conflicts`);
    expect(c.length).toBe(6);
    for (const row of c) {
      expect(row.used).toBeTruthy();
      expect(row.why).toBeTruthy();
    }
  });

  it('loads the decision log, open questions and the saved 12-person scenario', async () => {
    expect(await count(db, `select 1 from decisions`)).toBe(6);
    expect(await count(db, `select 1 from open_questions where status = 'open'`)).toBe(9);
    expect(await count(db, `select 1 from open_questions where status = 'answered'`)).toBe(1);
    const s = await rows(db, `select city_id, tier, nights, group_size, local_guests, groom_covered from scenarios order by city_id`);
    expect(s).toEqual([
      { city_id: 'boston', tier: 'budget', nights: 2, group_size: 12, local_guests: 4, groom_covered: true },
      { city_id: 'nyc', tier: 'budget', nights: 2, group_size: 12, local_guests: 4, groom_covered: true },
    ]);
  });

  it('starts with the groom view unpublished', async () => {
    expect((await rows(db, `select value from app_settings where key = 'groom_view_published'`))[0].value).toBe('false');
  });
});

describe('rules enforced by the database', () => {
  it('refuses to delete a decision', async () => {
    await expect(db.exec(`delete from decisions where id = 1`)).rejects.toThrow(/cannot be deleted/);
    expect(await count(db, `select 1 from decisions`)).toBe(6);
  });

  it('lets a decision be superseded instead', async () => {
    await db.exec(`
      insert into decisions (date, title, decision, decided_by) values ('2026-11-17', 'Tmp', 'Replaces the first', 'Jack');
      update decisions set superseded_by = (select max(id) from decisions) where id = 1;
    `);
    expect((await rows(db, `select superseded_by from decisions where id = 1`))[0].superseded_by).not.toBeNull();
  });

  it('refuses to close an open question without a decision', async () => {
    await expect(
      db.exec(`update open_questions set status = 'answered', answer = 'x' where status = 'open'`),
    ).rejects.toThrow(/answered_needs_decision/);
  });

  it('records who changed an input, when, and the old value', async () => {
    await db.exec(`
      begin;
      select set_config('app.actor', 'Jack', true);
      update options set price_amount = 45000 where slug = 'stay-boston-budget';
      commit;
    `);
    const log = (
      await rows(
        db,
        `select actor, at, old_row ->> 'price_amount' as old, new_row ->> 'price_amount' as new
         from audit_log where table_name = 'options' and action = 'update' order by id desc limit 1`,
      )
    )[0];
    expect(log.actor).toBe('Jack');
    expect(log.old).toBe('40000');
    expect(log.new).toBe('45000');
    expect(log.at).toBeTruthy();
  });

  it('refuses to edit or delete the audit trail', async () => {
    await expect(db.exec(`update audit_log set actor = 'x'`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`delete from audit_log`)).rejects.toThrow(/cannot be deleted/);
  });

  it('refuses a second model rate for the same city and tier', async () => {
    await expect(
      db.exec(
        `insert into options (slug, city_id, category, name, tier, price_amount, price_unit, model_input)
         values ('dup', 'boston', 'stay', 'Dup', 'budget', 1, 'per_room_night', true)`,
      ),
    ).rejects.toThrow();
  });
});
