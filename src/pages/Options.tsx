import { useState } from 'react';
import { useStore } from '../data/store';
import { Badge, Field, SourceLine, optionPrice } from '../components/ui';
import { ErrorNote, WhoAmI, fromCents, toCents, today, useAction, useMe } from '../components/forms';
import { latestFx, optionProv } from '../lib/model';
import { cityName, tierName, ukDate } from '../lib/format';
import type { Bundle, Option } from '../lib/types';

const CATEGORY = { stay: 'Stay', activity: 'Activity', food: 'Food', transport: 'Transport', payment: 'Payment' } as const;
const STATUS = { shortlist: 'Shortlist', chosen: 'Chosen', rejected: 'Rejected' } as const;

export function Options() {
  const { bundle, role } = useStore();
  const b = bundle!;
  const [city, setCity] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('live');

  const list = b.options.filter((o) =>
    (city === 'all' || (city === 'none' ? o.city_id === null : o.city_id === city)) &&
    (category === 'all' || o.category === category) &&
    (status === 'all' || (status === 'live' ? o.status !== 'rejected' : o.status === status)));
  const staleDays = Number(b.settings.stale_after_days) || undefined;

  return (
    <>
      <div className="page-head">
        <h1>Options</h1>
        <p>Every hotel, activity, transfer and payment tool we have looked at, with its price and where the price came from.</p>
      </div>

      <div className="card stack">
        <div className="form two">
          <Field label="City">
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="all">All</option><option value="boston">Boston</option><option value="nyc">NYC</option>
              <option value="none">Either city, or not decided</option>
            </select>
          </Field>
          <Field label="Type">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All</option>
              {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="live">Shortlist and chosen</option><option value="all">All</option>
              <option value="chosen">Chosen</option><option value="shortlist">Shortlist</option><option value="rejected">Rejected</option>
            </select>
          </Field>
          <WhoAmI />
        </div>
        {role === 'organiser' && (
          <details>
            <summary>Add an option</summary>
            <OptionForm b={b} />
          </details>
        )}
      </div>

      <section aria-live="polite">
        <p className="caption" style={{ marginBottom: 16 }}>{list.length} of {b.options.length} options</p>
        <div className="stack">
          {list.map((o) => <OptionCard key={o.id} o={o} b={b} staleDays={staleDays} />)}
          {list.length === 0 && <p className="muted">Nothing matches those filters.</p>}
        </div>
      </section>
    </>
  );
}

function OptionCard({ o, b, staleDays }: { o: Option; b: Bundle; staleDays?: number }) {
  const { role, call } = useStore();
  const { me } = useMe();
  const act = useAction();
  const [comment, setComment] = useState('');
  const fx = latestFx(b);
  const p = optionPrice(o, fx);
  const votes = b.votes.filter((v) => v.option_id === o.id);
  const mine = votes.find((v) => v.guest_id === me?.id)?.vote ?? 0;
  const comments = b.comments.filter((c) => c.entity_type === 'option' && c.entity_id === o.id);
  const name = (id: number) => b.guests.find((g) => g.id === id)?.name ?? 'Guest';
  const vote = (v: 1 | -1) => act.run(() => call('api_vote', { p_guest_id: me!.id, p_option_id: o.id, p_vote: mine === v ? 0 : v }));

  return (
    <article className="card stack-sm" aria-label={o.name}>
      <h3>{o.name}</h3>
      <ul className="pill-list">
        <li><Badge kind="plain">{o.city_id ? cityName[o.city_id] : 'Either city'}</Badge></li>
        <li><Badge kind="plain">{CATEGORY[o.category]}</Badge></li>
        {o.tier && <li><Badge kind="plain">{tierName[o.tier]}</Badge></li>}
        <li><Badge kind={o.status === 'chosen' ? 'ok' : 'plain'}>{STATUS[o.status]}</Badge></li>
        {o.model_input && <li><Badge kind="plain">Used in totals</Badge></li>}
        {o.excluded_from_totals && <li><Badge kind="plain">Never in a total</Badge></li>}
      </ul>
      <p className="num">
        <strong>{p.main}</strong> {p.unit} {p.other && <span className="muted">· {p.other}</span>}
      </p>
      {o.price_note && <p className="caption">{o.price_note}</p>}
      <SourceLine prov={optionProv(b, o)} staleDays={staleDays} />
      {(o.lead_time_note || o.lead_time_days !== null) && (
        <p><span className="muted">Book ahead:</span> {o.lead_time_note ?? `${o.lead_time_days} days`}</p>
      )}
      {o.groom_fit_note && <p><span className="muted">Fit for the groom:</span> {o.groom_fit_note}</p>}
      {o.notes && <p className="muted">{o.notes}</p>}

      <div className="row" style={{ marginTop: 8 }}>
        <button className={`btn small ${mine === 1 ? '' : 'secondary'}`} aria-pressed={mine === 1} disabled={!me || act.busy} onClick={() => vote(1)}>
          For · {votes.filter((v) => v.vote === 1).length}
        </button>
        <button className={`btn small ${mine === -1 ? '' : 'secondary'}`} aria-pressed={mine === -1} disabled={!me || act.busy} onClick={() => vote(-1)}>
          Against · {votes.filter((v) => v.vote === -1).length}
        </button>
        {!me && <span className="caption">Choose your name above to vote.</span>}
      </div>

      <details>
        <summary>Comments ({comments.length})</summary>
        <div className="stack-sm">
          {comments.map((c) => (
            <p key={c.id}><strong>{name(c.guest_id)}</strong> <span className="caption">{ukDate(c.created_at)}</span><br />{c.body}</p>
          ))}
          {me ? (
            <form className="form" onSubmit={async (e) => {
              e.preventDefault();
              if (await act.run(() => call('api_comment', { p_guest_id: me.id, p_entity_type: 'option', p_entity_id: o.id, p_body: comment }))) setComment('');
            }}>
              <Field label={`Comment as ${me.name}`}><textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></Field>
              <div><button className="btn small" disabled={act.busy || !comment.trim()}>Add comment</button></div>
            </form>
          ) : <p className="caption">Choose your name above to comment.</p>}
        </div>
      </details>
      <ErrorNote error={act.error} />

      {role === 'organiser' && (
        <>
          <details><summary>Edit</summary><OptionForm b={b} o={o} /></details>
          <details><summary>Add a source</summary><SourceForm entityType="option" entityId={o.id} /></details>
        </>
      )}
    </article>
  );
}

function OptionForm({ b, o }: { b: Bundle; o?: Option }) {
  const { call } = useStore();
  const act = useAction();
  const fx = latestFx(b);
  const gbp = o?.currency === 'GBP';
  const [f, setF] = useState({
    name: o?.name ?? '', category: o?.category ?? 'activity', city_id: o?.city_id ?? '', tier: o?.tier ?? '',
    currency: o?.currency ?? 'USD',
    low: fromCents(gbp ? o?.quoted_amount : o?.price_amount), high: fromCents(gbp ? o?.quoted_amount_high : o?.price_amount_high),
    price_unit: o?.price_unit ?? 'per_person', price_note: o?.price_note ?? '', status: o?.status ?? 'shortlist',
    lead_time_days: o?.lead_time_days?.toString() ?? '', lead_time_note: o?.lead_time_note ?? '',
    groom_fit_note: o?.groom_fit_note ?? '', notes: o?.notes ?? '', verified: o?.verified ?? false,
  });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setSaved(false); setF({ ...f, [k]: e.target.value }); };
  const hasSource = o ? optionProv(b, o).sources.length > 0 : false;

  const save = () => act.run(async () => {
    if (!f.name.trim()) throw new Error('Give the option a name.');
    const low = toCents(f.low), high = toCents(f.high);
    if (f.currency === 'GBP' && low !== null && !fx) throw new Error('Add an exchange rate before entering a price in pounds.');
    const usd = (c: number | null) => (c === null ? null : f.currency === 'GBP' ? Math.round(c * fx!.rate) : c);
    await call('api_upsert', {
      p_table: 'options',
      p_row: {
        ...(o ? { id: o.id } : {}),
        name: f.name.trim(), category: f.category, city_id: f.city_id || null, tier: f.tier || null, currency: f.currency,
        price_amount: usd(low), price_amount_high: low === null ? null : usd(high),
        quoted_amount: f.currency === 'GBP' ? low : null, quoted_amount_high: f.currency === 'GBP' && low !== null ? high : null,
        price_unit: f.price_unit, price_note: f.price_note.trim() || null, status: f.status,
        lead_time_days: f.lead_time_days === '' ? null : Number(f.lead_time_days), lead_time_note: f.lead_time_note.trim() || null,
        groom_fit_note: f.groom_fit_note.trim() || null, notes: f.notes.trim() || null, verified: f.verified,
      },
    });
    setSaved(true);
    if (!o) setF({ ...f, name: '', low: '', high: '', price_note: '', notes: '' });
  });

  return (
    <form className="form two" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Field label="Name" full><input type="text" value={f.name} onChange={set('name')} required /></Field>
      <Field label="Type"><select value={f.category} onChange={set('category')}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="City"><select value={f.city_id} onChange={set('city_id')}><option value="">Either, or not decided</option><option value="boston">Boston</option><option value="nyc">NYC</option></select></Field>
      <Field label="Tier"><select value={f.tier} onChange={set('tier')} disabled={o?.model_input}><option value="">None</option><option value="budget">Budget</option><option value="mid">Mid</option><option value="premium">Premium</option></select></Field>
      <Field label="Status"><select value={f.status} onChange={set('status')}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Price quoted in"><select value={f.currency} onChange={set('currency')}><option value="USD">US dollars</option><option value="GBP">Pounds</option></select></Field>
      <Field label="Price is"><select value={f.price_unit} onChange={set('price_unit')}><option value="per_person">Per person</option><option value="per_room_night">Per room per night</option><option value="flat">Flat</option></select></Field>
      <Field label={`Price (${f.currency === 'GBP' ? '£' : '$'}), or the low end`}><input type="number" inputMode="decimal" min="0" step="any" value={f.low} onChange={set('low')} /></Field>
      <Field label="High end, if a range"><input type="number" inputMode="decimal" min="0" step="any" value={f.high} onChange={set('high')} /></Field>
      <Field label="Price note" full><input type="text" value={f.price_note} onChange={set('price_note')} /></Field>
      <Field label="Book ahead (days)"><input type="number" inputMode="numeric" min="0" value={f.lead_time_days} onChange={set('lead_time_days')} /></Field>
      <Field label="Booking note"><input type="text" value={f.lead_time_note} onChange={set('lead_time_note')} /></Field>
      <Field label="Fit for the groom" full><input type="text" value={f.groom_fit_note} onChange={set('groom_fit_note')} /></Field>
      <Field label="Notes" full><textarea value={f.notes} onChange={set('notes')} /></Field>
      <label className="full row">
        <input type="checkbox" checked={f.verified} disabled={!hasSource} onChange={(e) => { setSaved(false); setF({ ...f, verified: e.target.checked }); }} style={{ width: 22, height: 22 }} />
        <span>Verified{!hasSource && <span className="caption"> · add a source first</span>}</span>
      </label>
      <div className="full row">
        <button className="btn" disabled={act.busy}>{o ? 'Save changes' : 'Add option'}</button>
        {saved && <span role="status"><Badge kind="ok">Saved</Badge></span>}
      </div>
      <div className="full"><ErrorNote error={act.error} /></div>
    </form>
  );
}

export function SourceForm({ entityType, entityId }: { entityType: 'option' | 'assumption'; entityId: number }) {
  const { call } = useStore();
  const act = useAction();
  const blank = { title: '', url: '', date: today(), publisher: '', quote: '' };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="form two" onSubmit={async (e) => {
      e.preventDefault();
      if (await act.run(() => call('api_add_source', {
        p_entity_type: entityType, p_entity_id: entityId, p_title: f.title, p_url: f.url.trim() || null,
        p_date_checked: f.date, p_publisher: f.publisher, p_quote: f.quote,
      }))) setF(blank);
    }}>
      <p className="caption full">Only add a page you have opened yourself. Then you can mark the figure verified.</p>
      <Field label="Page title" full><input type="text" value={f.title} onChange={set('title')} required /></Field>
      <Field label="Link" full><input type="url" value={f.url} onChange={set('url')} placeholder="https://" /></Field>
      <Field label="Date checked"><input type="date" value={f.date} onChange={set('date')} required /></Field>
      <Field label="Publisher"><input type="text" value={f.publisher} onChange={set('publisher')} /></Field>
      <Field label="The figure as the page gives it" full><input type="text" value={f.quote} onChange={set('quote')} /></Field>
      <div className="full"><button className="btn small" disabled={act.busy}>Add source</button></div>
      <div className="full"><ErrorNote error={act.error} /></div>
    </form>
  );
}
