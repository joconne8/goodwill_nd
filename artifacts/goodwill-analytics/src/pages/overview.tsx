import type { AnalyticsChannel as Channel, AnalyticsDashboard, AnalyticsKpi } from '@workspace/api-client-react';
import { KpiTile } from '@/components/kpi';
import { SeriesChart } from '@/components/charts';
import { fmtValue } from '@/lib/format';
import { pillarOf, PILLARS, PILLAR_LABEL } from '@/lib/pillars';
import { useScope } from '@/lib/scope';

export default function Overview({ d, open }: { d: AnalyticsDashboard; open: (k: AnalyticsKpi) => void }) {
  const n = (s: string) => d.kpis.filter(k => k.status === s).length;
  const { state, set } = useScope();
  const nightly = state.startDate === state.endDate;
  const isExp = (c: Channel) => ['shipping', 'fedex'].includes(c.sourceId) || /expense|cost|postage|shipping/i.test(c.revenueLabel);
  const income = d.channels.filter(c => !isExp(c)); const expense = d.channels.filter(isExp);
  return <div className="space-y-12">
    <section className="grid gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-4">
      {[['Measures', d.kpis.length], ['Computed', n('available')], ['Partial', n('partial')], ['Not computable', n('unavailable')]].map(([l, v]) => <div key={l} className="bg-card p-4"><p className="eyebrow text-muted-foreground">{l}</p><p className="num text-3xl">{v}</p></div>)}</section>

    <section aria-labelledby="h-night"><div className="flex flex-wrap items-end justify-between gap-3"><h2 id="h-night" className="font-serif text-3xl">Nightly marketplace revenue and customers</h2>
      <div role="group" aria-label="Period" className="flex overflow-hidden rounded-sm border text-sm">
        <button data-testid="button-period-night" aria-pressed={nightly} onClick={() => set({ startDate: state.endDate })} className={`px-3 py-1.5 ${nightly ? 'bg-primary text-primary-foreground' : ''}`}>Night of {state.endDate}</button>
        <button data-testid="button-period-month" aria-pressed={!nightly} onClick={() => set({ startDate: '2026-08-01', endDate: '2026-08-31' })} className={`px-3 py-1.5 ${!nightly ? 'bg-primary text-primary-foreground' : ''}`}>Full August 2026</button></div></div>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each source scope keeps its own measure and label. They are not ranked, compared or summed. Customers populate for a single day only; a month never adds up daily customer counts.</p>
      {d.channels.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No channels were returned for this scope.</p> : <>
        {[['Sales and income measures', income], ['Expenses (separate; never netted into revenue)', expense]].map(([t, list]) => (list as Channel[]).length > 0 && <div key={t as string} className="mt-6"><h3 className="eyebrow mb-3 border-b pb-2">{t as string}</h3>
          <div className="grid gap-3 lg:grid-cols-2">{(list as Channel[]).map((c, i) => { const rev = fmtValue(c.revenue, 'usd_cent'); return <article key={c.sourceId} data-testid={`card-channel-${c.sourceId}`} style={{ animationDelay: `${i * 40}ms` }} className={`rise rounded-sm border bg-card p-4 ${rev === null ? 'hatch' : ''}`}>
            <h4 className="font-medium">{c.label}</h4>
            <div className="mt-2 grid grid-cols-2 gap-4"><div><p className="eyebrow text-muted-foreground">{c.revenueLabel}</p>{rev ? <p className="num text-2xl">{rev}</p> : <p className="font-serif italic text-[hsl(var(--miss))]">Not computable</p>}</div>
              <div><p className="eyebrow text-muted-foreground">Customers</p>{c.customers !== null ? <p className="num text-2xl">{c.customers.toLocaleString('en-US')}</p> : <p className="font-serif italic text-[hsl(var(--miss))]">Not computable</p>}</div></div>
            <p className="mt-2 text-xs text-muted-foreground">{c.reason}</p>{c.customers === null && <p className="text-xs text-muted-foreground">{c.customerReason}</p>}
            {c.points.length > 0 && <div className="mt-3"><SeriesChart points={c.points} unit="usd_cent" label={`${c.label}: ${c.revenueLabel}`} height={110} /></div>}</article>; })}</div></div>)}
        <details className="mt-4 text-xs"><summary className="cursor-pointer text-muted-foreground">Channel table</summary><table className="mt-2 w-full"><caption className="sr-only">Channels with their own measure labels</caption>
          <thead><tr className="text-left text-muted-foreground"><th scope="col">Channel</th><th scope="col">Measure</th><th scope="col" className="text-right">Value</th><th scope="col" className="text-right">Customers</th></tr></thead>
          <tbody>{d.channels.map(c => <tr key={c.sourceId} className="border-t"><td className="py-1">{c.label}</td><td>{c.revenueLabel}</td><td className="num text-right">{fmtValue(c.revenue, 'usd_cent') ?? 'Not computable'}</td><td className="num text-right">{c.customers ?? 'Not computable'}</td></tr>)}</tbody></table></details></>}
    </section>

    <section aria-labelledby="h-month"><h2 id="h-month" className="font-serif text-3xl">Monthly pillars</h2>
      <div className="mt-5 space-y-10">{PILLARS.map(p => { const ks = d.kpis.filter(k => pillarOf(k.id) === p); if (!ks.length) return null;
        return <div key={p}><h3 className="eyebrow mb-3 border-b pb-2">{PILLAR_LABEL[p]} <span className="text-muted-foreground">({ks.length})</span></h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{ks.map((k, i) => <KpiTile key={k.id} k={k} i={i} onOpen={open} />)}</div></div>; })}</div>
    </section>
  </div>;
}
