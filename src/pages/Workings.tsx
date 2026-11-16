import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../data/store';
import { Badge, FxNote, Money, Seg, SourceLine } from '../components/ui';
import {
  affects, assumptionLabel, assumptionProv, costFor, fxProv, isCalcAssumption, latestFx, optionProv,
  overrideKey, unverifiedCount, type ModelInput, type Provenance,
} from '../lib/model';
import { pays, type Who } from '../lib/cost';
import { cityName, money, plural, tierName, ukDate, usdToGbp } from '../lib/format';
import { useRoute } from '../lib/route';
import type { Assumption, Bundle, CityId, Tier } from '../lib/types';
import { BreakEvenCard, scenarioLine } from './Costs';

/** Exact dollars and cents, for showing the sums before rounding. */
const d = (cents: number) => '$' + (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function showValue(unit: ModelInput['unit'] | Assumption['unit'], v: number): string {
  if (unit === 'usd_cents') return Number.isInteger(v / 100) ? money(v) : d(v);
  if (unit === 'percent') return `${v}%`;
  if (unit === 'flag') return v > 0 ? 'Yes' : 'No';
  return String(v);
}

const whoName: Record<Who, string> = { visitor: 'a visiting guest', local: 'a Boston-based guest', group: 'the whole group' };

export function Workings() {
  const { bundle, calc, setCalc, overrides, resetOverrides, role } = useStore();
  const b = bundle!;
  const { query } = useRoute();
  const [city, setCity] = useState<CityId>(query.get('city') === 'nyc' ? 'nyc' : 'boston');
  const [who, setWho] = useState<Who>((['visitor', 'local', 'group'] as Who[]).find((w) => w === query.get('who')) ?? 'visitor');

  // A link from the matrix pins the scenario it came from.
  const qs = query.toString();
  useEffect(() => {
    const tier = (['budget', 'mid', 'premium'] as Tier[]).find((t) => t === query.get('tier'));
    const nights = Number(query.get('nights'));
    const group = Number(query.get('group'));
    setCalc({ ...(tier ? { tier } : {}), ...(nights === 2 || nights === 3 ? { nights } : {}), ...(group >= 2 ? { groupSize: group } : {}) });
    if (query.get('city') === 'nyc' || query.get('city') === 'boston') setCity(query.get('city') as CityId);
    const w = (['visitor', 'local', 'group'] as Who[]).find((x) => x === query.get('who'));
    if (w) setWho(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const fx = latestFx(b);
  const { model, result: r } = costFor(b, city, calc.tier, calc, overrides);
  const i = model.inputs;
  const u = unverifiedCount(model);
  const hasOverrides = Object.keys(overrides).length > 0;

  // If this group has no guest of the chosen kind, fall back to one that exists.
  const shownWho: Who = who === 'visitor' && r.visitors === 0 ? 'local' : who === 'local' && r.locals === 0 ? 'visitor' : who;
  const total = pays(r, shownWho);
  const needsBed = shownWho === 'visitor' || i.localsNeedBed.value > 0;
  const transfer = shownWho === 'local' ? r.localTransfer : r.visitorTransfer;
  const own = shownWho === 'local' ? r.localOwn : r.visitorOwn;
  const usesTransfer = i.visitorLegs.value > 0 || i.localLegs.value > 0;
  const exactRooms = r.bedsNeeded / (i.bedsPerRoom.value || 1);
  const tax = i.roomRate.value * (i.taxPct.value / 100);
  const canGroup = role !== 'groom';

  return (
    <>
      <div className="page-head">
        <h1>Workings</h1>
        <p>How each total is built, one step at a time. Every figure shows where it came from.</p>
      </div>

      <div className="card stack">
        <Seg label="City" value={city} onChange={setCity} options={[{ value: 'boston', label: 'Boston' }, { value: 'nyc', label: 'NYC' }]} />
        <Seg label="Cost for" value={shownWho} onChange={setWho}
          options={[
            ...(r.visitors > 0 ? [{ value: 'visitor' as Who, label: 'Visiting guest' }] : []),
            ...(r.locals > 0 ? [{ value: 'local' as Who, label: 'Boston-based' }] : []),
            { value: 'group' as Who, label: 'Whole group' },
          ]} />
        <p className="caption">
          {scenarioLine(calc)}. {canGroup && <a href="#/costs">Change these on the Costs page</a>}
        </p>
      </div>

      <section aria-live="polite">
        <div className="card stack-sm">
          <p className="total-label">In {cityName[city]}, {whoName[shownWho]} pays</p>
          <Money cents={total} fx={fx} />
          <p>
            {u.unverified > 0
              ? <Badge kind="warn">Unverified: {u.unverified} of {u.total} inputs</Badge>
              : <Badge kind="ok">All inputs verified</Badge>}{' '}
            <span className="caption">Flights are not included.</span>
          </p>
          {hasOverrides && (
            <p className="notice">
              You are trying what-if values. Nothing is saved.{' '}
              <button className="btn quiet small" onClick={resetOverrides}>Reset to saved values</button>
            </p>
          )}
        </div>
      </section>

      <section>
        <h2>Step by step</h2>
        <ol className="steps">
          <Step title="How many beds?">
            <p>
              There are {plural(r.groupSize, 'person', 'people')} including the groom.{' '}
              {r.locals === 0
                ? 'Everyone needs a bed.'
                : i.localsNeedBed.value > 0
                  ? `Everyone needs a bed here, including the ${r.locals} Boston-based ${r.locals === 1 ? 'guest' : 'guests'}.`
                  : `The ${r.locals} Boston-based ${r.locals === 1 ? 'guest sleeps' : 'guests sleep'} at home.`}
            </p>
            <Sum>{r.locals > 0 && i.localsNeedBed.value === 0 ? `${r.groupSize} − ${r.locals} = ` : ''}<strong>{plural(r.bedsNeeded, 'bed')}</strong></Sum>
            {r.locals > 0 && <InputLine input={i.localsNeedBed} />}
          </Step>

          <Step title="How many rooms?">
            <p>{plural(i.bedsPerRoom.value, 'person shares', 'people share')} a room at the {tierName[calc.tier]} tier.</p>
            <Sum>
              {r.bedsNeeded} ÷ {i.bedsPerRoom.value} = {Number.isInteger(exactRooms) ? '' : `${exactRooms.toFixed(1)}, rounded up to `}
              <strong>{plural(r.rooms, 'room')}</strong>
            </Sum>
            {!Number.isInteger(exactRooms) && <p className="caption" style={{ marginTop: 8 }}>You pay for whole rooms, so some beds stay empty.</p>}
            <InputLine input={i.bedsPerRoom} />
          </Step>

          <Step title="One room for one night">
            <p>The room rate, plus hotel tax{i.nightlyFee.value ? ', plus a flat nightly fee' : ''}.</p>
            <Sum>
              {d(i.roomRate.value)} + {i.taxPct.value}% tax ({d(tax)}){i.nightlyFee.value ? ` + ${d(i.nightlyFee.value)} fee` : ''} = <strong>{d(r.roomNightCost)}</strong>
            </Sum>
            <InputLine input={i.roomRate} />
            <InputLine input={i.taxPct} />
            {(i.nightlyFee.value !== 0 || i.nightlyFee.prov?.conflicts.length) ? <InputLine input={i.nightlyFee} /> : null}
          </Step>

          <Step title="All rooms, all nights">
            <Sum>{r.rooms} × {d(r.roomNightCost)} × {calc.nights} nights = <strong>{d(r.stayTotal)}</strong></Sum>
            <p style={{ marginTop: 8 }}>That is split between the {r.bedsNeeded} people who have a bed.</p>
            <Sum>{d(r.stayTotal)} ÷ {r.bedsNeeded} = <strong>{d(r.stayPerBed)} each</strong></Sum>
          </Step>

          <Step title="Daily spend">
            <p>Food, drink, local transport, tax and tips.</p>
            <Sum>{d(i.dailySpend.value)} × {calc.nights} nights = <strong>{d(r.dailyTotal)}</strong></Sum>
            <InputLine input={i.dailySpend} />
          </Step>

          <Step title="Activities">
            <Sum><strong>{d(i.activities.value)}</strong> per person for the weekend</Sum>
            <InputLine input={i.activities} />
          </Step>

          {usesTransfer && (
            <Step title="Getting to Boston for the wedding">
              <p>
                A visiting guest travels NYC to Boston {i.visitorLegs.value === 1 ? 'once' : `${i.visitorLegs.value} times`}.
                {r.locals > 0 && ` A Boston-based guest travels ${i.localLegs.value === 2 ? 'there and back' : `${i.localLegs.value} times`}.`}
              </p>
              <Sum>
                Visiting: {i.visitorLegs.value} × {d(i.transferFare.value)} = <strong>{d(r.visitorTransfer)}</strong>
                {r.locals > 0 && <><br />Boston-based: {i.localLegs.value} × {d(i.transferFare.value)} = <strong>{d(r.localTransfer)}</strong></>}
              </Sum>
              <InputLine input={i.transferFare} />
              <InputLine input={i.visitorLegs} />
              {r.locals > 0 && <InputLine input={i.localLegs} />}
            </Step>
          )}

          {shownWho === 'group' ? (
            <Step title="Add it up for the whole group">
              <div className="card flat" style={{ marginTop: 8 }}>
                <Line label={`Rooms (${r.rooms} × ${calc.nights} nights)`} value={d(r.stayTotal)} />
                <Line label={`Daily spend (${r.groupSize} × ${d(r.dailyTotal)})`} value={d(r.groupSize * r.dailyTotal)} />
                <Line label={`Activities (${r.groupSize} × ${d(i.activities.value)})`} value={d(r.groupSize * i.activities.value)} />
                {usesTransfer && <Line label="Transfers" value={d((r.visitors + 1) * r.visitorTransfer + r.locals * r.localTransfer)} />}
                <Line grand label="Whole group" value={d(r.groupTotal)} />
              </div>
            </Step>
          ) : (
            <>
              <Step title={`Add up ${whoName[shownWho]}'s own costs`}>
                <div className="card flat" style={{ marginTop: 8 }}>
                  <Line label="Share of the rooms" value={needsBed ? d(r.stayPerBed) : '$0.00 (no bed needed)'} />
                  <Line label="Daily spend" value={d(r.dailyTotal)} />
                  <Line label="Activities" value={d(i.activities.value)} />
                  {usesTransfer && <Line label="Transfer" value={d(transfer)} />}
                  <Line grand label="Own costs" value={d(own)} />
                </div>
              </Step>

              <Step title={calc.groomCovered ? 'Cover the groom' : 'The groom'}>
                {calc.groomCovered ? (
                  <>
                    <p>
                      The groom needs a bed and travels like a visiting guest, so his costs are {d(r.groomOwn)}.
                      The other {plural(r.payers, 'person', 'people')} split that equally.
                    </p>
                    <Sum>{d(r.groomOwn)} ÷ {r.payers} = <strong>{d(r.groomShare)} each</strong></Sum>
                    <p className="caption" style={{ marginTop: 8 }}><Badge kind="warn">Unverified</Badge> Assumed; to confirm with the group.</p>
                  </>
                ) : (
                  <p>The groom pays his own {d(r.groomOwn)}. Nothing is added to anyone else.</p>
                )}
              </Step>
            </>
          )}

          <Step title="The total">
            {shownWho !== 'group' && <Sum>{d(own)} + {d(r.groomShare)} = <strong>{d(total)}</strong></Sum>}
            <p style={{ marginTop: 8 }}>Rounded to the nearest dollar only at the end: <strong className="num">{money(total)}</strong>.</p>
            {fx && (
              <>
                <p style={{ marginTop: 16 }}>In pounds, using £1 = ${fx.rate.toFixed(2)}:</p>
                <Sum>{d(total)} ÷ {fx.rate.toFixed(2)} = <strong>{money(usdToGbp(total, fx.rate), 'GBP')}</strong></Sum>
                <div className="input-line">
                  <div className="head"><span>Exchange rate, {ukDate(fx.as_of)}</span><span className="val">£1 = ${fx.rate.toFixed(2)}</span></div>
                  {fx.note && <p className="caption">{fx.note}</p>}
                  <SourceLine prov={fxProv(b, fx)} />
                </div>
              </>
            )}
            {!fx && <FxNote fx={fx} />}
          </Step>
        </ol>
      </section>

      <BreakEvenCard b={b} />
      <Register b={b} />
    </>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return <li><h3>{title}</h3><div style={{ marginTop: 4 }}>{children}</div></li>;
}
const Sum = ({ children }: { children: ReactNode }) => <p className="sum">{children}</p>;
const Line = ({ label, value, grand }: { label: string; value: string; grand?: boolean }) => (
  <div className={`result-line${grand ? ' grand' : ''}`}><span>{label}</span><span className="num">{value}</span></div>
);

/** One input: its value, where it came from, and a what-if box. */
function InputLine({ input }: { input: ModelInput }) {
  return (
    <div className="input-line">
      <div className="head">
        <span>{input.label}</span>
        <span className="val">{showValue(input.unit, input.value)}</span>
      </div>
      {input.detail && <p className="caption">{input.detail}</p>}
      {input.missing && <p className="caption"><Badge kind="warn">Missing</Badge> No stored value, so 0 is used.</p>}
      <SourceLine prov={input.prov} />
      {input.prov && input.unit !== 'flag' && <WhatIf prov={input.prov} unit={input.unit} saved={input.saved} label={input.label} />}
    </div>
  );
}

function WhatIf({ prov, unit, saved, label }: { prov: Provenance; unit: ModelInput['unit'] | Assumption['unit']; saved: number; label: string }) {
  const { overrides, setOverride } = useStore();
  const key = overrideKey(prov);
  const scale = unit === 'usd_cents' ? 100 : 1;
  const current = overrides[key];
  const active = current !== undefined && current !== saved;
  return (
    <details open={active || undefined}>
      <summary>Try a different value</summary>
      <div className="whatif">
        <label className="sr-only" htmlFor={`wi-${key}`}>What-if value for {label}{unit === 'usd_cents' ? ', in dollars' : unit === 'percent' ? ', percent' : ''}</label>
        <span aria-hidden="true">{unit === 'usd_cents' ? '$' : ''}</span>
        <input id={`wi-${key}`} type="number" inputMode="decimal" min={unit === 'beds' ? 1 : 0} step="any"
          value={current !== undefined ? current / scale : saved / scale}
          onChange={(e) => {
            const n = e.target.value === '' ? NaN : Number(e.target.value) * scale;
            setOverride(key, Number.isNaN(n) || n < (unit === 'beds' ? 1 : 0) ? null : n);
          }} />
        <span aria-hidden="true">{unit === 'percent' ? '%' : ''}</span>
        <button className="btn quiet small" disabled={!active} onClick={() => setOverride(key, null)}>Reset</button>
      </div>
      <p className="caption">
        {active ? <><Badge kind="plain">What-if</Badge> Saved value: {showValue(unit, saved)}. </> : null}
        Changes every total that uses this figure. Not saved.
      </p>
    </details>
  );
}

/** Assumptions register (FR-11): every assumption, its source and the totals it affects. */
function Register({ b }: { b: Bundle }) {
  const { overrides } = useStore();
  const rates = b.options.filter((o) => o.model_input);
  const calc = b.assumptions.filter(isCalcAssumption);
  const facts = b.assumptions.filter((a) => !isCalcAssumption(a) && a.unit === 'text');
  const background = b.assumptions.filter((a) => !isCalcAssumption(a) && a.unit !== 'text');
  const cityTag = (c: CityId | null) => (c ? cityName[c] : 'Both cities');

  const row = (a: Assumption) => {
    const prov = assumptionProv(b, a);
    const o = overrides[overrideKey(prov)];
    return (
      <div key={a.id} className="stack-sm">
        <div className="row between">
          <span><strong>{assumptionLabel(a)}</strong> <span className="muted">· {cityTag(a.city_id)}</span></span>
          <span className="num">
            {a.value !== null && a.unit !== 'text' ? showValue(a.unit, o ?? a.value) : null}
            {o !== undefined && o !== a.value ? <> <Badge kind="plain">What-if</Badge></> : null}
          </span>
        </div>
        {a.value_text && <p>{a.value_text}</p>}
        {a.reason && <p className="caption">{a.reason}</p>}
        <p className="caption">Affects: {affects(a)}</p>
        <SourceLine prov={prov} />
        {isCalcAssumption(a) && a.value !== null && a.unit !== 'flag' && a.unit !== 'text' &&
          <WhatIf prov={prov} unit={a.unit} saved={a.value} label={assumptionLabel(a)} />}
      </div>
    );
  };

  return (
    <section>
      <h2>Assumptions</h2>
      <p>Everything the totals rest on. Change one to see what it does; reset to go back.</p>
      <div className="stack">
        <details className="card flat">
          <summary>Room rates and transfer fares ({rates.length})</summary>
          <div className="divide">
            {rates.map((o) => {
              const prov = optionProv(b, o);
              const ov = overrides[overrideKey(prov)];
              return (
                <div key={o.id} className="stack-sm">
                  <div className="row between">
                    <span><strong>{o.name}</strong> <span className="muted">· {cityTag(o.city_id)} · {o.tier ? tierName[o.tier] : ''}</span></span>
                    <span className="num">{showValue('usd_cents', ov ?? o.price_amount!)}{ov !== undefined && ov !== o.price_amount ? <> <Badge kind="plain">What-if</Badge></> : null}</span>
                  </div>
                  {o.price_note && <p className="caption">{o.price_note}</p>}
                  <p className="caption">Affects: {o.city_id ? cityName[o.city_id] : ''} {o.tier ? tierName[o.tier] : ''} totals{o.category === 'stay' && o.city_id === 'boston' ? ', and the break-even' : ''}</p>
                  <SourceLine prov={prov} />
                  <WhatIf prov={prov} unit="usd_cents" saved={o.price_amount!} label={o.name} />
                </div>
              );
            })}
          </div>
        </details>
        <details className="card flat">
          <summary>Taxes, sharing, daily spend and activities ({calc.length})</summary>
          <div className="divide">{calc.map(row)}</div>
        </details>
        <details className="card flat">
          <summary>Facts ({facts.length})</summary>
          <div className="divide">{facts.map(row)}</div>
        </details>
        <details className="card flat">
          <summary>Background figures, not used in totals ({background.length})</summary>
          <div className="divide">{background.map(row)}</div>
        </details>
      </div>
    </section>
  );
}
