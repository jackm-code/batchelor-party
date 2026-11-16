import { beforeAll, describe, expect, it } from 'vitest';
import { CODES, bundleFor, freshDb, rpcFor } from './db';
import type { Bundle } from '../src/lib/types';
import { decisionsCsv, exportMarkdown, optionsCsv, questionsCsv, toCsv } from '../src/lib/export';

/** A strict RFC 4180 reader: if the export parses here, a spreadsheet will open it. */
function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && s[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

let b: Bundle;
beforeAll(async () => {
  const db = await freshDb();
  const rpc = rpcFor(db);
  const org = { p_code: CODES.organiser };
  // Awkward content: commas, quotes, a line break, a pipe, and a would-be formula.
  await rpc('api_upsert', {
    ...org, p_table: 'options',
    p_row: { name: 'Bar "The Tam", Boston', category: 'food', city_id: 'boston', price_unit: 'per_person', price_amount: 1250, notes: 'Line one\nLine two | piped' },
  });
  await rpc('api_upsert', { ...org, p_table: 'decisions', p_row: { date: '2026-11-17', title: '=SUM(A1)', decision: 'A, B and "C"', decided_by: 'Jack' } });
  b = await bundleFor(db);
});

describe('CSV', () => {
  it('quotes commas, quotes and line breaks', () => {
    const rows = parseCsv(toCsv(['a', 'b'], [['x, y', 'say "hi"'], ['two\nlines', null]]));
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['two\nlines', '']]);
  });

  it('exports every option, one row each, all rows the same width', () => {
    const rows = parseCsv(optionsCsv(b));
    expect(rows.length).toBe(b.options.length + 1);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
    const head = rows[0];
    const tam = rows.find((r) => r[head.indexOf('name')] === 'Bar "The Tam", Boston')!;
    expect(tam[head.indexOf('price_usd')]).toBe('12.50');
    expect(tam[head.indexOf('notes')]).toBe('Line one\nLine two | piped');
    expect(tam[head.indexOf('verified')]).toBe('Unverified');
  });

  it('carries the source and the quoted currency', () => {
    const rows = parseCsv(optionsCsv(b));
    const head = rows[0];
    const boda = rows.find((r) => r[head.indexOf('name')].startsWith('Boda Borg'))!;
    expect(boda[head.indexOf('sources')]).toContain('https://www.bodaborg.com/boston/hours-prices/');
    expect(boda[head.indexOf('sources')]).toContain('checked 16 Nov 2026');
    const flight = rows.find((r) => r[head.indexOf('name')].includes('Virgin'))!;
    expect(flight[head.indexOf('quoted_currency')]).toBe('GBP');
    expect(flight[head.indexOf('quoted_amount')]).toBe('511.00');
    expect(flight[head.indexOf('excluded_from_totals')]).toBe('Yes');
  });

  it('exports every decision and question, and defuses formulas', () => {
    const d = parseCsv(decisionsCsv(b));
    expect(d.length).toBe(b.decisions.length + 1);
    expect(new Set(d.map((r) => r.length)).size).toBe(1);
    expect(d.some((r) => r[2] === "'=SUM(A1)")).toBe(true);
    expect(d.some((r) => r[3] === 'A, B and "C"')).toBe(true);
    const q = parseCsv(questionsCsv(b));
    expect(q.length).toBe(b.open_questions.length + 1);
    expect(q.find((r) => r[3] === 'answered')![5]).toBe('Website stack and access');
  });

  it('starts with a byte-order mark and uses CRLF line ends', () => {
    const csv = decisionsCsv(b);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('Markdown', () => {
  it('has the decision log, every open question, options and the FX rate with its date', () => {
    const md = exportMarkdown(b, '2026-11-16');
    expect(md).toContain('# Bachelor party: decisions and options');
    expect(md).toContain('£1 = $1.32 (16 Nov 2026)');
    expect(md).toContain('## Decision log');
    for (const d of b.decisions) expect(md).toContain(d.decided_by);
    for (const q of b.open_questions.filter((x) => x.status === 'open')) expect(md).toContain(q.question);
    expect(md).toContain('### Flights (never inside a total)');
    expect(md).toContain('## Source conflicts');
  });

  it('keeps tables intact: no stray pipes or line breaks inside a row', () => {
    const md = exportMarkdown(b, '2026-11-16');
    expect(md).toContain('Line one Line two \\| piped');
    const lines = md.split('\n');
    let width = 0;
    for (const line of lines) {
      if (!line.startsWith('|')) { width = 0; continue; }
      const cols = line.replace(/\\\|/g, '').split('|').length;
      if (width === 0) width = cols;
      expect(cols).toBe(width);
    }
  });

  it('marks every figure Verified or Unverified', () => {
    const md = exportMarkdown(b, '2026-11-16');
    const optionRows = md.split('\n').filter((l) => l.startsWith('| ') && /\| (shortlist|chosen|rejected) \|/.test(l));
    expect(optionRows.length).toBe(b.options.length);
    for (const row of optionRows) expect(/\| (Verified|Unverified) \|/.test(row)).toBe(true);
  });
});
