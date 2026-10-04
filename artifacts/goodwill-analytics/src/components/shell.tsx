import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, LogOut } from 'lucide-react';
import { exportGoodwillSupersetSnapshot, useGetGoodwillCatalog } from '@workspace/api-client-react';
import { SOURCE_LABEL } from '@/lib/format';
import { useScope } from '@/lib/scope';

const NAV: [string, string, string][] = [['/', 'Overview', 'Nightly and monthly'], ['/scorecard', 'COO scorecard', '15 KPIs, 2027'], ['/metrics', 'Framework', 'Definitions, readiness']];
const inp = 'rounded-sm border border-input bg-card px-2 py-1.5 text-sm';

export function Shell({ children, onSignOut, fetching }: { children: ReactNode; onSignOut: () => void; fetching: boolean }) {
  const [loc] = useLocation(); const { state, set } = useScope(); const qc = useQueryClient();
  const cat = useGetGoodwillCatalog({ query: { queryKey: ['goodwill-catalog'], staleTime: 10 * 60_000, retry: false } });
  const [spin, setSpin] = useState(false); const [exporting, setExporting] = useState(false); const [snapshotMessage, setSnapshotMessage] = useState('');
  const refresh = async () => { setSpin(true); await qc.invalidateQueries({ queryKey: ['goodwill-analytics'] }); setSpin(false); };
  const exportSnapshot = async () => {
    setExporting(true); setSnapshotMessage('');
    try {
      const snapshot = await exportGoodwillSupersetSnapshot({
        sourceId: state.sourceId, period: { startDate: state.startDate, endDate: state.endDate },
        ...(state.storeId ? { storeId: state.storeId } : {}),
      });
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `goodwill-superset-${snapshot.sourceId}-${snapshot.period.startDate}-${snapshot.period.endDate}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSnapshotMessage(`Downloaded ${snapshot.metrics.length} aggregate metrics from publication ${snapshot.publicationId.slice(0, 8)}.`);
    } catch (error) {
      setSnapshotMessage(error instanceof Error ? `Snapshot was not downloaded: ${error.message}` : 'Snapshot was not downloaded.');
    } finally { setExporting(false); }
  };
  return <div className="min-h-[100dvh] md:grid md:grid-cols-[230px_minmax(0,1fr)]">
    <aside className="flex flex-col gap-4 bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-[100dvh] md:p-6">
      <div><p className="eyebrow text-sidebar-primary">Goodwill Michiana</p><p className="font-serif text-2xl leading-none mt-1">Analytics</p></div>
      <nav aria-label="Primary" className="flex gap-2 md:flex-col md:gap-1">
        {NAV.map(([h, l, s]) => { const on = loc === h; return <Link key={h} href={h} data-testid={`nav-${l}`} aria-current={on ? 'page' : undefined}
          className={`rounded-sm border-l-2 px-3 py-2 text-sm transition-colors ${on ? 'border-sidebar-primary bg-sidebar-accent' : 'border-transparent hover:bg-sidebar-accent/60'}`}>
          <span className="block font-medium">{l}</span><span className="hidden text-xs opacity-60 md:block">{s}</span></Link>; })}
      </nav>
      <button data-testid="button-sign-out" onClick={onSignOut} className="ml-auto flex items-center gap-2 text-xs opacity-70 hover:opacity-100 md:ml-0 md:mt-auto"><LogOut size={14} />Sign out</button>
    </aside>
    <div className="min-w-0">
      <div className="sticky top-0 z-20 flex flex-wrap items-end gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-8" role="group" aria-label="Scope: applies to every figure">
        <label className="text-xs">Source<select data-testid="select-source" className={`${inp} mt-0.5 block`} value={state.sourceId} onChange={e => set({ sourceId: e.target.value as typeof state.sourceId })}>
          {Object.entries(SOURCE_LABEL).map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label>
        <label className="text-xs">Store<select data-testid="select-store" className={`${inp} mt-0.5 block`} value={state.storeId} onChange={e => set({ storeId: e.target.value })}>
          <option value="">All stores</option><option value="__unknown__">Unresolved attribution</option>{cat.data?.stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-xs">From<input data-testid="input-start" type="date" className={`${inp} mt-0.5 block`} value={state.startDate} max={state.endDate} onChange={e => e.target.value && set({ startDate: e.target.value })} /></label>
        <label className="text-xs">To<input data-testid="input-end" type="date" className={`${inp} mt-0.5 block`} value={state.endDate} min={state.startDate} onChange={e => e.target.value && set({ endDate: e.target.value })} /></label>
        <label className="flex items-center gap-2 pb-2 text-xs"><input data-testid="check-snapshot" type="checkbox" checked={state.snapshot} onChange={e => set({ snapshot: e.target.checked })} />Inventory snapshot, Aug 31 2026</label>
        <button data-testid="button-reset" onClick={() => set({ startDate: '2026-08-01', endDate: '2026-08-31', storeId: '', snapshot: false })} className="pb-2 text-xs underline">Full August 2026</button>
        <button data-testid="button-download-superset-snapshot" disabled={exporting || fetching || state.snapshot} onClick={exportSnapshot}
          className="flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          title={state.snapshot ? 'Turn off the inventory snapshot filter; this export is for source/date/store aggregates.' : undefined}>
          {exporting ? 'Preparing snapshot…' : 'Download Superset snapshot'}
        </button>
        <button data-testid="button-refresh" onClick={refresh} className="ml-auto flex items-center gap-2 rounded-sm border border-primary px-3 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground"><RefreshCw size={14} className={spin || fetching ? 'spin-once' : ''} />Refresh</button>
      </div>
      {snapshotMessage && <p className="border-b px-4 py-2 text-xs text-muted-foreground md:px-8" role="status">{snapshotMessage}</p>}
      <main className="px-4 py-6 md:px-8">{children}</main>
    </div></div>;
}
