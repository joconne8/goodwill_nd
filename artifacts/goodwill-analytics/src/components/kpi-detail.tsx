import { useState } from 'react';
import { exportGoodwillReport, type AnalyticsDashboard, type AnalyticsKpi } from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SeriesChart } from '@/components/charts';
import { StatusPill, Tags } from '@/components/kpi';
import { useEvidence } from '@/hooks/use-analytics';
import { download, fmtValue, pointCount } from '@/lib/format';

const LIMIT = 25;
function Evidence({ k, pub }: { k: AnalyticsKpi; pub: string }) {
  const [open, setOpen] = useState(false); const [offset, setOffset] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const ev = useEvidence(open && k.evidenceQuery ? { query: k.evidenceQuery, publicationId: pub, offset, limit: LIMIT } : null);
  async function csv() {
    setBusy(true); setErr(null);
    try { const r = await exportGoodwillReport({ kind: 'evidence', query: k.evidenceQuery, publicationId: pub }); download(r.filename, r.csv); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Export failed'); } finally { setBusy(false); }
  }
  const items = ev.data?.items ?? [];
  const cols = Array.from(new Set(items.flatMap(i => Object.keys(i.values)))).slice(0, 4);
  return <section className="mt-6 border-t pt-4"><h3 className="eyebrow">Evidence, publication {pub.slice(0, 8)}</h3>
    <div className="mt-3 flex flex-wrap gap-2">
      <button data-testid="button-load-evidence" onClick={() => setOpen(o => !o)} className="rounded-sm border border-primary px-3 py-1.5 text-sm">{open ? 'Hide records' : 'Load records'}</button>
      <button data-testid="button-export-evidence" disabled={busy} onClick={csv} className="rounded-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'Preparing...' : 'Download pinned CSV'}</button></div>
    {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    {open && (ev.isPending ? <p role="status" className="mt-3 text-sm text-muted-foreground">Loading records...</p>
      : ev.isError ? <p role="alert" className="mt-3 text-sm text-destructive">Evidence could not be loaded. <button className="underline" onClick={() => ev.refetch()}>Retry</button></p>
      : items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No evidence records for this measure and publication.</p>
      : <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><caption className="sr-only">Evidence records</caption>
        <thead><tr className="text-left text-muted-foreground"><th scope="col">Row</th><th scope="col">Disposition</th>{cols.map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead>
        <tbody>{items.map(i => <tr key={i.recordId} className="border-t"><td className="num py-1">{i.sourceRow}</td><td>{i.disposition}</td>{cols.map(c => <td key={c} className="num max-w-[120px] truncate">{i.values[c] ?? ''}</td>)}</tr>)}</tbody></table>
        <div className="mt-2 flex items-center justify-between text-xs"><span>{offset + 1}-{offset + items.length} of {ev.data?.total}</span>
          <span className="flex gap-3"><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="underline disabled:opacity-40">Previous</button>
            <button disabled={offset + LIMIT >= (ev.data?.total ?? 0)} onClick={() => setOffset(offset + LIMIT)} className="underline disabled:opacity-40">Next</button></span></div></div>)}
  </section>;
}

export function KpiDetail({ k, data, onClose }: { k: AnalyticsKpi | null; data: AnalyticsDashboard; onClose: () => void }) {
  const v = k ? fmtValue(k.value, k.unit) : null;
  return <Sheet open={!!k} onOpenChange={o => !o && onClose()}><SheetContent className="w-full overflow-y-auto sm:max-w-lg">
    {k && <><SheetHeader className="text-left"><div className="flex gap-1.5"><Tags k={k} /></div><SheetTitle className="font-serif text-2xl">{k.label}</SheetTitle>
      <SheetDescription className="sr-only">Definition, inputs and evidence for {k.label}</SheetDescription></SheetHeader>
      <div className="mt-4 flex items-baseline justify-between"><span className={`num text-3xl ${v === null ? 'font-serif' : ''} ${v === null && pointCount(k) === 0 ? 'italic text-[hsl(var(--miss))]' : ''}`}>{v ?? (pointCount(k) > 0 ? `Breakdown, ${pointCount(k)} points` : 'Not computable')}</span><StatusPill s={k.status} /></div>
      <p className="mt-3 text-sm">{k.reason}</p>
      <h3 className="eyebrow mt-6">Formula</h3><p className="mt-1 text-sm">{k.formula}</p>
      <h3 className="eyebrow mt-5">Required inputs</h3>
      <ul className="mt-1 list-disc pl-5 text-sm">{k.requiredInputs.length ? k.requiredInputs.map(r => <li key={r}>{r}</li>) : <li>None listed</li>}</ul>
      {k.points.length > 0 && <section className="mt-6"><h3 className="eyebrow mb-2">{k.area === 'category' ? 'Ranking' : 'Series'}</h3><SeriesChart points={k.points} unit={k.unit} label={k.label} ranking={k.area === 'category'} /></section>}
      {k.evidenceQuery && data.publicationId ? <Evidence key={k.id} k={k} pub={data.publicationId} />
        : <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">No record-level evidence is available for this measure in this publication.</p>}</>}
  </SheetContent></Sheet>;
}
