import { Link } from 'wouter';
import { useGetGoodwillAnalyticsFramework } from '@workspace/api-client-react';
import { AREA_LABEL, AREA_ORDER } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

const NOT: [string, string][] = [['Source revenue is not enterprise revenue', 'Overlapping reports need an approved aggregation rule.'], ['Payout is not profit', 'Margins wait for cost of goods and labor.'], ['Receipt time is not donation time', 'Receipt-to-listing can be shown; donation-to-listing needs donation timestamps.'], ['Period repeat buyers are not lifetime loyalty', 'New buyers need complete pre-period purchase history.']];
export default function Landing() {
  const fw = useGetGoodwillAnalyticsFramework({ query: { queryKey: ['goodwill-framework'], staleTime: 10 * 60_000, retry: 1 } });
  const items = fw.data ?? [];
  return <div className="min-h-[100dvh]">
    <header className="bg-sidebar px-6 py-16 text-sidebar-foreground md:px-16 md:py-24">
      <p className="eyebrow text-sidebar-primary rise">Goodwill Michiana. E-commerce economics and capacity</p>
      <h1 className="rise mt-5 max-w-4xl font-serif text-5xl leading-[1.02] md:text-7xl" style={{ animationDelay: '80ms' }}>What does e-commerce really earn, and what can we not yet say?</h1>
      <p className="rise mt-6 max-w-xl opacity-80" style={{ animationDelay: '160ms' }}>{items.length ? `${items.length} measures` : 'Every measure'} from the sponsor slides and COO additions. Every one stays on the page, with the exact input it is waiting for.</p>
      <div className="rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: '240ms' }}>
        <Link data-testid="link-sign-in" href="/sign-in" className="rounded-sm bg-sidebar-primary px-6 py-3 font-medium text-sidebar-primary-foreground">Operator sign-in to view figures</Link>
        <span className="eyebrow opacity-60">Synthetic data. No published values on this page.</span></div>
    </header>
    <section className="mx-auto max-w-6xl px-6 py-14">
      <h2 className="font-serif text-3xl">Rules the numbers obey</h2>
      <dl className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">{NOT.map(([t, b]) => <div key={t} className="border-t pt-3"><dt className="font-medium">{t}</dt><dd className="text-sm text-muted-foreground">{b}</dd></div>)}</dl>
    </section>
    <section className="mx-auto max-w-6xl px-6 pb-20" aria-label="KPI definitions">
      <h2 className="font-serif text-3xl">The framework {items.length > 0 && <span className="num text-xl text-muted-foreground" data-testid="text-framework-count">{items.length}</span>}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Definitions only. Computed status and values appear after sign-in.</p>
      {fw.isPending ? <div role="status" aria-label="Loading definitions" className="mt-8 grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
      : fw.isError ? <p role="alert" className="mt-6 text-sm">Definitions could not be loaded. <button className="underline" onClick={() => fw.refetch()}>Retry</button></p>
      : <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">{AREA_ORDER.map(a => { const g = items.filter(k => k.area === a); return g.length === 0 ? null : <div key={a}>
        <h3 className="eyebrow border-b pb-2">{AREA_LABEL[a]} ({g.length})</h3>
        <ul>{g.map(k => <li key={k.id} className="border-b border-border/60 py-2"><span className="text-sm font-medium">{k.label}</span><span className="block text-xs text-muted-foreground">{k.formula}</span><span className="block text-xs text-muted-foreground">Needs: {k.requiredInputs.join('; ')}</span></li>)}</ul></div>; })}</div>}
    </section>
  </div>;
}
