import { useState } from 'react';
import { useStore } from '../data/store';
import { Badge, FxNote, Money, Seg, SourceLine, Stepper, Switch, optionPrice } from '../components/ui';
import { CITIES, GROUPS, NIGHTS, TIERS, breakEven, costFor, latestFx, optionProv, unverifiedCount } from '../lib/model';
import { pays, type Scenario, type Who } from '../lib/cost';
import { cityName, money, plural, tierName, ukDate, usdToGbp, wholeUnits } from '../lib/format';
import { workingsHref } from '../lib/route';
import type { Bundle, CityId, FxRate } from '../lib/types';

export function scenarioLine(c: { tier: keyof typeof tierName; nights: number; groupSize: number; localGuests: number; groomCovered: boolean }) {
  return `${tierName[c.tier]} · ${c.nights} nights · ${plural(c.groupSize, 'person', 'people')} · ${c.localGuests} Boston-based · ${
    c.groomCovered ? 'group covers the groom' : 'groom pays his own way'
  }`;
}

export function Costs() {
  const { bundle, calc, setCalc, overrides, resetOverrides } = useStore();
  const b = bundle!;
  const fx = latestFx(b);
  const shown: CityId[] = calc.city === 'both' ? CITIES : [calc.city];
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <>
      <div className="page-head">
        <h1>Costs</h1>
        <p>What each person pays for the party weekend, in each city. Flights are not included: they are listed separately below.</p>
      </div>

      <div className="card stack" aria-label="Calculator">
        <Seg label="City" value={calc.city} onChange={(city) => setCalc({ city })}
          options={[{ value: 'both', label: 'Both' }, { value: 'boston', label: 'Boston' }, { value: 'nyc', label: 'NYC' }]} />
        <Seg label="Tier" value={calc.tier} onChange={(tier) => setCalc({ tier })}
          options={TIERS.map((t) => ({ value: t, label: tierName[t] }))} />
        <Seg label="Nights" value={calc.nights} onChange={(nights) => setCalc({ nights })}
          options={NIGHTS.map((n) => ({ value: n as number, label: `${n} nights` }))} />
        <div className="grid2">
          <Stepper label="Group size" value={calc.groupSize} min={2} max={30} onChange={(groupSize) => setCalc({ groupSize })}
            hint="Everyone, including the groom." />
          <Stepper label="Boston-based guests" value={calc.localGuests} min={0} max={calc.groupSize - 1}
            onChange={(localGuests) => setCalc({ localGuests })} hint="They need no bed in Boston." />
        </div>
        <Switch label="Group covers the groom" checked={calc.groomCovered} onChange={(groomCovered) => setCalc({ groomCovered })}
          hint="His share is split between everyone else." />
      </div>

      {hasOverrides && (
        <p className="notice" style={{ marginTop: 16 }}>
          These totals use what-if values from the Workings page, not the saved ones.{' '}
          <button className="btn quiet small" onClick={resetOverrides}>Reset to saved values</button>
        </p>
      )}

      <section aria-live="polite">
        <h2>Per person</h2>
        <p>{scenarioLine(calc)}. Select a total to see how it is built.</p>
        <div className={shown.length > 1 ? 'grid2' : ''}>
          {shown.map((city) => <CityResult key={city} city={city} b={b} fx={fx} />)}
        </div>
        <div style={{ marginTop: 16 }}><FxNote fx={fx} /></div>
      </section>

      <BreakEvenCard b={b} />
      <Matrix b={b} fx={fx} />
      <Flights b={b} fx={fx} />
    </>
  );
}

function CityResult({ city, b, fx }: { city: CityId; b: Bundle; fx: FxRate | null }) {
  const { calc, overrides } = useStore();
  const { model, result } = costFor(b, city, calc.tier, calc, overrides);
  const u = unverifiedCount(model);
  const line = (who: Who, label: string, small = false) => (
    <a className="total-link" href={workingsHref(city, who)}>
      <span className="total-label">{label}</span>
      <Money cents={pays(result, who)} fx={fx} small={small} />
      <span className="see">See the workings</span>
    </a>
  );
  return (
    <div className="card">
      <div className="row between">
        <h3>{cityName[city]}</h3>
        {u.unverified > 0
          ? <Badge kind="warn">Unverified: {u.unverified} of {u.total} inputs</Badge>
          : <Badge kind="ok">All inputs verified</Badge>}
      </div>
      <div className="divide" style={{ marginTop: 16 }}>
        {result.visitors > 0 && line('visitor', 'Each visiting guest pays')}
        {result.locals > 0 && line('local', 'Each Boston-based guest pays', true)}
        {line('group', 'Whole group', true)}
      </div>
      <p className="caption" style={{ marginTop: 16 }}>
        {plural(result.rooms, 'room')} for {plural(result.bedsNeeded, 'bed')}.{' '}
        {calc.groomCovered ? `The groom pays nothing; ${plural(result.payers, 'person', 'people')} share his cost.` : 'The groom pays his own share.'}
        {fx ? ` £1 = $${fx.rate.toFixed(2)}.` : ''}
      </p>
    </div>
  );
}

export function BreakEvenCard({ b }: { b: Bundle }) {
  const { calc, overrides } = useStore();
  const be = breakEven(b, calc.tier, calc, overrides, calc.groupSize - calc.localGuests - 1 > 0 ? 'visitor' : 'local');
  if (!be) return null;
  return (
    <section>
      <h2>Break-even</h2>
      <div className="card stack-sm">
        <p>
          The two cities cost the same when a Boston room is <strong className="num">{money(be.rate)}</strong> a night before tax
          ({tierName[calc.tier]}, {calc.nights} nights).
        </p>
        <p>
          The model uses <strong className="num">{money(be.current)}</strong>, which is {money(be.gap)} {be.bostonCheaper ? 'below' : 'above'} that.
          So on these inputs <strong>{be.bostonCheaper ? 'Boston is cheaper' : 'NYC is cheaper'}</strong> for a visiting guest.
        </p>
        <p className="caption">
          <Badge kind="warn">Unverified</Badge> Room rates are estimates, not quotes. A real Boston quote decides this.{' '}
          <a href={workingsHref('boston', 'visitor')}>See the workings</a>
        </p>
      </div>
    </section>
  );
}

function Matrix({ b, fx }: { b: Bundle; fx: FxRate | null }) {
  const { calc, overrides } = useStore();
  const [who, setWho] = useState<Who>('visitor');
  return (
    <section>
      <h2>Every combination</h2>
      <p>
        Per person, with {calc.localGuests} Boston-based {calc.localGuests === 1 ? 'guest' : 'guests'} and{' '}
        {calc.groomCovered ? 'the group covering the groom' : 'the groom paying his own way'}. An arrow marks the cheaper city.
      </p>
      {calc.localGuests > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Seg label="Show the cost for" value={who} onChange={setWho}
            options={[{ value: 'visitor', label: 'A visiting guest' }, { value: 'local', label: 'A Boston-based guest' }]} />
        </div>
      )}
      <div className="grid2">
        {TIERS.flatMap((tier) => NIGHTS.map((nights) => (
          <div className="card flat" key={`${tier}${nights}`}>
            <table className="matrix">
              <caption>{tierName[tier]} · {nights} nights</caption>
              <thead>
                <tr><th scope="col">Group</th><th scope="col" className="r">Boston</th><th scope="col" className="r">NYC</th></tr>
              </thead>
              <tbody>
                {GROUPS.map((group) => {
                  const s: Scenario = { nights, groupSize: group, localGuests: Math.min(calc.localGuests, group - 1), groomCovered: calc.groomCovered };
                  const cell = (city: CityId) => {
                    const r = costFor(b, city, tier, s, overrides).result;
                    // A guest type that does not exist in this group has no cost to show.
                    if ((who === 'visitor' && r.visitors === 0) || (who === 'local' && r.locals === 0)) return null;
                    return pays(r, who);
                  };
                  const [bos, nyc] = [cell('boston'), cell('nyc')];
                  const td = (city: CityId, v: number | null, other: number | null) => (
                    <td className={`r${v !== null && other !== null && wholeUnits(v) < wholeUnits(other) ? ' low' : ''}`}>
                      {v === null ? <span className="muted">None</span> : (
                        <a href={workingsHref(city, who, { tier, nights, group })}
                          aria-label={`${cityName[city]}, group of ${group}: ${money(v)}${fx ? `, ${money(usdToGbp(v, fx.rate), 'GBP')}` : ''}${
                            other !== null && wholeUnits(v) < wholeUnits(other) ? ', the cheaper city' : ''}. See the workings.`}>
                          <span className="usd">{money(v)}</span>
                          {fx && <span className="gbp">{money(usdToGbp(v, fx.rate), 'GBP')}</span>}
                        </a>
                      )}
                    </td>
                  );
                  return (
                    <tr key={group}>
                      <th scope="row">{group}</th>
                      {td('boston', bos, nyc)}
                      {td('nyc', nyc, bos)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {fx && <p className="caption" style={{ marginTop: 8 }}>£1 = ${fx.rate.toFixed(2)}, rate of {ukDate(fx.as_of)}.</p>}
          </div>
        )))}
      </div>
      <p className="caption" style={{ marginTop: 16 }}><Badge kind="warn">Unverified</Badge> Every figure here is built from estimates.</p>
    </section>
  );
}

export function Flights({ b, fx }: { b: Bundle; fx: FxRate | null }) {
  const flights = b.options.filter((o) => o.excluded_from_totals);
  if (!flights.length) return null;
  return (
    <section>
      <h2>Flights, shown separately</h2>
      <p>Flights from the UK are never inside a total. Guests book their own.</p>
      <div className="card divide">
        {flights.map((o) => {
          const p = optionPrice(o, fx);
          return (
            <div key={o.id} className="stack-sm">
              <div className="row between">
                <span>{o.name.replace(/^Flight: /, '')}</span>
                <span className="num"><strong>{p.main}</strong> <span className="muted">{p.other}</span></span>
              </div>
              {o.price_note && <p className="caption">{o.price_note}</p>}
              <SourceLine prov={optionProv(b, o)} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
