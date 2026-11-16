import { useState } from 'react';
import { useStore } from '../data/store';
import { Badge, Field, FxNote, Seg } from '../components/ui';
import { ErrorNote, fromCents, toCents, today, useAction } from '../components/forms';
import { costFor, latestFx } from '../lib/model';
import { money, moneyExact, ukDate, usdToGbp } from '../lib/format';
import type { Bundle, CityId, FxRate, Guest, Payment } from '../lib/types';
import { scenarioLine } from './Costs';

/** What a payment is worth in the currency the guest was quoted. */
function owed(p: Payment): string {
  return p.currency === 'GBP' && p.quoted_amount !== null ? moneyExact(p.quoted_amount, 'GBP') : moneyExact(p.amount, 'USD');
}

export function Payments() {
  const { bundle, calc, call } = useStore();
  const b = bundle!;
  const fx = latestFx(b);
  const act = useAction();
  const [city, setCity] = useState<CityId>('boston');
  const buffer = Number(b.settings.payment_buffer_pct) || 0;
  const [bufferText, setBufferText] = useState(String(buffer));
  const r = costFor(b, city, calc.tier, calc).result;

  // Suggested share from the calculator: no bed needed means Boston-based.
  const share = (g: Guest) => (g.role === 'groom' ? r.groomPays : g.bed_needed ? r.visitorPays : r.localPays) * (1 + buffer / 100);
  const unpaid = b.payments.filter((p) => !p.paid_date);

  return (
    <>
      <div className="page-head">
        <h1>Payments</h1>
        <p>A record of who owes what and who has paid. Money moves through Wise or PayPal, not this site. No card or bank details are kept.</p>
      </div>

      <div className="card stack">
        <Seg label="Work out shares for" value={city} onChange={setCity} options={[{ value: 'boston', label: 'Boston' }, { value: 'nyc', label: 'NYC' }]} />
        <p className="caption">{scenarioLine(calc)}. <a href="#/costs">Change on the Costs page</a></p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); void act.run(() => call('api_set_setting', { p_key: 'payment_buffer_pct', p_value: String(Number(bufferText) || 0) })); }}>
          <Field label="Buffer for price and exchange-rate changes (%)">
            <input type="number" inputMode="decimal" min="0" max="50" step="any" value={bufferText} onChange={(e) => setBufferText(e.target.value)} style={{ maxWidth: 140 }} />
          </Field>
          <button className="btn small secondary" disabled={act.busy} style={{ alignSelf: 'flex-end' }}>Save buffer</button>
        </form>
        <p className="caption">Research suggests 5 to 10%. <Badge kind="warn">Unverified</Badge> Shares are built from estimates.</p>
        <FxNote fx={fx} />
        <ErrorNote error={act.error} />
      </div>

      <section>
        <h2>Guests</h2>
        <p>{b.guests.length} on the list. {unpaid.length} unpaid {unpaid.length === 1 ? 'record' : 'records'}.</p>
        <div className="stack">
          {b.guests.map((g) => <GuestCard key={g.id} g={g} b={b} fx={fx} suggested={share(g)} />)}
          <details className="card flat">
            <summary>Add a guest</summary>
            <GuestForm />
          </details>
        </div>
      </section>
    </>
  );
}

function GuestCard({ g, b, fx, suggested }: { g: Guest; b: Bundle; fx: FxRate | null; suggested: number }) {
  const { call } = useStore();
  const act = useAction();
  const mine = b.payments.filter((p) => p.guest_id === g.id);
  const inGuestCcy = (usdCents: number) => (g.currency === 'GBP' && fx ? usdToGbp(usdCents, fx.rate) : usdCents);
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const suggestedText = g.currency === 'GBP' && !fx ? null : money(inGuestCcy(suggested), g.currency);

  const add = () => act.run(async () => {
    const quoted = toCents(amount);
    if (quoted === null || quoted <= 0) throw new Error('Enter the amount owed.');
    if (g.currency === 'GBP' && !fx) throw new Error('Add an exchange rate first.');
    await call('api_upsert', {
      p_table: 'payments',
      p_row: {
        guest_id: g.id, currency: g.currency, due_date: due || null,
        amount: g.currency === 'GBP' ? Math.round(quoted * fx!.rate) : quoted,
        quoted_amount: g.currency === 'GBP' ? quoted : null,
      },
    });
    setAmount('');
  });

  return (
    <article className="card stack-sm" aria-label={g.name}>
      <div className="row between">
        <h3>{g.name}</h3>
        <span className="caption">{g.role === 'groom' ? 'Groom' : g.role === 'organiser' ? 'Organiser' : 'Guest'} · pays in {g.currency} · {g.bed_needed ? 'needs a bed' : 'no bed needed'}</span>
      </div>
      {suggestedText && <p className="muted">Suggested share with buffer: <strong className="num">{suggestedText}</strong></p>}

      {mine.map((p) => (
        <div key={p.id} className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span className="num">
            <strong>{owed(p)}</strong>{' '}
            {p.paid_date ? <Badge kind="ok">Paid {ukDate(p.paid_date)}</Badge> : <Badge kind="warn">Owed{p.due_date ? `, due ${ukDate(p.due_date)}` : ''}</Badge>}
          </span>
          <span className="row">
            <button className="btn small secondary" disabled={act.busy}
              onClick={() => act.run(() => call('api_upsert', { p_table: 'payments', p_row: { id: p.id, paid_date: p.paid_date ? null : today() } }))}>
              {p.paid_date ? 'Mark unpaid' : 'Mark paid'}
            </button>
            <button className="btn small quiet" disabled={act.busy} aria-label={`Remove the ${owed(p)} record for ${g.name}`}
              onClick={() => act.run(() => call('api_delete', { p_table: 'payments', p_id: p.id }))}>Remove</button>
          </span>
        </div>
      ))}

      <details>
        <summary>Record what {g.name} owes</summary>
        <form className="form two" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <Field label={`Amount (${g.currency === 'GBP' ? '£' : '$'})`}>
            <input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={suggestedText ? fromCents(Math.round(inGuestCcy(suggested) / 100) * 100) : ''} />
          </Field>
          <Field label="Due date"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <div className="full"><button className="btn small" disabled={act.busy}>Add record</button></div>
        </form>
      </details>
      {g.role !== 'organiser' && g.role !== 'groom' && (
        <details><summary>Edit guest</summary><GuestForm g={g} /></details>
      )}
      <ErrorNote error={act.error} />
    </article>
  );
}

function GuestForm({ g }: { g?: Guest }) {
  const { call } = useStore();
  const act = useAction();
  const [f, setF] = useState({ name: g?.name ?? '', home_country: g?.home_country ?? 'UK', currency: g?.currency ?? 'GBP', bed_needed: g?.bed_needed ?? true });
  return (
    <form className="form two" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await act.run(async () => {
        if (!f.name.trim()) throw new Error('Enter a name.');
        await call('api_upsert', { p_table: 'guests', p_row: { ...(g ? { id: g.id } : { role: 'group' }), name: f.name.trim(), home_country: f.home_country, currency: f.currency, bed_needed: f.bed_needed } });
      });
      if (ok && !g) setF({ ...f, name: '' });
    }}>
      <p className="caption full">First name only. No email, phone or bank details.</p>
      <Field label="Name"><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
      <Field label="Lives in">
        <select value={f.home_country} onChange={(e) => setF({ ...f, home_country: e.target.value, currency: e.target.value === 'UK' ? 'GBP' : 'USD' })}>
          <option value="UK">UK</option><option value="US">US</option>
        </select>
      </Field>
      <Field label="Pays in">
        <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as 'GBP' | 'USD' })}><option value="GBP">Pounds</option><option value="USD">US dollars</option></select>
      </Field>
      <Field label="Needs a bed">
        <select value={f.bed_needed ? 'yes' : 'no'} onChange={(e) => setF({ ...f, bed_needed: e.target.value === 'yes' })}>
          <option value="yes">Yes</option><option value="no">No (Boston-based)</option>
        </select>
      </Field>
      <div className="full"><button className="btn small" disabled={act.busy}>{g ? 'Save guest' : 'Add guest'}</button></div>
      <div className="full"><ErrorNote error={act.error} /></div>
    </form>
  );
}
