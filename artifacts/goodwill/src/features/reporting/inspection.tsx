// Development inspection only. Lead integrates ReportingApp in the shared shell.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { ErrorBoundary } from '../../components/error-boundary';
import '../../index.css';
import { ReportingApp } from './ReportingApp';

setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, '') || null);
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ReportingApp />
    </QueryClientProvider>
  </ErrorBoundary>,
);