// Turns the stored options and assumptions into calculator inputs, keeping
// track of where each figure came from so the Workings view can show it.

import type { Assumption, Bundle, CityId, Conflict, EntityType, FxRate, Option, Tier } from './types';
import { breakEvenRoomRate, computeCost, type CostInputs, type CostResult, type Scenario, type Who } from './cost';

export const TIERS: Tier[] = ['budget', 'mid', 'premium'];
export const CITIES: CityId[] = ['boston', 'nyc'];
export const NIGHTS = [2, 3] as const;
export const GROUPS = [6, 8, 10, 12] as const;

export interface SourceRef { title: string; url: string | null; date_checked: string; quote: string | null }

export interface Provenance {
  entity: EntityType;
  id: number;
  verified: boolean;       // marked verified AND has a source
  statusNote: string | null;
  sources: SourceRef[];
  conflicts: Conflict[];
}

export type InputKey =
  | 'roomRate' | 'taxPct' | 'nightlyFee' | 'bedsPerRoom' | 'dailySpend' | 'activities'
  | 'transferFare' | 'localsNeedBed' | 'visitorLegs' | 'localLegs';

export interface ModelInput {
  key: InputKey;
  label: string;
  detail: string | null;   // e.g. the hotel set-up or the reason for the assumption
  unit: 'usd_cents' | 'percent' | 'beds' | 'legs' | 'flag';
  value: number;           // the value in use (may be a what-if)
  saved: number;           // the value stored in the database
  overridden: boolean;
  missing: boolean;        // no row found for this input
  prov: Provenance | null;
}

export interface CityModel { city: CityId; tier: Tier; inputs: Record<InputKey, ModelInput> }

/** What-if values, keyed by "option:12" or "assumption:3". Never saved. */
export type Overrides = Record<string, number>;
export const overrideKey = (p: Provenance) => `${p.entity}:${p.id}`;

export function latestFx(b: Bundle): FxRate | null {
  const rows = b.fx_rates.filter((f) => f.from_ccy === 'GBP' && f.to_ccy === 'USD');
  rows.sort((x, y) => (x.as_of < y.as_of ? 1 : x.as_of > y.as_of ? -1 : y.id - x.id));
  return rows[0] ?? null;
}

export function provenance(b: Bundle, entity: EntityType, id: number, verifiedFlag: boolean, statusNote: string | null = null): Provenance {
  const sources: SourceRef[] = [];
  for (const l of b.source_links) {
    if (l.entity_type !== entity || l.entity_id !== id) continue;
    const s = b.sources.find((x) => x.id === l.source_id);
    if (s) sources.push({ title: s.title, url: s.url, date_checked: s.date_checked, quote: l.quote_or_figure });
  }
  return {
    entity, id, statusNote, sources,
    verified: verifiedFlag && sources.length > 0,
    conflicts: b.conflicts.filter((c) => c.entity_type === entity && c.entity_id === id),
  };
}

export const optionProv = (b: Bundle, o: Option) => provenance(b, 'option', o.id, o.verified);
export const assumptionProv = (b: Bundle, a: Assumption) => provenance(b, 'assumption', a.id, a.verified, a.status_note);
export function fxProv(b: Bundle, f: FxRate): Provenance {
  return provenance(b, 'fx_rate', f.id, true);
}

export function findAssumption(b: Bundle, key: string, city: CityId | null): Assumption | undefined {
  return b.assumptions.find((a) => a.key === key && a.city_id === city);
}

export function cityModel(b: Bundle, city: CityId, tier: Tier, overrides: Overrides = {}): CityModel {
  const fromOption = (key: InputKey, label: string, category: Option['category']): ModelInput => {
    const o = b.options.find((x) => x.model_input && x.category === category && x.city_id === city && x.tier === tier);
    return finish(key, label, 'usd_cents', o?.price_amount ?? null, o ? optionProv(b, o) : null, o ? o.name : null);
  };
  const fromAssumption = (key: InputKey, label: string, aKey: string, aCity: CityId | null): ModelInput => {
    const a = findAssumption(b, aKey, aCity);
    return finish(key, label, (a?.unit as ModelInput['unit']) ?? 'usd_cents', a?.value ?? null, a ? assumptionProv(b, a) : null, a?.reason ?? null);
  };
  const finish = (
    key: InputKey, label: string, unit: ModelInput['unit'], saved: number | null, prov: Provenance | null, detail: string | null,
  ): ModelInput => {
    const o = prov ? overrides[overrideKey(prov)] : undefined;
    const overridden = o !== undefined && o !== saved;
    return { key, label, detail, unit, saved: saved ?? 0, value: overridden ? o! : saved ?? 0, overridden, missing: saved === null, prov };
  };

  return {
    city, tier,
    inputs: {
      roomRate: fromOption('roomRate', 'Room rate per night, before tax', 'stay'),
      taxPct: fromAssumption('taxPct', 'Hotel tax', 'hotel_tax_pct', city),
      nightlyFee: fromAssumption('nightlyFee', 'Flat fee per room per night', 'hotel_nightly_fee', city),
      bedsPerRoom: fromAssumption('bedsPerRoom', 'People per room', `beds_per_room_${tier}`, null),
      dailySpend: fromAssumption('dailySpend', 'Daily spend per person', `daily_spend_${tier}`, city),
      activities: fromAssumption('activities', 'Activities per person', `activity_budget_${tier}`, city),
      transferFare: fromOption('transferFare', 'Transfer fare, one way', 'transport'),
      localsNeedBed: fromAssumption('localsNeedBed', 'Boston-based guests need a bed', 'local_guests_need_bed', city),
      visitorLegs: fromAssumption('visitorLegs', 'Transfer legs for a visiting guest', 'transfer_legs_visitor', city),
      localLegs: fromAssumption('localLegs', 'Transfer legs for a Boston-based guest', 'transfer_legs_local', city),
    },
  };
}

export function toCostInputs(m: CityModel): CostInputs {
  const v = (k: InputKey) => m.inputs[k].value;
  return {
    roomRate: v('roomRate'), taxPct: v('taxPct'), nightlyFee: v('nightlyFee'), bedsPerRoom: v('bedsPerRoom') || 1,
    dailySpend: v('dailySpend'), activities: v('activities'), transferFare: v('transferFare'),
    localsNeedBed: v('localsNeedBed') > 0, visitorLegs: v('visitorLegs'), localLegs: v('localLegs'),
  };
}

/** Inputs that actually feed this result (a transfer fare with no legs does not). */
export function inputsInUse(m: CityModel): ModelInput[] {
  const i = m.inputs;
  const usesTransfer = i.visitorLegs.value > 0 || i.localLegs.value > 0;
  return Object.values(i).filter((x) => {
    if (x.key === 'transferFare') return usesTransfer;
    if (x.key === 'nightlyFee') return x.value !== 0 || x.overridden;
    return true;
  });
}

export function unverifiedCount(m: CityModel): { unverified: number; total: number } {
  const used = inputsInUse(m).filter((x) => x.unit === 'usd_cents' || x.unit === 'percent');
  return { unverified: used.filter((x) => !x.prov?.verified).length, total: used.length };
}

export interface CityCost { model: CityModel; inputs: CostInputs; result: CostResult }

export function costFor(b: Bundle, city: CityId, tier: Tier, s: Scenario, overrides: Overrides = {}): CityCost {
  const model = cityModel(b, city, tier, overrides);
  const inputs = toCostInputs(model);
  return { model, inputs, result: computeCost(inputs, s) };
}

export interface BreakEven { rate: number; current: number; bostonCheaper: boolean; gap: number }

/** Boston room rate at which the cities tie for this guest, and which side we are on. */
export function breakEven(b: Bundle, tier: Tier, s: Scenario, overrides: Overrides = {}, who: Who = 'visitor'): BreakEven | null {
  const boston = costFor(b, 'boston', tier, s, overrides);
  const nyc = costFor(b, 'nyc', tier, s, overrides);
  const rate = breakEvenRoomRate(boston.inputs, nyc.inputs, s, who);
  if (rate === null) return null;
  return { rate, current: boston.inputs.roomRate, bostonCheaper: boston.inputs.roomRate < rate, gap: Math.abs(rate - boston.inputs.roomRate) };
}

/** Which totals an assumption changes, in plain English (FR-11). */
export function affects(a: Assumption): string {
  const city = a.city_id === 'boston' ? 'Boston' : a.city_id === 'nyc' ? 'NYC' : 'both cities';
  const tier = (['budget', 'mid', 'premium'] as const).find((t) => a.key.endsWith('_' + t));
  const tierWord = tier ? { budget: 'Budget', mid: 'Mid', premium: 'Premium' }[tier] : '';
  if (a.key === 'hotel_tax_pct' || a.key === 'hotel_nightly_fee') return `Every ${city} total (room cost)`;
  if (a.key.startsWith('beds_per_room_')) return `${tierWord} totals in both cities (rooms needed)`;
  if (a.key.startsWith('daily_spend_')) return `${city} ${tierWord} totals`;
  if (a.key.startsWith('activity_budget_')) return `${city} ${tierWord} totals`;
  if (a.key === 'local_guests_need_bed') return `${city} totals when there are Boston-based guests`;
  if (a.key.startsWith('transfer_legs_')) return a.city_id === 'nyc' ? 'Every NYC total (transfer)' : 'Boston totals (no transfer today)';
  return 'No total. Background only.';
}

export const CALC_KEYS = [
  'hotel_tax_pct', 'hotel_nightly_fee', 'beds_per_room_', 'daily_spend_', 'activity_budget_',
  'local_guests_need_bed', 'transfer_legs_',
];
export const isCalcAssumption = (a: Assumption) => CALC_KEYS.some((k) => a.key.startsWith(k));

const KEY_LABELS: Record<string, string> = {
  hotel_tax_pct: 'Hotel tax', hotel_nightly_fee: 'Flat fee per room per night',
  beds_per_room_budget: 'People per room (Budget)', beds_per_room_mid: 'People per room (Mid)', beds_per_room_premium: 'People per room (Premium)',
  daily_spend_budget: 'Daily spend per person (Budget)', daily_spend_mid: 'Daily spend per person (Mid)', daily_spend_premium: 'Daily spend per person (Premium)',
  activity_budget_budget: 'Activities per person (Budget)', activity_budget_mid: 'Activities per person (Mid)', activity_budget_premium: 'Activities per person (Premium)',
  local_guests_need_bed: 'Boston-based guests need a bed', transfer_legs_visitor: 'Transfer legs, visiting guest', transfer_legs_local: 'Transfer legs, Boston-based guest',
  avg_may_hotel_rate: 'Average May hotel rate', weekend_avg_rate_3_star: 'Weekend average, 3-star', weekend_avg_rate_4_star: 'Weekend average, 4-star',
  weekend_avg_rate_5_star: 'Weekend average, 5-star', commencement_weekend_rate: 'Commencement weekend hotel rates',
  meal_tax_pct: 'Meal tax', restaurant_tip_pct: 'Tipping', median_beer_price: 'Median beer', cocktail_price: 'Cocktail',
  bc_commencement_date: 'Boston College commencement', harvard_commencement_date: 'Harvard commencement', mit_commencement_dates: 'MIT commencement',
  party_dates: 'Party dates', wedding_date: 'Wedding', memorial_day: 'Memorial Day 2027', headcount: 'Headcount',
  uk_guest_travel: 'UK guests\' travel', uk_guest_trip_budget: 'UK guests\' trip budget', group_covers_groom: 'Group covers the groom',
};
export const assumptionLabel = (a: Assumption) => KEY_LABELS[a.key] ?? a.key.replace(/_/g, ' ');
