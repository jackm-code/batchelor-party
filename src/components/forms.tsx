import { useState } from 'react';
import { useStore } from '../data/store';
import type { Guest } from '../lib/types';

const FRIENDLY: [RegExp, string][] = [
  [/answered_needs_decision/, 'Choose the decision that answers this question.'],
  [/violates check constraint/, 'One of those values is not allowed. Check the form and try again.'],
  [/violates not-null constraint/, 'Fill in the required fields.'],
  [/violates foreign key constraint/, 'That is still in use elsewhere, so it cannot be removed.'],
];

export function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return FRIENDLY.find(([re]) => re.test(msg))?.[1] ?? msg;
}

/** Runs a save, tracking "busy" and a plain-English error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try { await fn(); return true; } catch (e) { setError(friendly(e)); return false; } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}

export const toCents = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Math.round(Number(s) * 100));
export const fromCents = (c: number | null | undefined): string => (c === null || c === undefined ? '' : String(c / 100));
export const today = () => new Date().toISOString().slice(0, 10);

/** Who is voting or commenting. The organiser defaults to their own name. */
export function useMe(): { me: Guest | null; choices: Guest[] } {
  const { bundle, me, role } = useStore();
  const choices = (bundle?.guests ?? []).filter((g) => g.role !== 'groom' && (role === 'organiser' || g.role !== 'organiser'));
  const picked = choices.find((g) => g.id === me) ?? (role === 'organiser' ? choices.find((g) => g.role === 'organiser') ?? null : null);
  return { me: picked, choices };
}

export function WhoAmI() {
  const { setMe, role } = useStore();
  const { me, choices } = useMe();
  if (role === 'groom') return null;
  if (choices.length === 0) {
    return <p className="notice">To vote or comment, ask Jack to add your name to the guest list.</p>;
  }
  return (
    <label className="field">
      <span>Your name, for votes and comments</span>
      <select value={me?.id ?? ''} onChange={(e) => setMe(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Choose your name</option>
        {choices.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    </label>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? <p className="error" role="alert">{error}</p> : null;
}
