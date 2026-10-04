import { useState, type ReactNode } from 'react';
import type { AnalyticsDashboard, AnalyticsKpi } from '@workspace/api-client-react';
import { OperatorGate } from '@/auth/OperatorGate';
import { Shell } from '@/components/shell';
import { Panel } from '@/components/kpi';
import { KpiDetail } from '@/components/kpi-detail';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/use-analytics';
import { useScope } from '@/lib/scope';

export function Protected({ children }: { children: (d: AnalyticsDashboard, open: (k: AnalyticsKpi) => void) => ReactNode }) {
  return <OperatorGate>{out => <Inner onSignOut={out}>{children}</Inner>}</OperatorGate>;
}
function Inner({ children, onSignOut }: { children: (d: AnalyticsDashboard, open: (k: AnalyticsKpi) => void) => ReactNode; onSignOut: () => void }) {
  const { scope } = useScope(); const q = useAnalytics(scope); const [sel, setSel] = useState<string | null>(null);
  const d = q.data; const kpi = d?.kpis.find(k => k.id === sel) ?? null;
  return <Shell onSignOut={onSignOut} fetching={q.isFetching}>
    {q.isPending ? <div role="status" aria-label="Loading analytics" className="space-y-4"><Skeleton className="h-24 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div></div>
    : q.isError || !d ? <Panel title="Analytics could not be loaded" body={q.error instanceof Error ? q.error.message : 'The request failed. Nothing is shown rather than stale or guessed figures.'} action={{ label: 'Retry', run: () => q.refetch() }} />
    : <>
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-b pb-3 text-xs text-muted-foreground" data-testid="status-publication">
        <span className="eyebrow rounded-sm bg-accent px-1.5 py-0.5 text-accent-foreground">Synthetic</span>
        <span>{d.publicationId ? <>Publication <span className="num">{d.publicationId.slice(0, 8)}</span></> : 'No publication for this scope'}</span>
        {d.publishedAt && <span>Published {new Date(d.publishedAt).toLocaleString('en-US', { timeZone: d.timezone })}</span>}
        <span>{d.timezone}</span><span>{d.batchIds.length} batches</span></div>
      {d.warnings.length > 0 && <ul className="mb-6 space-y-1 border-l-2 border-[hsl(var(--warn))] bg-accent/40 px-3 py-2 text-sm" aria-label="Warnings">{d.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      {d.kpis.length === 0 ? <Panel tone="warn" title="Nothing published for this scope" body="No measures were returned for this source, store and period. Widen the dates or choose another source." /> : children(d, k => setSel(k.id))}
      <KpiDetail k={kpi} data={d} onClose={() => setSel(null)} /></>}
  </Shell>;
}
