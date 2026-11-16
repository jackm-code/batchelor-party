import { useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { Badge, Field, Seg, Switch } from '../components/ui';
import { ErrorNote, today, useAction } from '../components/forms';
import { latestFx } from '../lib/model';
import { ukDate } from '../lib/format';
import { DEMO_CODES } from '../data/api';
import type { AuditRow } from '../lib/types';

const TABLE_NAMES: Record<string, string> = {
  options: 'option', assumptions: 'assumption', fx_rates: 'exchange rate', scenarios: 'saved scenario',
  decisions: 'decision', open_questions: 'question', app_settings: 'setting', guests: 'guest', payments: 'payment record',
};

function changeLine(a: AuditRow): string {
  const thing = TABLE_NAMES[a.table_name] ?? a.table_name;
  const name = String(a.new_row?.name ?? a.new_row?.title ?? a.new_row?.key ?? a.new_row?.question ?? a.old_row?.name ?? a.old_row?.key ?? `#${a.row_id}`);
  if (a.action !== 'update') return `${a.action === 'insert' ? 'Added' : 'Removed'} ${thing}: ${name}`;
  const changed = Object.keys(a.new_row ?? {}).filter((k) => !['updated_at', 'created_at'].includes(k) && JSON.stringify(a.old_row?.[k]) !== JSON.stringify(a.new_row?.[k]));
  return `Changed ${thing} “${name}”: ${changed.map((k) => `${k.replace(/_/g, ' ')} was ${JSON.stringify(a.old_row?.[k])}, now ${JSON.stringify(a.new_row?.[k])}`).join('; ')}`;
}

export function Settings({ exportPanel }: { exportPanel?: ReactNode }) {
  const { bundle, call, demo, signOut } = useStore();
  const b = bundle!;
  const act = useAction();
  const fx = latestFx(b);
  const groomName = b.guests.find((g) => g.role === 'groom')?.name ?? 'the groom';
  const [rate, setRate] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [note, setNote] = useState('');
  const [stale, setStale] = useState(b.settings.stale_after_days ?? '');
  const set = (key: string, value: string) => act.run(() => call('api_set_setting', { p_key: key, p_value: value }));
  const origin = `${location.origin}${location.pathname}`;

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Only you can see this page.</p>
      </div>
      <ErrorNote error={act.error} />

      <section style={{ marginTop: 0 }}>
        <h2>Groom view</h2>
        <div className="card stack">
          <Switch label={`Show the verdict to ${groomName}`} checked={b.published} onChange={(on) => set('groom_view_published', on ? 'true' : 'false')}
            hint={`When on, ${groomName}'s link opens the Verdict and Workings pages, read-only. When off, it shows nothing.`} />
          <p aria-live="polite">{b.published ? <Badge kind="ok">Published</Badge> : <Badge kind="plain">Hidden</Badge>}</p>
          <Seg label="The recommendation is" value={b.settings.verdict_status === 'final' ? 'final' : 'provisional'}
            onChange={(v) => set('verdict_status', v)} options={[{ value: 'provisional', label: 'Provisional' }, { value: 'final', label: 'Final' }]} />
        </div>
      </section>

      <section>
        <h2>Exchange rate</h2>
        <div className="card stack">
          <p>{fx ? <>In use: <strong className="num">£1 = ${fx.rate}</strong>, rate of {ukDate(fx.as_of)}.</> : 'No rate yet.'} The newest rate is used everywhere; older ones are kept.</p>
          <form className="form two" onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act.run(async () => {
              if (!(Number(rate) > 0)) throw new Error('Enter how many dollars one pound buys, for example 1.32.');
              await call('api_upsert', { p_table: 'fx_rates', p_row: { from_ccy: 'GBP', to_ccy: 'USD', rate: Number(rate), as_of: asOf, note: note.trim() || null } });
            });
            if (ok) { setRate(''); setNote(''); }
          }}>
            <Field label="Dollars for £1"><input type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
            <Field label="Date of the rate"><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} required /></Field>
            <Field label="Where it came from" full><input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="full"><button className="btn small" disabled={act.busy}>Add rate</button></div>
          </form>
          <details>
            <summary>Rate history ({b.fx_rates.length})</summary>
            <ul className="bullets">{b.fx_rates.map((f) => <li key={f.id}>£1 = ${f.rate} on {ukDate(f.as_of)}{f.note ? ` · ${f.note}` : ''}</li>)}</ul>
          </details>
        </div>
      </section>

      <section>
        <h2>Old prices</h2>
        <div className="card">
          <form className="row" onSubmit={(e) => { e.preventDefault(); void set('stale_after_days', String(Math.max(0, Math.floor(Number(stale) || 0)))); }}>
            <Field label="Flag a source as old after this many days (0 for never)">
              <input type="number" inputMode="numeric" min="0" value={stale} onChange={(e) => setStale(e.target.value)} style={{ maxWidth: 140 }} />
            </Field>
            <button className="btn small secondary" disabled={act.busy} style={{ alignSelf: 'flex-end' }}>Save</button>
          </form>
        </div>
      </section>

      {exportPanel}

      <section>
        <h2>Links to share</h2>
        <div className="card stack-sm">
          <p>Each role has its own link: the site address with the passcode on the end.</p>
          <p className="sum">{origin}?k=PASSCODE</p>
          {demo ? (
            <>
              <p className="caption">Demo passcodes (this is not the real site):</p>
              <ul className="bullets caption">
                {Object.entries(DEMO_CODES).map(([r, c]) => <li key={r}>{r}: <a href={`${origin}?k=${c}`}>{c}</a></li>)}
              </ul>
            </>
          ) : (
            <p className="caption">Passcodes are set in the database and only their hashes are stored, so they cannot be shown here. Anyone with a link has that role, so share the group link only with guests.</p>
          )}
          <div><button className="btn small secondary" onClick={signOut}>Forget my passcode on this device</button></div>
        </div>
      </section>

      <section>
        <h2>Change log</h2>
        <p>Every edit to inputs, options, decisions and settings: who, when and the old value.</p>
        <div className="card">
          {b.audit_log.length === 0 && <p className="muted">No changes yet.</p>}
          <ul className="bullets caption">
            {b.audit_log.slice(0, 60).map((a) => (
              <li key={a.id}>
                <strong>{a.actor}</strong>, {new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}: {changeLine(a)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
