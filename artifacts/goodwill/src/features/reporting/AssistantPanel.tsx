import { useEffect, useRef, useState } from 'react';
import { askGoodwillAssistant, type GoodwillAssistantResponse, type MetricQuery, type MetricResult } from '@workspace/api-client-react';
import { EvidenceRows } from './EvidenceView';
import { errorMessage, formatValue } from './model';
import { Notice, Panel, StatusTag } from './ui';

const STARTERS = ['Explain this metric for this source and period', 'Which rows support this figure?', 'Show selected source coverage and definition', 'Why is margin unavailable?', 'What is the total revenue across all sources?'];

/** Read-only tool routing bound to the current dashboard scope. */
export function AssistantPanel({ context, onEvidence, onBatch }: {
  context: MetricQuery; onEvidence: (r: MetricResult) => void; onBatch: (id: string) => void;
}) {
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<'deterministic_tools' | 'synthetic_openai'>('deterministic_tools');
  const contextKey = JSON.stringify(context);
  const key = JSON.stringify({ context, mode });
  // Each answer is bound to the immutable context key and request id it was asked under.
  const [state, setState] = useState<{ key: string; id: number; pending: boolean; data?: GoodwillAssistantResponse; error?: unknown } | null>(null);
  const requestId = useRef(0);
  const live = useRef({ key, mounted: true });
  live.current.key = key;
  useEffect(() => { live.current.mounted = true; return () => { live.current.mounted = false; requestId.current += 1; }; }, []);
  useEffect(() => { requestId.current += 1; setState(null); }, [key]);
  const submit = (q: string) => {
    const text = q.trim(); if (!text) return;
    setQuestion(text);
    const id = ++requestId.current; const asked = key; const ctx: MetricQuery = JSON.parse(contextKey);
    setState({ key: asked, id, pending: true });
    const accept = () => live.current.mounted && requestId.current === id && live.current.key === asked;
    askGoodwillAssistant({ question: text, context: ctx, mode })
      .then(data => { if (accept()) setState({ key: asked, id, pending: false, data }); })
      .catch(error => { if (accept()) setState({ key: asked, id, pending: false, error }); });
  };
  const current = state && state.key === key && state.id === requestId.current ? state : null;
  const pending = Boolean(current?.pending);
  const r = current?.data;
  const ask = { isPending: pending, isError: Boolean(current?.error), error: current?.error };
  return <Panel title="Query assistant" description="Read-only reporting. Financial arithmetic, filters and pinned evidence are always backend-owned. Model-free mode is the default.">
    <label className="gw-field">Routing mode
      <select data-testid="select-assistant-mode" value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
        <option value="deterministic_tools">Model-free · no provider calls</option>
        <option value="synthetic_openai">OpenAI gpt-5-mini · synthetic prompts only</option>
      </select>
    </label>
    <p className="gw-meta" data-testid="text-assistant-policy">{mode === 'synthetic_openai'
      ? 'Opt-in synthetic routing requires connected managed access. Only the four approved test questions may be sent; free text, filters, figures, rows and identifiers never leave the backend. The $5 grant allows at most five attempts, reserving $1 each even on failure. Reservations are not billed cost. No automatic retries or model-free fallback.'
      : 'No language model is called. Read-only tools cannot change financial data or expose credentials.'}</p>
    <p className="gw-meta" data-testid="text-assistant-context">Context: {context.sourceId} · {context.metricId} · {context.period.startDate} – {context.period.endDate} · {context.storeId ?? 'all stores'} · by {context.groupBy}</p>
    <form className="gw-actions" onSubmit={e => { e.preventDefault(); submit(question); }}>
      <label className="gw-field gw-grow">Question<input data-testid="input-assistant-question" value={question} maxLength={500} onChange={e => setQuestion(e.target.value)} placeholder={mode === 'synthetic_openai' ? 'Choose a displayed synthetic test question' : 'Ask about the selected source, metric, dates and store'} /></label>
      <button className="gw-button" type="submit" data-testid="button-assistant-ask" disabled={ask.isPending || !question.trim()}>{ask.isPending ? 'Running tools…' : 'Ask'}</button>
    </form>
    <div className="gw-actions">{STARTERS.map(s => <button key={s} type="button" className="gw-chip" disabled={ask.isPending} onClick={() => submit(s)}>{s}</button>)}</div>
    {ask.isPending && <div className="gw-skeleton" aria-hidden="true"><span /><span /></div>}
    {ask.isError && <Notice kind="error" onRetry={() => submit(question)}>{errorMessage(ask.error)}</Notice>}
    {r && <div className="gw-answer" data-testid="status-assistant" aria-live="polite">
      <div className="gw-source-top"><StatusTag value={r.status} /><span className="gw-meta">mode: {r.mode}</span></div>
      {r.providerUsage && <p className="gw-meta" data-testid="text-assistant-usage">
        {r.providerUsage.model} · attempt {r.providerUsage.attemptedCalls}/5 · ${(r.providerUsage.reservedCents / 100).toFixed(2)} reserved of ${(r.providerUsage.limitCents / 100).toFixed(2)} limit · input/output tokens: {r.providerUsage.inputTokens ?? 'unknown'}/{r.providerUsage.outputTokens ?? 'unknown'}. Reserved amount is a conservative cap, not actual billing.
      </p>}
      <p data-testid="text-assistant-answer">{r.answer}</p>
      {r.result && <div className="gw-answer-result">
        <p><strong>{r.result.definition.label}</strong>: {r.result.value === null ? 'No single aggregate' : formatValue(r.result.value, r.result.definition.unit)}</p>
        <p className="gw-meta">{r.result.definition.formula}</p>
        <p className="gw-meta">Publication {r.result.publicationId ?? 'none'}{r.result.publishedAt ? ` · ${r.result.publishedAt}` : ''}</p>
        <div className="gw-actions">
          {r.result.publicationId && <button type="button" className="gw-button gw-button-secondary" data-testid="button-assistant-evidence" onClick={() => onEvidence(r.result!)}>Open pinned evidence</button>}
          {r.result.batchIds.map(b => <button key={b} type="button" className="gw-chip" data-testid={`button-assistant-batch-${b}`} onClick={() => onBatch(b)}>Batch {b}</button>)}
        </div>
      </div>}
      {r.evidence && r.evidence.items.length > 0 && <EvidenceRows page={r.evidence} />}
      <ul className="gw-tools" aria-label="Tools executed">{r.tools.map((t, i) => <li key={i}><code>{t.name}</code> <StatusTag value={t.status} /></li>)}</ul>
      {r.suggestions.length > 0 && <div className="gw-actions">{r.suggestions.map(s => <button key={s} type="button" className="gw-chip" onClick={() => submit(s)}>{s}</button>)}</div>}
    </div>}
  </Panel>;
}
