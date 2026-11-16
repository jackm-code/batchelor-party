import { useId, type ReactNode } from 'react';
import type { Ccy, FxRate, Option } from '../lib/types';
import type { Provenance } from '../lib/model';
import { daysSince, money, moneyExact, ukDate, usdToGbp } from '../lib/format';

export function Badge({ kind, children }: { kind: 'warn' | 'ok' | 'plain'; children: ReactNode }) {
  const icon = kind === 'warn' ? '!' : kind === 'ok' ? '✓' : null;
  return (
    <span className={`badge ${kind}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export const VerifiedBadge = ({ ok }: { ok: boolean }) =>
  ok ? <Badge kind="ok">Verified</Badge> : <Badge kind="warn">Unverified</Badge>;

/** Source link and date, or "no source", always with the verified badge. */
export function SourceLine({ prov, staleDays }: { prov: Provenance | null; staleDays?: number }) {
  if (!prov) {
    return (
      <p className="caption">
        <VerifiedBadge ok={false} /> No source recorded.
      </p>
    );
  }
  // The badge already says "Unverified": do not repeat it as a note.
  const note = prov.statusNote && !/^unverified$/i.test(prov.statusNote) ? prov.statusNote : null;
  return (
    <div className="caption stack-sm">
      <p>
        <VerifiedBadge ok={prov.verified} /> {note}
        {prov.sources.length === 0 && (note ? ' · No source recorded.' : 'No source recorded.')}
      </p>
      {prov.sources.map((s, i) => (
        <p key={i}>
          Source: {s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}, checked {ukDate(s.date_checked)}
          {s.quote ? ` (“${s.quote}”)` : ''}
          {staleDays && daysSince(s.date_checked) > staleDays ? <> <Badge kind="plain">Over {staleDays} days old</Badge></> : null}
        </p>
      ))}
      {prov.conflicts.map((c) => (
        <div className="conflict" key={c.id}>
          <strong>Sources disagree: {c.title}.</strong> One says {c.value_a}
          {c.value_b ? <>; another says {c.value_b}</> : null}. Used: {c.used}. {c.why}
        </div>
      ))}
    </div>
  );
}

/** A total in USD with GBP beside it. */
export function Money({ cents, fx, small }: { cents: number; fx: FxRate | null; small?: boolean }) {
  return (
    <span className={`total${small ? ' sm' : ''}`}>
      <span className="usd">{money(cents)}</span>
      {fx && <span className="gbp">{money(usdToGbp(cents, fx.rate), 'GBP')}</span>}
    </span>
  );
}

export function FxNote({ fx }: { fx: FxRate | null }) {
  if (!fx) return <p className="caption"><Badge kind="warn">No exchange rate</Badge> GBP cannot be shown.</p>;
  return (
    <p className="caption">
      £1 = ${fx.rate.toFixed(2)}, rate of {ukDate(fx.as_of)}. USD is the stored figure; GBP is converted from it.
    </p>
  );
}

export function Seg<T extends string | number>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="seg">
        {options.map((o) => (
          <label key={String(o.value)}>
            <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Stepper({
  label, value, min, max, onChange, hint,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div>
      <label className="switch">
        <span>{label}</span>
        <span className="switch-state" aria-hidden="true">{checked ? 'Yes' : 'No'}</span>
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const unitWord = { per_person: 'per person', per_room_night: 'per room per night', flat: '' } as const;

/** An option's price in the currency it was quoted in, with the other currency beside it. */
export function optionPrice(o: Option, fx: FxRate | null): { main: string; other: string | null; unit: string } {
  const unit = unitWord[o.price_unit];
  if (o.price_amount === null) return { main: 'Price not known', other: null, unit: '' };
  const range = (lo: number, hi: number | null, ccy: Ccy) => (hi ? `${moneyExact(lo, ccy)} to ${moneyExact(hi, ccy)}` : moneyExact(lo, ccy));
  if (o.currency === 'GBP' && o.quoted_amount !== null) {
    const toUsd = (p: number) => (fx ? p * fx.rate : 0);
    return {
      main: range(o.quoted_amount, o.quoted_amount_high, 'GBP'),
      other: fx ? `about ${money(toUsd(o.quoted_amount))}${o.quoted_amount_high ? ` to ${money(toUsd(o.quoted_amount_high))}` : ''}` : null,
      unit,
    };
  }
  return {
    main: range(o.price_amount, o.price_amount_high, 'USD'),
    other: fx && o.price_amount > 0
      ? `about ${money(usdToGbp(o.price_amount, fx.rate), 'GBP')}${o.price_amount_high ? ` to ${money(usdToGbp(o.price_amount_high, fx.rate), 'GBP')}` : ''}`
      : null,
    unit,
  };
}
