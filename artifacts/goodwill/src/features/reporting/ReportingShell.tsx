import type { ReactNode } from 'react';
import './reporting.css';

export type Page = 'operations' | 'reporting' | 'listings' | 'backlog' | 'evidence' | 'definitions';

const PAGES: { id: Page; label: string }[] = [
  { id: 'operations', label: 'Operations' },
  { id: 'reporting', label: 'Reporting' },
  { id: 'listings', label: 'Listings' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'definitions', label: 'Definitions' },
];

export function ReportingShell({ page, onPageChange, children, legacyHref }: { page: Page; onPageChange: (p: Page) => void; children: ReactNode; legacyHref: string }) {
  return (
    <div className="gw-reporting">
      <header className="gw-head">
        <div className="gw-wrap">
          <p className="gw-eyebrow">Michiana operations, leadership and finance evidence</p>
          <h1>Goodwill Reporting</h1>
          <ul className="gw-labels" aria-label="Data status">
            <li>Synthetic data</li>
            <li>Simulated sources</li>
            <li>Non-production</li>
          </ul>
          <p className="gw-caveat">
            Personas are informational only and do not grant or restrict access. Figures are scoped to a single source and are not company-wide.{' '}
            <a href={legacyHref}>Open the retained foundation</a>
          </p>
        </div>
      </header>
      <nav className="gw-nav" aria-label="Reporting sections">
        <ul>
          {PAGES.map((p) => (
            <li key={p.id}>
              <button type="button" aria-current={page === p.id ? 'page' : undefined} onClick={() => onPageChange(p.id)}>
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main id="gw-main" tabIndex={-1}>{children}</main>
      <footer className="gw-foot">Synthetic, simulated and non-production. No live source compatibility is implied.</footer>
    </div>
  );
}
