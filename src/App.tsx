import { useState, type ReactNode } from 'react';
import { useStore } from './data/store';
import { DEMO_CODES } from './data/api';
import { useRoute } from './lib/route';
import type { Role } from './lib/types';
import { ExportPanel } from './components/ExportPanel';
import { Costs } from './pages/Costs';
import { Decisions } from './pages/Decisions';
import { Options } from './pages/Options';
import { Payments } from './pages/Payments';
import { Settings } from './pages/Settings';
import { Verdict } from './pages/Verdict';
import { Workings } from './pages/Workings';

interface Page { path: string; label: string; roles: Role[]; wide?: boolean; render: () => ReactNode }

// Which role sees which page (requirements section 5). The database enforces the
// same rules: a role is never sent data for a page it cannot open.
const PAGES: Page[] = [
  { path: 'verdict', label: 'Verdict', roles: ['organiser', 'group', 'groom'], render: () => <Verdict /> },
  { path: 'costs', label: 'Costs', roles: ['organiser', 'group'], wide: true, render: () => <Costs /> },
  { path: 'workings', label: 'Workings', roles: ['organiser', 'group', 'groom'], render: () => <Workings /> },
  { path: 'options', label: 'Options', roles: ['organiser', 'group'], render: () => <Options /> },
  { path: 'decisions', label: 'Decisions', roles: ['organiser', 'group'], render: () => <Decisions /> },
  { path: 'payments', label: 'Payments', roles: ['organiser'], render: () => <Payments /> },
  { path: 'settings', label: 'Settings', roles: ['organiser'], render: () => <Settings exportPanel={<ExportPanel />} /> },
];

const ROLE_NAME: Record<Role, string> = { organiser: 'Organiser', group: 'Guest', groom: 'Groom' };

export function App() {
  const { status, error, bundle, role } = useStore();
  const route = useRoute();

  if (status === 'loading') return <Centre><p className="muted" role="status">Loading…</p></Centre>;
  if (status === 'need-code') return <SignIn />;
  if (status === 'error' || !bundle || !role) {
    return <Centre><h1>Something went wrong</h1><p className="muted" style={{ marginTop: 16 }}>{error ?? 'Try again in a moment.'}</p></Centre>;
  }

  // The groom's link shows nothing at all until the organiser publishes.
  if (role === 'groom' && !bundle.published) {
    return (
      <>
        <DemoBar />
        <Centre>
          <h1>Nothing to see yet</h1>
          <p className="muted" style={{ marginTop: 16 }}>Check back later.</p>
        </Centre>
      </>
    );
  }

  const pages = PAGES.filter((p) => p.roles.includes(role));
  const page = pages.find((p) => p.path === route.path) ?? pages[0];

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <DemoBar />
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-row">
            <span className="brand">Boston or NYC</span>
            <span className="caption">{ROLE_NAME[role]}{role === 'organiser' && !bundle.published ? ' · groom view hidden' : role === 'organiser' ? ' · groom view published' : role === 'groom' ? ' · read-only' : ''}</span>
          </div>
          <nav className="nav" aria-label="Pages">
            {pages.map((p) => (
              <a key={p.path} href={`#/${p.path}`} aria-current={p === page ? 'page' : undefined}>{p.label}</a>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className={page.wide ? 'wide' : ''} key={page.path} tabIndex={-1}>
        {page.render()}
      </main>
    </>
  );
}

/** Demo mode only: try the site as each role. */
function DemoBar() {
  const { demo, role, signIn } = useStore();
  if (!demo) return null;
  return (
    <div className="demo-bar">
      <label>
        <span>Demo data, not saved. View as </span>
        <select value={role ?? 'organiser'} onChange={(e) => { location.hash = '#/'; signIn(DEMO_CODES[e.target.value as Role]); }}>
          <option value="organiser">Organiser (Jack)</option>
          <option value="group">Guest</option>
          <option value="groom">Groom (Toby)</option>
        </select>
      </label>
    </div>
  );
}

function Centre({ children }: { children: ReactNode }) {
  return <main className="centre">{children}</main>;
}

function SignIn() {
  const { signIn, error } = useStore();
  const [code, setCode] = useState('');
  return (
    <Centre>
      <h1>This site is private</h1>
      <p className="muted" style={{ margin: '16px 0 24px' }}>Open the link Jack sent you, or enter your passcode.</p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (code.trim()) signIn(code); }}>
        <label className="field">
          <span>Passcode</span>
          <input type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div><button className="btn" type="submit">Continue</button></div>
      </form>
    </Centre>
  );
}
