import { useId, type ReactNode } from 'react';
import './reporting.css';

export function Panel({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  const id = useId();
  return (
    <section className="gw-panel" aria-labelledby={id}>
      <div className="gw-panel-head">
        <div>
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="gw-actions">{actions}</div> : null}
      </div>
      <div className="gw-stack">{children}</div>
    </section>
  );
}

export function Notice({ kind, children, onRetry }: { kind: 'info' | 'error' | 'warning' | 'success'; children: ReactNode; onRetry?: () => void }) {
  return (
    <div className={`gw-notice gw-notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onRetry ? (
        <button type="button" className="gw-button gw-button-secondary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

const GOOD = ['published', 'complete', 'verified', 'matched', 'accepted', 'reconciled', 'success'];
const BAD = ['failed', 'mismatch', 'rejected', 'quarantined', 'unsupported', 'cancelled', 'error'];
const WARN = ['partial', 'stale', 'duplicate', 'superseded', 'missing', 'unavailable', 'running', 'queued', 'received', 'validated', 'downloaded'];

export function StatusTag({ value }: { value: string }) {
  const k = value.toLowerCase().replace(/[\s-]+/g, '_');
  const tone = GOOD.includes(k) ? 'good' : BAD.includes(k) ? 'bad' : WARN.includes(k) ? 'warn' : 'neutral';
  return <span className={`gw-tag gw-tag-${tone}`}>{value.replace(/_/g, ' ')}</span>;
}

export function DataTable({ headers, caption, children }: { headers: string[]; caption: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="gw-table-scroll" tabIndex={0} role="region" aria-labelledby={id}>
      <table>
        <caption id={id}>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
