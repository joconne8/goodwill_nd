import { useMemo, useState } from 'react';
import type { AnalyticsDashboard, AnalyticsKpi } from '@workspace/api-client-react';
import { useGetGoodwillCatalog } from '@workspace/api-client-react';
import { StatusPill, Tags } from '@/components/kpi';
import { pillarOf, PILLARS, PILLAR_LABEL } from '@/lib/pillars';
import { AREA_LABEL, AREA_ORDER, download, fmtValue, frameworkCsv, hasData, pointCount } from '@/lib/format';

export default function Metrics({ d, open }: { d: AnalyticsDashboard; open: (k: AnalyticsKpi) => void }) {
  const [area, setArea] = useState('all'); const [pillar, setPillar] = useState('all'); const [status, setStatus] = useState('all'); const [q, setQ] = useState('');
  const cat = useGetGoodwillCatalog({ query: { queryKey: ['goodwill-catalog'], staleTime: 10 * 60_000, retry: false } });
  const rows = useMemo(() => d.kpis.filter(k => (area === 'all' || k.area === area) && (pillar === 'all' || pillarOf(k.id) === pillar) && (status === 'all' || k.status === status) && k.label.toLowerCase().includes(q.toLowerCase())), [d.kpis, area, pillar, status, q]);
  const blocked = useMemo(() => { const m = new Map<string, number>(); d.kpis.filter(k => k.status !== 'available').forEach(k => k.requiredInputs.forEach(r => m.set(r, (m.get(r) ?? 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]); }, [d.kpis]);
  const sel = 'rounded-sm border border-input bg-card px-2 py-1.5 text-sm';
  const ds = cat.data?.datasets.filter(x => x.sourceId === d.query.sourceId) ?? [];
  return <div className="space-y-12">
    <section><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="font-serif text-3xl">Framework <span className="num text-xl text-muted-foreground">{d.kpis.length}</span></h2>
      <button data-testid="button-framework-csv" onClick={() => download(`goodwill-framework-${d.query.sourceId}-${d.query.period.startDate}_${d.query.period.endDate}.csv`, frameworkCsv(d.kpis))} className="rounded-sm border border-primary px-3 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground">Download framework CSV</button></div>
      <p className="mt-1 text-xs text-muted-foreground">Summary of this response only. Record-level evidence CSVs are pinned to the publication from each measure's detail.</p>
      <div className="mt-4 flex flex-wrap gap-2"><input data-testid="input-search" type="search" aria-label="Search measures" placeholder="Search measures" className={sel} value={q} onChange={e => setQ(e.target.value)} />
        <select aria-label="Area" className={sel} value={area} onChange={e => setArea(e.target.value)}><option value="all">All areas</option>{AREA_ORDER.map(a => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}</select>
        <select aria-label="Pillar" className={sel} value={pillar} onChange={e => setPillar(e.target.value)}><option value="all">All pillars</option>{PILLARS.map(a => <option key={a} value={a}>{PILLAR_LABEL[a]}</option>)}</select>
        <select aria-label="Status" className={sel} value={status} onChange={e => setStatus(e.target.value)}><option value="all">Any status</option><option value="available">Computed</option><option value="partial">Partial</option><option value="unavailable">Not computable</option></select></div>
      <div className="mt-4 overflow-x-auto rounded-sm border bg-card"><table className="w-full text-sm"><caption className="sr-only">All framework measures</caption>
        <thead><tr className="border-b text-left"><th scope="col" className="eyebrow p-3">Measure</th><th scope="col" className="eyebrow p-3">Area / pillar</th><th scope="col" className="eyebrow p-3 text-right">Value</th><th scope="col" className="eyebrow p-3">Status</th><th scope="col" className="eyebrow hidden p-3 lg:table-cell">Missing inputs</th></tr></thead>
        <tbody>{rows.map(k => { const v = fmtValue(k.value, k.unit); return <tr key={k.id} className={`border-b last:border-0 hover:bg-muted/50 ${!hasData(k) ? 'hatch' : ''}`}>
          <td className="p-3"><button data-testid={`row-kpi-${k.id}`} onClick={() => open(k)} className="flex flex-wrap items-center gap-2 text-left font-medium underline-offset-2 hover:underline">{k.label}<Tags k={k} /></button></td>
          <td className="p-3 text-muted-foreground">{AREA_LABEL[k.area]}<span className="block text-xs">{PILLAR_LABEL[pillarOf(k.id)]}</span></td><td className="num p-3 text-right">{v ?? (pointCount(k) > 0 ? <span className="font-serif">Breakdown ({pointCount(k)})</span> : <span className="font-serif italic text-[hsl(var(--miss))]">none</span>)}</td>
          <td className="p-3"><StatusPill s={k.status} /></td><td className="hidden max-w-xs p-3 text-xs text-muted-foreground lg:table-cell">{k.status === 'available' ? '' : k.requiredInputs.join(', ')}</td></tr>; })}</tbody></table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No measures match these filters.</p>}</div></section>
    <section><h2 className="font-serif text-2xl">Data readiness</h2><p className="text-sm text-muted-foreground">Inputs blocking measures that are not fully computed.</p>
      {blocked.length === 0 ? <p className="mt-3 text-sm">No measure is waiting on an input.</p> : <ul className="mt-3 grid gap-2 sm:grid-cols-2">{blocked.map(([r, c]) => <li key={r} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{r}</span><span className="num text-muted-foreground">{c} measure{c === 1 ? '' : 's'}</span></li>)}</ul>}</section>
    <section><h2 className="font-serif text-2xl">Source datasets: {d.query.sourceId}</h2>
      {cat.isPending ? <p role="status" className="mt-2 text-sm text-muted-foreground">Loading catalog...</p> : cat.isError ? <p role="alert" className="mt-2 text-sm">Catalog unavailable. <button className="underline" onClick={() => cat.refetch()}>Retry</button></p>
      : ds.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No datasets are registered for this source.</p>
      : <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Dataset coverage</caption><thead><tr className="border-b text-left"><th scope="col" className="eyebrow py-2">Dataset</th><th scope="col" className="eyebrow">Grain</th><th scope="col" className="eyebrow">Coverage</th><th scope="col" className="eyebrow">Reason</th></tr></thead>
        <tbody>{ds.map(x => <tr key={x.id} className="border-b align-top"><td className="py-2">{x.reportType}</td><td className="text-muted-foreground">{x.grain}</td><td>{x.coverage.status}{x.coverage.startDate && <span className="num block text-xs text-muted-foreground">{x.coverage.startDate} to {x.coverage.endDate}</span>}</td><td className="max-w-sm text-xs text-muted-foreground">{x.coverage.reason}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
