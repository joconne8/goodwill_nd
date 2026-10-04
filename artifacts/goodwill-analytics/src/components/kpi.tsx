import type { AnalyticsKpi } from '@workspace/api-client-react';
import { fmtValue, hasData, pointCount, STATUS_LABEL } from '@/lib/format';

export function StatusPill({ s }: { s: AnalyticsKpi['status'] }) {
  const c = s === 'available' ? '--ok' : s === 'partial' ? '--warn' : '--miss';
  return <span className="eyebrow inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: `hsl(var(${c}))` }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(var(${c}))` }} />{STATUS_LABEL[s]}</span>;
}
export function Tags({ k }: { k: AnalyticsKpi }) {
  return <>{k.coo && <span className="eyebrow rounded-sm bg-primary px-1.5 py-0.5 text-primary-foreground">COO</span>}
    {k.plan2027 && <span className="eyebrow rounded-sm bg-accent px-1.5 py-0.5 text-accent-foreground">2027</span>}</>;
}
export function KpiTile({ k, onOpen, i = 0, big }: { k: AnalyticsKpi; onOpen: (k: AnalyticsKpi) => void; i?: number; big?: boolean }) {
  const v = fmtValue(k.value, k.unit);
  return <button data-testid={`tile-kpi-${k.id}`} onClick={() => onOpen(k)} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
    className={`rise group flex flex-col gap-2 rounded-sm border border-card-border p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${!hasData(k) ? 'hatch bg-card/60' : 'bg-card'}`}>
    <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium leading-tight">{k.label}</span><span className="flex gap-1"><Tags k={k} /></span></div>
    {v === null ? (pointCount(k) > 0 ? <span className={`font-serif ${big ? 'text-3xl' : 'text-xl'}`}>View breakdown <span className="num text-sm text-muted-foreground">{pointCount(k)} points</span></span> : <span className={`font-serif italic text-[hsl(var(--miss))] ${big ? 'text-3xl' : 'text-xl'}`}>Not computable</span>)
      : <span className={`num ${big ? 'text-4xl' : 'text-2xl'} font-medium`}>{v}</span>}
    <p className="line-clamp-3 text-xs text-muted-foreground">{k.reason}</p>
    <div className="mt-auto flex items-center justify-between pt-1"><StatusPill s={k.status} /><span className="eyebrow text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">Inspect</span></div>
  </button>;
}
export function Panel({ title, body, action, tone = 'miss' }: { title: string; body: string; action?: { label: string; run: () => void }; tone?: 'miss' | 'warn' }) {
  return <div role="alert" className="hatch rise mx-auto my-10 max-w-lg rounded-sm border border-card-border bg-card p-8">
    <p className="eyebrow" style={{ color: `hsl(var(--${tone}))` }}>Notice</p>
    <h2 className="mt-2 font-serif text-2xl">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{body}</p>
    {action && <button data-testid="button-retry" onClick={action.run} className="mt-5 rounded-sm border border-primary px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground">{action.label}</button>}
  </div>;
}
