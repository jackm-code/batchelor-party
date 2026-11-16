// CSV and Markdown export (FR-17). Pure functions: they take the loaded data
// and return text. Nothing here talks to the database or the browser.

import type { Bundle, Option } from './types';
import { assumptionLabel, assumptionProv, isCalcAssumption, latestFx, optionProv, type Provenance } from './model';
import { cityName, tierName, ukDate } from './format';

type Cell = string | number | boolean | null | undefined;

/** One CSV cell: quoted when needed, and never able to run as a spreadsheet formula. */
function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV, with a byte-order mark so Excel reads £ and accents correctly. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const dollars = (cents: number | null) => (cents === null ? null : (cents / 100).toFixed(2));
const sourcesText = (p: Provenance) => p.sources.map((s) => `${s.title}${s.url ? ` <${s.url}>` : ''}, checked ${ukDate(s.date_checked)}`).join(' | ');
const verifiedWord = (p: Provenance) => (p.verified ? 'Verified' : 'Unverified');
const city = (c: Option['city_id']) => (c ? cityName[c] : 'Either or TBC');

export function optionsCsv(b: Bundle): string {
  return toCsv(
    ['id', 'city', 'category', 'name', 'tier', 'status', 'price_usd', 'price_usd_high', 'price_unit', 'quoted_currency',
      'quoted_amount', 'quoted_amount_high', 'price_note', 'lead_time_days', 'lead_time_note', 'groom_fit_note', 'notes',
      'verified', 'sources', 'used_in_totals', 'excluded_from_totals', 'votes_for', 'votes_against'],
    b.options.map((o) => {
      const p = optionProv(b, o);
      const votes = b.votes.filter((v) => v.option_id === o.id);
      const gbp = o.currency === 'GBP';
      return [
        o.id, city(o.city_id), o.category, o.name, o.tier ? tierName[o.tier] : '', o.status,
        dollars(o.price_amount), dollars(o.price_amount_high), o.price_unit, o.currency,
        dollars(gbp ? o.quoted_amount : o.price_amount), dollars(gbp ? o.quoted_amount_high : o.price_amount_high),
        o.price_note, o.lead_time_days, o.lead_time_note, o.groom_fit_note, o.notes,
        verifiedWord(p), sourcesText(p), o.model_input, o.excluded_from_totals,
        votes.filter((v) => v.vote === 1).length, votes.filter((v) => v.vote === -1).length,
      ];
    }),
  );
}

export function decisionsCsv(b: Bundle): string {
  const title = (id: number | null) => (id === null ? '' : b.decisions.find((d) => d.id === id)?.title ?? `#${id}`);
  return toCsv(
    ['id', 'date', 'title', 'decision', 'reason', 'decided_by', 'linked_options', 'superseded_by'],
    [...b.decisions].sort((x, y) => x.id - y.id).map((d) => [
      d.id, d.date, d.title, d.decision, d.reason, d.decided_by,
      d.linked_option_ids.map((id) => b.options.find((o) => o.id === id)?.name ?? `#${id}`).join(' | '),
      title(d.superseded_by),
    ]),
  );
}

export function questionsCsv(b: Bundle): string {
  return toCsv(
    ['id', 'question', 'owner', 'status', 'answer', 'closed_by_decision'],
    b.open_questions.map((q) => [
      q.id, q.question, q.owner, q.status, q.answer,
      q.closed_by_decision_id ? b.decisions.find((d) => d.id === q.closed_by_decision_id)?.title ?? `#${q.closed_by_decision_id}` : '',
    ]),
  );
}

// ---------- Markdown ----------

const md = (v: Cell) => (v === null || v === undefined ? '' : String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '));
const table = (headers: string[], rows: Cell[][]) =>
  [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(md).join(' | ')} |`)].join('\n');

function priceText(o: Option): string {
  if (o.price_amount === null) return o.price_note ?? 'Not known';
  const gbp = o.currency === 'GBP' && o.quoted_amount !== null;
  const sym = gbp ? '£' : '$';
  const lo = (gbp ? o.quoted_amount! : o.price_amount) / 100;
  const hi = (gbp ? o.quoted_amount_high : o.price_amount_high);
  const unit = { per_person: ' pp', per_room_night: ' per room night', flat: '' }[o.price_unit];
  return `${sym}${lo}${hi ? `-${hi / 100}` : ''}${unit}`;
}

const mdSources = (p: Provenance) =>
  p.sources.map((s) => (s.url ? `[${s.title}](${s.url})` : s.title) + ` (${ukDate(s.date_checked)})`).join('; ') || 'None';

/** One Markdown document, laid out to refresh the Claude Project knowledge file. */
export function exportMarkdown(b: Bundle, today: string): string {
  const fx = latestFx(b);
  const out: string[] = [];
  out.push(`# Bachelor party: decisions and options`, '');
  out.push(`Exported ${ukDate(today)}. ${fx ? `FX: £1 = $${fx.rate} (${ukDate(fx.as_of)}).` : 'No exchange rate stored.'} Flights are never inside a total.`);
  out.push(`Verdict status: ${b.settings.verdict_status ?? 'provisional'}. Groom view: ${b.published ? 'published' : 'hidden'}.`, '');

  out.push('## Decision log', '');
  out.push(table(['Date', 'Decision', 'Reason', 'Decided by', 'Status'],
    [...b.decisions].sort((x, y) => x.id - y.id).map((d) => [
      ukDate(d.date), `${d.title}: ${d.decision}`, d.reason, d.decided_by,
      d.superseded_by ? `Superseded by "${b.decisions.find((x) => x.id === d.superseded_by)?.title ?? d.superseded_by}"` : 'Current',
    ])), '');

  const open = b.open_questions.filter((q) => q.status === 'open');
  const answered = b.open_questions.filter((q) => q.status === 'answered');
  out.push('## Open questions', '');
  out.push(open.length ? open.map((q, i) => `${i + 1}. ${q.question} (owner: ${q.owner})`).join('\n') : 'None.', '');
  if (answered.length) {
    out.push('## Answered questions', '');
    out.push(answered.map((q) => `- ${q.question} **${q.answer ?? 'Answered'}** (decision: ${b.decisions.find((d) => d.id === q.closed_by_decision_id)?.title ?? 'n/a'})`).join('\n'), '');
  }

  out.push('## Facts and assumptions', '');
  const facts = b.assumptions.filter((a) => a.unit === 'text');
  out.push(table(['Item', 'Value', 'Status', 'Source'],
    facts.map((a) => { const p = assumptionProv(b, a); return [assumptionLabel(a), a.value_text, `${p.verified ? 'Verified' : 'Unverified'}${a.status_note ? `. ${a.status_note}` : ''}`, mdSources(p)]; })), '');
  out.push('### Cost model inputs', '');
  out.push(table(['Input', 'City', 'Value', 'Status', 'Source'],
    b.assumptions.filter(isCalcAssumption).map((a) => {
      const p = assumptionProv(b, a);
      const v = a.unit === 'usd_cents' ? `$${a.value! / 100}` : a.unit === 'percent' ? `${a.value}%` : a.unit === 'flag' ? (a.value ? 'Yes' : 'No') : String(a.value);
      return [assumptionLabel(a), a.city_id ? cityName[a.city_id] : 'Both', v, verifiedWord(p), mdSources(p)];
    })), '');

  out.push('## Options', '');
  const groups: [string, (o: Option) => boolean][] = [
    ['Boston', (o) => o.city_id === 'boston' && !o.excluded_from_totals],
    ['NYC', (o) => o.city_id === 'nyc' && !o.excluded_from_totals],
    ['Either city, or not decided', (o) => o.city_id === null && o.category !== 'payment'],
    ['Payment tools', (o) => o.category === 'payment'],
    ['Flights (never inside a total)', (o) => o.excluded_from_totals],
  ];
  for (const [name, pick] of groups) {
    const rows = b.options.filter(pick);
    if (!rows.length) continue;
    out.push(`### ${name}`, '');
    out.push(table(['Option', 'Type', 'Tier', 'Price', 'Status', 'Verified', 'Source', 'Notes'],
      rows.map((o) => {
        const p = optionProv(b, o);
        return [o.name, o.category, o.tier ? tierName[o.tier] : '', priceText(o), o.status, verifiedWord(p), mdSources(p),
          [o.price_note, o.lead_time_note && `Book ahead: ${o.lead_time_note}`, o.groom_fit_note, o.notes].filter(Boolean).join(' ')];
      })), '');
  }

  if (b.conflicts.length) {
    out.push('## Source conflicts', '');
    out.push(table(['Figure', 'One source says', 'Another says', 'Used', 'Why'], b.conflicts.map((c) => [c.title, c.value_a, c.value_b, c.used, c.why])), '');
  }
  return out.join('\n');
}
