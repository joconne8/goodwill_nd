import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnalyticsKpi, AnalyticsPoint } from '@workspace/api-client-react';
import { axisValue, fmtValue } from '@/lib/format';

type U = AnalyticsKpi['unit'];
const tip = (unit: U) => ({ formatter: (v: unknown) => [typeof v === 'number' ? fmtValue(v, unit) : 'No value', ''] as [string, string], contentStyle: { fontSize: 12, borderRadius: 2, background: 'hsl(44 40% 98%)', border: '1px solid hsl(38 18% 82%)' }, separator: '' });

export function PointsTable({ points, unit, caption }: { points: AnalyticsPoint[]; unit: U; caption: string }) {
  return <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">Data table ({points.length} points)</summary>
    <table className="mt-2 w-full"><caption className="sr-only">{caption}</caption><thead><tr className="text-left text-muted-foreground"><th scope="col" className="py-1">Label</th><th scope="col" className="py-1 text-right">Value</th></tr></thead>
      <tbody>{points.map((p, i) => <tr key={i} className="border-t border-border/60"><td className="py-1">{p.label}</td><td className="num py-1 text-right">{fmtValue(p.value, unit) ?? 'No value'}</td></tr>)}</tbody></table></details>;
}

export function SeriesChart({ points, unit, label, height = 160, ranking }: { points: AnalyticsPoint[]; unit: U; label: string; height?: number; ranking?: boolean }) {
  const real = points.filter(p => p.value !== null);
  if (real.length < 2) return <div><p className="text-xs text-muted-foreground">{real.length === 0 ? 'No values to chart.' : 'Only one value; a trend needs at least two.'}</p>{points.length > 0 && <PointsTable points={points} unit={unit} caption={label} />}</div>;
  if (ranking) {
    const d = [...real].sort((a, b) => (b.value as number) - (a.value as number));
    return <div><div role="img" aria-label={`${label}, ranked`} style={{ height: Math.max(height, d.length * 26 + 20) }}>
      <ResponsiveContainer><BarChart data={d} layout="vertical" margin={{ left: 0, right: 12 }}>
        <XAxis type="number" tickFormatter={v => axisValue(v, unit)} fontSize={11} domain={[0, 'auto']} /><YAxis type="category" dataKey="label" width={110} fontSize={11} interval={0} />
        <Tooltip {...tip(unit)} /><Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} /></BarChart></ResponsiveContainer></div>
      <PointsTable points={points} unit={unit} caption={label} /></div>;
  }
  return <div><div role="img" aria-label={`${label} over time; gaps mean missing values`} style={{ height }}>
    <ResponsiveContainer><LineChart data={points} margin={{ left: 0, right: 8, top: 6 }}><CartesianGrid vertical={false} stroke="hsl(38 18% 85%)" />
      <XAxis dataKey="label" fontSize={10} minTickGap={24} /><YAxis width={48} fontSize={10} tickFormatter={v => axisValue(v, unit)} domain={['auto', 'auto']} />
      <Tooltip {...tip(unit)} /><Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} connectNulls={false} dot={points.length < 10} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
    <PointsTable points={points} unit={unit} caption={label} /></div>;
}
