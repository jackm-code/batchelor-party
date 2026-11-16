import { useStore } from '../data/store';
import { decisionsCsv, exportMarkdown, optionsCsv, questionsCsv } from '../lib/export';
import { today } from './forms';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPanel() {
  const b = useStore().bundle!;
  const d = today();
  return (
    <section>
      <h2>Export</h2>
      <p>Take the data with you at any time. The Markdown file can replace the Claude Project knowledge file.</p>
      <div className="card stack">
        <div className="row">
          <button className="btn small secondary" onClick={() => download(`options-${d}.csv`, optionsCsv(b), 'text/csv')}>Options (CSV)</button>
          <button className="btn small secondary" onClick={() => download(`decisions-${d}.csv`, decisionsCsv(b), 'text/csv')}>Decisions (CSV)</button>
          <button className="btn small secondary" onClick={() => download(`open-questions-${d}.csv`, questionsCsv(b), 'text/csv')}>Open questions (CSV)</button>
        </div>
        <div>
          <button className="btn small" onClick={() => download(`bachelor-party-${d}.md`, exportMarkdown(b, d), 'text/markdown')}>Everything (Markdown)</button>
        </div>
        <p className="caption">
          {b.options.length} options, {b.decisions.length} decisions, {b.open_questions.length} questions.
          Each figure is marked Verified or Unverified, with its source.
        </p>
      </div>
    </section>
  );
}
