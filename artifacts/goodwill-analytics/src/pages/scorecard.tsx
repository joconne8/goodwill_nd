import type { AnalyticsDashboard, AnalyticsKpi } from '@workspace/api-client-react';
import { KpiTile } from '@/components/kpi';

export default function Scorecard({ d, open }: { d: AnalyticsDashboard; open: (k: AnalyticsKpi) => void }) {
  const coo = d.kpis.filter(k => k.coo); const plan = d.kpis.filter(k => k.plan2027);
  return <div className="space-y-12">
    <section aria-labelledby="h-plan"><p className="eyebrow text-muted-foreground">Directions for 2027</p><h2 id="h-plan" className="font-serif text-3xl">Three priorities</h2>
      <p className="mt-1 text-sm text-muted-foreground">Direction only. No approved targets are loaded, so none are shown or implied.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{plan.map((k, i) => <KpiTile key={k.id} k={k} i={i} big onOpen={open} />)}</div>
      {plan.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No 2027 priority measures were returned.</p>}</section>
    <section aria-labelledby="h-coo"><h2 id="h-coo" className="font-serif text-3xl">COO scorecard <span className="num text-xl text-muted-foreground">{coo.length}</span></h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{coo.map((k, i) => <KpiTile key={k.id} k={k} i={i} onOpen={open} />)}</div>
      {coo.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No COO measures were returned.</p>}</section>
  </div>;
}
