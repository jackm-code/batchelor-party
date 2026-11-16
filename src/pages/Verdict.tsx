import type { ReactNode } from 'react';
import { useStore } from '../data/store';
import { Badge, FxNote, Money, SourceLine, optionPrice } from '../components/ui';
import { assumptionProv, breakEven, costFor, findAssumption, latestFx } from '../lib/model';
import { pays, type Who } from '../lib/cost';
import { money, tierName, usdToGbp, wholeUnits } from '../lib/format';
import { workingsHref } from '../lib/route';
import type { Bundle, CityId } from '../lib/types';
import { Flights, scenarioLine } from './Costs';

// The qualitative points below come from docs/research-phase-1.md (16 Nov 2026),
// corrected for what Jack has since confirmed. Cost is worked out live.

const FIT: Record<CityId, string[]> = {
  boston: ['boda-borg', 'level99', 'mit-museum', 'tavern-of-tales', 'versus-arcade', 'improv-asylum'],
  nyc: ['comedy-cellar', 'beat-the-bomb', 'hex-and-co', 'barcade', 'spyscape'],
};

export function Verdict() {
  const { bundle, calc, overrides, resetOverrides, role } = useStore();
  const b = bundle!;
  const fx = latestFx(b);
  const final = b.settings.verdict_status === 'final';
  const boston = costFor(b, 'boston', calc.tier, calc, overrides).result;
  const nyc = costFor(b, 'nyc', calc.tier, calc, overrides).result;
  const who: Who = boston.visitors > 0 ? 'visitor' : 'local';
  const diff = pays(nyc, who) - pays(boston, who);
  const cheaper: CityId | null = wholeUnits(Math.abs(diff)) === 0 ? null : diff > 0 ? 'boston' : 'nyc';
  const be = breakEven(b, calc.tier, calc, overrides, who);
  const fact = (key: string) => findAssumption(b, key, 'boston') ?? findAssumption(b, key, null);
  const open = b.open_questions.filter((q) => q.status === 'open');

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">Recommendation {final ? <Badge kind="ok">Final</Badge> : <Badge kind="warn">Provisional</Badge>}</p>
        <h1 className="hero-pick" style={{ marginTop: 8 }}><span className="sr-only">Recommendation: </span>Boston</h1>
        <p>
          Boston wins on logistics and on fit for the groom. Cost is close and rests on estimated hotel rates
          {final ? '.' : ', so this stays provisional until there is a real quote.'}
        </p>
      </div>

      {Object.keys(overrides).length > 0 && (
        <p className="notice">
          This page is using what-if values from the Workings page.{' '}
          <button className="btn quiet small" onClick={resetOverrides}>Reset to saved values</button>
        </p>
      )}

      <section>
        <h2>Cost</h2>
        <p>
          {scenarioLine(calc)}. {role !== 'groom' && <a href="#/costs">Change</a>}
        </p>
        <div className="grid2">
          {(['boston', 'nyc'] as CityId[]).map((city) => (
            <a key={city} className="card total-link" href={workingsHref(city, who)}>
              <span className="total-label">{city === 'boston' ? 'Boston' : 'NYC'}, each {who === 'visitor' ? 'visiting' : 'Boston-based'} guest</span>
              <Money cents={pays(city === 'boston' ? boston : nyc, who)} fx={fx} />
              <span className="see">See the workings</span>
            </a>
          ))}
        </div>
        <div className="stack-sm" style={{ marginTop: 16 }}>
          <p aria-live="polite">
            <Edge city={cheaper} />{' '}
            {cheaper
              ? <>{cheaper === 'boston' ? 'Boston' : 'NYC'} is <strong className="num">{money(Math.abs(diff))}</strong>
                {fx ? ` (${money(usdToGbp(Math.abs(diff), fx.rate), 'GBP')})` : ''} cheaper per person.</>
              : 'The two cities cost the same per person.'}
          </p>
          {be && (
            <p className="muted">
              They tie when a Boston room is {money(be.rate)} a night; the model uses {money(be.current)}.
            </p>
          )}
          <p className="caption"><Badge kind="warn">Unverified</Badge> Built from estimates, not quotes. Flights are not included.</p>
          <FxNote fx={fx} />
        </div>
      </section>

      <Compare title="Fit for the groom" edge="boston"
        intro="Outgoing and nerdy, not into sport: games, geeky group activities, good food and a night out."
        boston={<><p>Boda Borg is the only one of its kind in the US, and he has not done it or Level99.</p><Picks b={b} city="boston" /></>}
        nyc={<><p>A deeper bench, all within a subway ride.</p><Picks b={b} city="nyc" /></>}
        foot={<p className="caption"><Badge kind="warn">Unverified</Badge> Activity prices are from search extracts, not checked on the venue's page.</p>} />

      <Compare title="Logistics for UK guests" edge="boston"
        intro="UK guests make one trip: the party, their own holiday in the week, then the wedding in Boston on Sun 30 May."
        boston={<ul className="bullets">
          <li>One return flight and one base.</li>
          <li>No transfer day before the wedding.</li>
          <li>Boston-based guests need no bed and no travel.</li>
        </ul>}
        nyc={<ul className="bullets">
          <li>An extra journey to Boston: about 4 hours by bus or train, so half a day goes.</li>
          <li>Boston-based guests need a bed and travel both ways.</li>
          <li>More flights from London, and lower floor fares.</li>
        </ul>}
        foot={<p className="caption"><Badge kind="warn">Unverified</Badge> Journey times and fares are from research phase 1, 16 Nov 2026.</p>} />

      <Compare title="Risk" edge={null}
        intro="Both carry risk. Neither is a deal-breaker yet."
        boston={<ul className="bullets">
          <li>Commencement season: hotels may be dear or sell out.</li>
          <li>Boston College {fact('bc_commencement_date')?.value_text}; MIT {fact('mit_commencement_dates')?.value_text}; Harvard {fact('harvard_commencement_date')?.value_text}.</li>
          <li>Book refundable rooms early.</li>
        </ul>}
        nyc={<ul className="bullets">
          <li>No legal group rental (Local Law 18), so hotels only.</li>
          <li>Comedy Cellar only takes bookings 2 to 3 weeks ahead.</li>
          <li>The whole group moves city before the wedding.</li>
        </ul>}
        foot={<>
          <p className="caption">Memorial Day is {fact('memorial_day')?.value_text}. Holiday prices hit the wedding weekend, not the party weekend.</p>
          <details>
            <summary>Sources for these dates</summary>
            <div className="stack">
              {['bc_commencement_date', 'mit_commencement_dates', 'harvard_commencement_date', 'memorial_day'].map((k) => {
                const a = fact(k);
                return a ? <div key={k}><p>{a.value_text}</p><SourceLine prov={assumptionProv(b, a)} /></div> : null;
              })}
            </div>
          </details>
        </>} />

      <section>
        <h2>The case for NYC</h2>
        <p>The strongest argument against the recommendation, with the numbers checked.</p>
        <div className="card stack">
          <ul className="bullets">
            <li>Rooms may be cheaper that weekend, because Boston is in commencement season.</li>
            <li>More to choose from: Comedy Cellar, Beat The Bomb, board game cafes and arcade bars.</li>
            <li>More flights from London; a $20 overnight train softens the transfer.</li>
          </ul>
          <div>
            <h3>Numbers check</h3>
            <table style={{ marginTop: 8 }}>
              <thead><tr><th scope="col">Per person</th><th scope="col" className="r">Boston</th><th scope="col" className="r">NYC</th></tr></thead>
              <tbody>
                {boston.visitors > 0 && <NumRow label="Visiting guest" a={boston.visitorPays} c={nyc.visitorPays} />}
                {boston.locals > 0 && <NumRow label="Boston-based guest" a={boston.localPays} c={nyc.localPays} />}
                <NumRow label="Whole group" a={boston.groupTotal} c={nyc.groupTotal} />
              </tbody>
            </table>
            {be && (
              <p style={{ marginTop: 16 }} aria-live="polite">
                NYC wins on cost once a Boston room passes <strong className="num">{money(be.rate)}</strong> a night ({tierName[calc.tier]}, {calc.nights} nights).
                The model uses {money(be.current)}, so <strong>{be.bostonCheaper ? 'the case does not hold on cost today' : 'the case holds on cost today'}</strong>.
              </p>
            )}
            <p className="caption" style={{ marginTop: 8 }}>
              <Badge kind="warn">Unverified</Badge> A real Boston hotel quote could flip this. <a href={workingsHref('boston', who)}>Try other rates in the workings</a>
            </p>
          </div>
          <div>
            <h3>Where it is weak</h3>
            <ul className="bullets" style={{ marginTop: 8 }}>
              <li>Half a day lost to the transfer.</li>
              <li>Boston-based guests pay for a bed and travel both ways.</li>
              <li>No group rental, and the headline comedy club cannot be booked far ahead.</li>
            </ul>
          </div>
        </div>
      </section>

      {open.length > 0 && (
        <section>
          <h2>Still open</h2>
          <div className="card">
            <ul className="bullets">{open.slice(0, 4).map((q) => <li key={q.id}>{q.question}</li>)}</ul>
            <p style={{ marginTop: 16 }}><a href="#/decisions">All decisions and open questions</a></p>
          </div>
        </section>
      )}

      <Flights b={b} fx={fx} />
    </>
  );
}

function Edge({ city }: { city: CityId | null }) {
  return <Badge kind="plain">Edge: {city === 'boston' ? 'Boston' : city === 'nyc' ? 'NYC' : 'neither'}</Badge>;
}

function Compare({ title, edge, intro, boston, nyc, foot }: {
  title: string; edge: CityId | null; intro: string; boston: ReactNode; nyc: ReactNode; foot?: ReactNode;
}) {
  return (
    <section>
      <h2>{title}</h2>
      <p>{intro}</p>
      <p style={{ marginBottom: 16 }}><Edge city={edge} /></p>
      <div className="grid2">
        <div className="card stack-sm"><h3>Boston</h3>{boston}</div>
        <div className="card stack-sm"><h3>NYC</h3>{nyc}</div>
      </div>
      {foot && <div className="stack-sm" style={{ marginTop: 16 }}>{foot}</div>}
    </section>
  );
}

function Picks({ b, city }: { b: Bundle; city: CityId }) {
  const fx = latestFx(b);
  const picks = FIT[city].map((slug) => b.options.find((o) => o.slug === slug)).filter((o) => o && o.status !== 'rejected');
  return (
    <ul className="bullets">
      {picks.map((o) => {
        const p = optionPrice(o!, fx);
        return <li key={o!.id}>{o!.name}{o!.price_amount !== null ? <span className="muted"> · {p.main}</span> : null}</li>;
      })}
    </ul>
  );
}

function NumRow({ label, a, c }: { label: string; a: number; c: number }) {
  return (
    <tr>
      <th scope="row" style={{ fontWeight: 400 }}>{label}</th>
      <td className="r">{money(a)}</td>
      <td className="r">{money(c)}</td>
    </tr>
  );
}
