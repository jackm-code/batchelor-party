import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEMO, DEMO_CODES, getRpc } from './api';
import { normaliseBundle, type Bundle, type CityId, type Role, type Tier } from '../lib/types';
import type { Overrides } from '../lib/model';
import type { Scenario } from '../lib/cost';

export interface Calc extends Scenario { tier: Tier; city: CityId | 'both' }

export const DEFAULT_CALC: Calc = { city: 'both', tier: 'budget', nights: 2, groupSize: 12, localGuests: 4, groomCovered: true };

type Status = 'loading' | 'need-code' | 'ready' | 'error';

interface Store {
  status: Status;
  error: string | null;
  bundle: Bundle | null;
  role: Role | null;
  demo: boolean;
  calc: Calc;
  setCalc: (patch: Partial<Calc>) => void;
  overrides: Overrides;
  setOverride: (key: string, value: number | null) => void;
  resetOverrides: () => void;
  /** Call a database function with the passcode added, then reload. */
  call: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;
  reload: () => Promise<void>;
  signIn: (code: string) => void;
  signOut: () => void;
  me: number | null;
  setMe: (guestId: number | null) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

const KEY = 'bp.code';
const ME = 'bp.me';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private window */ } };

/** Take a passcode from the link (?k=...), remember it, and remove it from the address bar. */
function codeFromLink(): string | null {
  const search = new URLSearchParams(location.search);
  const hash = location.hash.includes('?') ? new URLSearchParams(location.hash.slice(location.hash.indexOf('?') + 1)) : null;
  const k = search.get('k') ?? hash?.get('k') ?? null;
  if (!k) return null;
  search.delete('k');
  hash?.delete('k');
  const base = location.hash.split('?')[0];
  const rest = hash && [...hash.keys()].length ? `?${hash}` : '';
  const q = [...search.keys()].length ? `?${search}` : '';
  history.replaceState(null, '', `${location.pathname}${q}${base}${rest}`);
  return k;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(() => {
    const linked = codeFromLink();
    if (linked) write(KEY, linked);
    return linked ?? read(KEY) ?? (DEMO ? DEMO_CODES.organiser : null);
  });
  const [status, setStatus] = useState<Status>(code ? 'loading' : 'need-code');
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [calc, setCalcState] = useState<Calc>(DEFAULT_CALC);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [me, setMeState] = useState<number | null>(() => Number(read(ME)) || null);

  const load = useCallback(async (c: string | null) => {
    if (!c) { setBundle(null); setStatus('need-code'); return; }
    try {
      const rpc = await getRpc();
      setBundle(normaliseBundle(await rpc<any>('api_bundle', { p_code: c })));
      setError(null);
      setStatus('ready');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      setBundle(null);
      if (/passcode/i.test(msg)) { write(KEY, null); setError(msg); setStatus('need-code'); }
      else { setError(msg); setStatus('error'); }
    }
  }, []);

  useEffect(() => { void load(code); }, [code, load]);

  const store = useMemo<Store>(() => ({
    status, error, bundle, role: bundle?.role ?? null, demo: DEMO, calc, overrides, me,
    setCalc: (patch) => setCalcState((c) => {
      const next = { ...c, ...patch };
      next.groupSize = Math.min(30, Math.max(2, next.groupSize));
      next.localGuests = Math.min(next.groupSize - 1, Math.max(0, next.localGuests));
      return next;
    }),
    setOverride: (k, v) => setOverrides((o) => {
      const next = { ...o };
      if (v === null || Number.isNaN(v)) delete next[k]; else next[k] = v;
      return next;
    }),
    resetOverrides: () => setOverrides({}),
    call: async (fn, args = {}) => {
      const rpc = await getRpc();
      const out = await rpc<any>(fn, { p_code: code, ...args });
      await load(code);
      return out;
    },
    reload: () => load(code),
    signIn: (c) => { const t = c.trim(); if (!DEMO) write(KEY, t); setStatus('loading'); setCode(t); },
    signOut: () => { write(KEY, null); setCode(null); },
    setMe: (id) => { write(ME, id === null ? null : String(id)); setMeState(id); },
  }), [status, error, bundle, calc, overrides, me, code, load]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
