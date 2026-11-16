import { beforeAll, describe, expect, it } from 'vitest';
import { bundleFor, freshDb } from './db';
import type { Bundle, CityId, Tier } from '../src/lib/types';
import { breakEven, costFor, latestFx } from '../src/lib/model';
import { computeCost, type CostInputs, type Scenario } from '../src/lib/cost';
import { usdToGbp, wholeUnits } from '../src/lib/format';

let b: Bundle;
beforeAll(async () => {
  b = await bundleFor(await freshDb());
});

const dollars = (cents: number) => wholeUnits(cents);
const pounds = (cents: number) => wholeUnits(usdToGbp(cents, latestFx(b)!.rate));

describe('seeded scenario: Budget, 2 nights, 12 people, 4 Boston-based, group covers the groom', () => {
  const s: Scenario = { nights: 2, groupSize: 12, localGuests: 4, groomCovered: true };

  it('Boston matches requirements section 7', () => {
    const { result: r } = costFor(b, 'boston', 'budget', s);
    expect(r.bedsNeeded).toBe(8);
    expect(r.rooms).toBe(2);
    expect(dollars(r.visitorPays)).toBe(540);
    expect(dollars(r.localPays)).toBe(310);
    expect(dollars(r.groupTotal)).toBe(5019);
    expect(r.groomPays).toBe(0);
  });

  it('NYC matches requirements section 7', () => {
    const { result: r } = costFor(b, 'nyc', 'budget', s);
    expect(r.bedsNeeded).toBe(12);
    expect(r.rooms).toBe(3);
    expect(dollars(r.visitorPays)).toBe(558);
    expect(dollars(r.localPays)).toBe(593);
    expect(dollars(r.groupTotal)).toBe(6273);
  });

  it('the shares add up to the group total', () => {
    for (const city of ['boston', 'nyc'] as CityId[]) {
      const { result: r } = costFor(b, city, 'budget', s);
      expect(r.visitors * r.visitorPays + r.locals * r.localPays + r.groomPays).toBeCloseTo(r.groupTotal, 6);
    }
  });

  it('GBP is converted from the unrounded total at 1.32', () => {
    expect(latestFx(b)!.rate).toBe(1.32);
    const boston = costFor(b, 'boston', 'budget', s).result;
    const nyc = costFor(b, 'nyc', 'budget', s).result;
    // Section 7 shows 410 and 423 for the visiting guest: it converted already-rounded dollars.
    expect(pounds(boston.visitorPays)).toBe(409);
    expect(pounds(boston.localPays)).toBe(235);
    expect(pounds(boston.groupTotal)).toBe(3802);
    expect(pounds(nyc.visitorPays)).toBe(422);
    expect(pounds(nyc.localPays)).toBe(449);
    expect(pounds(nyc.groupTotal)).toBe(4752);
  });
});

describe('research phase 1 table (no Boston-based guests, groom pays his own way)', () => {
  const cases: [Tier, number, number, number, number][] = [
    // tier, nights, group, Boston $, NYC $
    ['budget', 2, 6, 572, 575],
    ['budget', 2, 8, 495, 511],
    ['budget', 2, 10, 541, 549],
    ['budget', 3, 6, 820, 807],
    ['budget', 3, 8, 705, 712],
    ['budget', 3, 10, 774, 769],
    ['mid', 2, 6, 1122, 1120],
    ['mid', 2, 10, 1122, 1120],
    ['mid', 3, 8, 1608, 1553],
    ['premium', 2, 8, 1852, 2107], // research shows 2,106: the exact figure is 2,106.50
    ['premium', 3, 10, 2641, 2907],
  ];
  it.each(cases)('%s, %i nights, group of %i', (tier, nights, groupSize, boston, nyc) => {
    const s: Scenario = { nights, groupSize, localGuests: 0, groomCovered: false };
    expect(dollars(costFor(b, 'boston', tier, s).result.visitorPays)).toBe(boston);
    expect(dollars(costFor(b, 'nyc', tier, s).result.visitorPays)).toBe(nyc);
  });

  it('the cities tie at a Boston 4-star rate of about $548 (Mid, 2 nights)', () => {
    const be = breakEven(b, 'mid', { nights: 2, groupSize: 8, localGuests: 0, groomCovered: false })!;
    expect(dollars(be.rate)).toBe(548);
    expect(be.current).toBe(55000);
    expect(be.bostonCheaper).toBe(false);
  });
});

describe('formula behaviour', () => {
  const base: CostInputs = {
    roomRate: 20000, taxPct: 10, nightlyFee: 100, bedsPerRoom: 2, dailySpend: 5000, activities: 4000,
    transferFare: 0, localsNeedBed: false, visitorLegs: 0, localLegs: 0,
  };

  it('rounds rooms up and charges for the empty bed', () => {
    const r = computeCost(base, { nights: 2, groupSize: 5, localGuests: 0, groomCovered: false });
    expect(r.rooms).toBe(3);
    expect(r.stayTotal).toBeCloseTo(3 * (20000 * 1.1 + 100) * 2, 6);
    expect(r.stayPerBed).toBeCloseTo(r.stayTotal / 5, 6);
  });

  it('a Boston-based guest pays no room cost but still pays daily spend and activities', () => {
    const r = computeCost(base, { nights: 2, groupSize: 6, localGuests: 2, groomCovered: false });
    expect(r.bedsNeeded).toBe(4);
    expect(r.localPays).toBe(5000 * 2 + 4000);
  });

  it('covering the groom spreads his whole cost over everyone else', () => {
    const s = { nights: 2, groupSize: 6, localGuests: 0 };
    const off = computeCost(base, { ...s, groomCovered: false });
    const on = computeCost(base, { ...s, groomCovered: true });
    expect(on.payers).toBe(5);
    expect(on.groomPays).toBe(0);
    expect(on.visitorPays).toBeCloseTo(off.visitorPays + off.groomOwn / 5, 6);
    expect(on.groupTotal).toBeCloseTo(off.groupTotal, 6);
  });

  it('adds the transfer by leg, and a third night adds a night of room and daily spend', () => {
    const nyc = { ...base, transferFare: 3500, visitorLegs: 1, localLegs: 2, localsNeedBed: true };
    const two = computeCost(nyc, { nights: 2, groupSize: 4, localGuests: 1, groomCovered: false });
    const three = computeCost(nyc, { nights: 3, groupSize: 4, localGuests: 1, groomCovered: false });
    expect(two.localPays - two.visitorPays).toBe(3500);
    expect(three.visitorPays - two.visitorPays).toBeCloseTo(two.stayPerBed / 2 + 5000, 6);
  });

  it('never counts more Boston-based guests than there are non-groom guests', () => {
    const r = computeCost(base, { nights: 2, groupSize: 4, localGuests: 9, groomCovered: true });
    expect(r.locals).toBe(3);
    expect(r.visitors).toBe(0);
    expect(r.bedsNeeded).toBe(1);
  });
});

describe('flights', () => {
  it('no flight is a calculator input', () => {
    const flights = b.options.filter((o) => o.excluded_from_totals);
    expect(flights.length).toBe(5);
    expect(flights.some((o) => o.model_input)).toBe(false);
  });
});
