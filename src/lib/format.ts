import type { Ccy } from './types';

/** Cents to whole units, rounded half up. The only place money is rounded. */
export function wholeUnits(cents: number): number {
  return Math.round(Number((cents / 100).toFixed(6)));
}

const sym: Record<Ccy, string> = { USD: '$', GBP: '£' };

export function money(cents: number, ccy: Ccy = 'USD'): string {
  return sym[ccy] + wholeUnits(cents).toLocaleString('en-GB');
}

/** Exact amount, keeping pence or cents when there are any (for quoted prices). */
export function moneyExact(cents: number, ccy: Ccy = 'USD'): string {
  const n = cents / 100;
  return sym[ccy] + n.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}

/** USD cents to GBP pence, using a "1 GBP = rate USD" rate. Not rounded. */
export function usdToGbp(usdCents: number, gbpUsdRate: number): number {
  return usdCents / gbpUsdRate;
}

/** UK date, e.g. 16 Nov 2026. Accepts a date or timestamp string. */
export function ukDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function daysSince(iso: string, today = new Date()): number {
  return Math.floor((today.getTime() - new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime()) / 86400000);
}

export const tierName = { budget: 'Budget', mid: 'Mid', premium: 'Premium' } as const;
export const cityName = { boston: 'Boston', nyc: 'NYC' } as const;

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
