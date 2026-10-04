/** TEST ONLY isolated frontend: never mounted by the managed app or its auth. */
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportingApp } from '../reporting/ReportingApp';

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <aside style={{ padding: 12, background: '#fff0bf', color: '#222' }}>
      TEST ONLY · synthetic fixtures · in-memory repository/archive and SQL count adapter doubles ·
      real reporting/assistant/overview services · not live PostgreSQL, managed authorization or Jev evidence
    </aside>
    <ReportingApp />
  </QueryClientProvider>,
);