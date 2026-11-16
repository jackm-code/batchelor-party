import { useState } from 'react';
import { useStore } from '../data/store';
import { Badge, Field } from '../components/ui';
import { ErrorNote, today, useAction } from '../components/forms';
import { ukDate } from '../lib/format';
import type { AuditRow, Bundle, Decision, OpenQuestion } from '../lib/types';

export function Decisions() {
  const { bundle, role } = useStore();
  const b = bundle!;
  const organiser = role === 'organiser';
  const open = b.open_questions.filter((q) => q.status === 'open');
  const answered = b.open_questions.filter((q) => q.status === 'answered');

  return (
    <>
      <div className="page-head">
        <h1>Decisions</h1>
        <p>What has been settled and why, and what is still open. Decisions are never deleted, only replaced by a newer one.</p>
      </div>

      <section style={{ marginTop: 0 }}>
        <h2>Decision log</h2>
        {organiser && (
          <details className="card flat" style={{ marginBottom: 16 }}>
            <summary>Add a decision</summary>
            <DecisionForm b={b} />
          </details>
        )}
        <div className="stack">
          {b.decisions.map((d) => <DecisionCard key={d.id} d={d} b={b} organiser={organiser} />)}
        </div>
      </section>

      <section>
        <h2>Open questions</h2>
        {organiser && (
          <details className="card flat" style={{ marginBottom: 16 }}>
            <summary>Add a question</summary>
            <QuestionForm />
          </details>
        )}
        <div className="stack">
          {open.map((q) => <QuestionCard key={q.id} q={q} b={b} organiser={organiser} />)}
          {open.length === 0 && <p className="muted">Nothing is open.</p>}
        </div>
      </section>

      {answered.length > 0 && (
        <section>
          <h2>Answered</h2>
          <div className="stack">{answered.map((q) => <QuestionCard key={q.id} q={q} b={b} organiser={false} />)}</div>
        </section>
      )}
    </>
  );
}

function DecisionCard({ d, b, organiser }: { d: Decision; b: Bundle; organiser: boolean }) {
  const linked = d.linked_option_ids.map((id) => b.options.find((o) => o.id === id)?.name).filter(Boolean);
  const replacement = d.superseded_by ? b.decisions.find((x) => x.id === d.superseded_by) : null;
  const replaces = b.decisions.filter((x) => x.superseded_by === d.id);
  const history = b.decision_history.filter((h) => h.row_id === String(d.id));
  return (
    <article className="card stack-sm" id={`decision-${d.id}`} aria-label={d.title}>
      <p className="caption">{ukDate(d.date)} · decided by {d.decided_by}</p>
      <h3>{d.title} {replacement && <Badge kind="plain">Superseded</Badge>}</h3>
      <p style={replacement ? { textDecoration: 'line-through' } : undefined}>{d.decision}</p>
      {d.reason && <p className="muted">{d.reason}</p>}
      {replacement && <p className="caption">Replaced by <a href={`#decision-${replacement.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`decision-${replacement.id}`)?.scrollIntoView(); }}>{replacement.title}</a> on {ukDate(replacement.date)}.</p>}
      {replaces.map((x) => <p className="caption" key={x.id}>Replaces “{x.title}”.</p>)}
      {linked.length > 0 && <p className="caption">Options: {linked.join(', ')}</p>}
      <details>
        <summary>History ({history.length})</summary>
        <ul className="bullets caption">{history.map((h) => <li key={h.id}>{describe(h)}</li>)}</ul>
      </details>
      {organiser && !replacement && (
        <>
          <details><summary>Edit</summary><DecisionForm b={b} d={d} /></details>
          <details><summary>Replace with a new decision</summary><DecisionForm b={b} supersedes={d} /></details>
        </>
      )}
    </article>
  );
}

const FIELD_NAMES: Record<string, string> = {
  title: 'title', decision: 'decision', reason: 'reason', decided_by: 'decided by', date: 'date',
  linked_option_ids: 'linked options', superseded_by: 'superseded by',
};

function describe(h: AuditRow): string {
  const who = h.actor === 'seed' ? 'Loaded from the project notes' : h.actor;
  const when = new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (h.action === 'insert') return h.actor === 'seed' ? `${who}, ${when}.` : `${who} added this, ${when}.`;
  const changed = Object.keys(FIELD_NAMES).filter((k) => JSON.stringify(h.old_row?.[k]) !== JSON.stringify(h.new_row?.[k]));
  const detail = changed.map((k) => {
    if (k === 'superseded_by') return 'marked as superseded';
    if (k === 'linked_option_ids') return 'changed the linked options';
    return `changed the ${FIELD_NAMES[k]} (was “${String(h.old_row?.[k] ?? '')}”)`;
  });
  return `${who} ${detail.join('; ') || 'saved it'}, ${when}.`;
}

function DecisionForm({ b, d, supersedes }: { b: Bundle; d?: Decision; supersedes?: Decision }) {
  const { call } = useStore();
  const act = useAction();
  const organiserName = b.guests.find((g) => g.role === 'organiser')?.name ?? '';
  const start = {
    date: d?.date ?? today(), title: d?.title ?? '', decision: d?.decision ?? '', reason: d?.reason ?? '',
    decided_by: d?.decided_by ?? organiserName, linked: (d ?? supersedes)?.linked_option_ids ?? [],
  };
  const [f, setF] = useState(start);
  const [saved, setSaved] = useState(false);
  const set = (k: 'date' | 'title' | 'decision' | 'reason' | 'decided_by') => (e: { target: { value: string } }) => { setSaved(false); setF({ ...f, [k]: e.target.value }); };

  const save = () => act.run(async () => {
    const row = {
      date: f.date, title: f.title.trim(), decision: f.decision.trim(), reason: f.reason.trim() || null,
      decided_by: f.decided_by.trim(), linked_option_ids: f.linked,
    };
    if (!row.title || !row.decision || !row.decided_by) throw new Error('A decision needs a title, the decision itself, and who decided.');
    if (supersedes) await call('api_supersede_decision', { p_old_id: supersedes.id, p_row: row });
    else await call('api_upsert', { p_table: 'decisions', p_row: d ? { id: d.id, ...row } : row });
    setSaved(true);
    if (!d) setF({ ...start, title: '', decision: '', reason: '' });
  });

  return (
    <form className="form two" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {supersedes && <p className="caption full">The old decision stays in the log, marked as superseded.</p>}
      <Field label="Date"><input type="date" value={f.date} onChange={set('date')} required /></Field>
      <Field label="Decided by"><input type="text" value={f.decided_by} onChange={set('decided_by')} required /></Field>
      <Field label="Title" full><input type="text" value={f.title} onChange={set('title')} required /></Field>
      <Field label="Decision" full><textarea value={f.decision} onChange={set('decision')} required /></Field>
      <Field label="Reason" full><textarea value={f.reason} onChange={set('reason')} /></Field>
      <Field label="Linked options (hold Ctrl or Cmd to pick several)" full>
        <select multiple size={5} value={f.linked.map(String)} style={{ minHeight: 132 }}
          onChange={(e) => { setSaved(false); setF({ ...f, linked: [...e.target.selectedOptions].map((o) => Number(o.value)) }); }}>
          {b.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Field>
      <div className="full row">
        <button className="btn" disabled={act.busy}>{supersedes ? 'Replace decision' : d ? 'Save changes' : 'Add decision'}</button>
        {saved && <span role="status"><Badge kind="ok">Saved</Badge></span>}
      </div>
      <div className="full"><ErrorNote error={act.error} /></div>
    </form>
  );
}

function QuestionCard({ q, b, organiser }: { q: OpenQuestion; b: Bundle; organiser: boolean }) {
  const { call } = useStore();
  const act = useAction();
  const [answer, setAnswer] = useState('');
  const [decisionId, setDecisionId] = useState('');
  const decision = q.closed_by_decision_id ? b.decisions.find((d) => d.id === q.closed_by_decision_id) : null;

  return (
    <article className="card stack-sm">
      <p className="caption">Owner: {q.owner} · {q.status === 'open' ? <Badge kind="warn">Open</Badge> : <Badge kind="ok">Answered</Badge>}</p>
      <h3>{q.question}</h3>
      {q.answer && <p>{q.answer}</p>}
      {decision && (
        <p className="caption">
          Closed by the decision <a href={`#decision-${decision.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`decision-${decision.id}`)?.scrollIntoView(); }}>{decision.title}</a>, {ukDate(decision.date)}.
        </p>
      )}
      {organiser && q.status === 'open' && (
        <details>
          <summary>Close this question</summary>
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            void act.run(async () => {
              if (!decisionId) throw new Error('Choose the decision that answers this question. Add the decision first if it is not in the log.');
              await call('api_upsert', {
                p_table: 'open_questions',
                p_row: { id: q.id, status: 'answered', answer: answer.trim() || null, closed_by_decision_id: Number(decisionId) },
              });
            });
          }}>
            <Field label="Answer"><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} /></Field>
            <Field label="Decision that answers it (required)">
              <select value={decisionId} onChange={(e) => setDecisionId(e.target.value)}>
                <option value="">Choose a decision</option>
                {b.decisions.map((d) => <option key={d.id} value={d.id}>{ukDate(d.date)}: {d.title}</option>)}
              </select>
            </Field>
            <div><button className="btn small" disabled={act.busy}>Close question</button></div>
            <ErrorNote error={act.error} />
          </form>
        </details>
      )}
    </article>
  );
}

function QuestionForm() {
  const { call, bundle } = useStore();
  const act = useAction();
  const [question, setQuestion] = useState('');
  const [owner, setOwner] = useState(bundle!.guests.find((g) => g.role === 'organiser')?.name ?? '');
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      if (await act.run(() => call('api_upsert', { p_table: 'open_questions', p_row: { question: question.trim(), owner: owner.trim() } }))) setQuestion('');
    }}>
      <Field label="Question"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} required /></Field>
      <Field label="Owner"><input type="text" value={owner} onChange={(e) => setOwner(e.target.value)} required /></Field>
      <div><button className="btn small" disabled={act.busy}>Add question</button></div>
      <ErrorNote error={act.error} />
    </form>
  );
}
