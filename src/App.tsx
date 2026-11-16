import { useState, type ReactNode } from 'react';
import { useStore } from './data/store';
import { useRoute } from './lib/route';
import type { Role } from './lib/types';
import { Costs } from './pages/Costs';

interface Page { path: string; label: string; roles: Role[]; wide?: boolean; render: () => ReactNode }

const PAGES: Page[] = [
  { path: 'costs', label: 'Costs', roles: ['organiser', 'group'], wide: true, render: () => <Costs /> },
];

export function App() {
  const { status, error, bundle, role, demo } = useStore();
  const route = useRoute();

  if (status === 'loading') return <Centre><p className="muted" role="status">Loading…</p></Centre>;
  if (status === 'need-code') return <SignIn />;
  if (status === 'error' || !bundle || !role) {
    return <Centre><h1>Something went wrong</h1><p className="muted" style={{ marginTop: 16 }}>{error ?? 'Try again in a moment.'}</p></Centre>;
  }

  const pages = PAGES.filter((p) => p.roles.includes(role));
  const page = pages.find((p) => p.path === route.path) ?? pages[0];

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-row">
            <span className="brand">Boston or NYC</span>
            {demo && <span className="caption">Demo data. Changes are not saved.</span>}
          </div>
          <nav className="nav" aria-label="Pages">
            {pages.map((p) => (
              <a key={p.path} href={`#/${p.path}`} aria-current={p === page ? 'page' : undefined}>{p.label}</a>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className={page.wide ? 'wide' : ''} key={page.path}>
        {page.render()}
      </main>
    </>
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
