import type { AnalyticsKpi } from '@workspace/api-client-react';

export function fmtValue(v: number | null | undefined, unit: AnalyticsKpi['unit']): string | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  switch (unit) {
    case 'usd_cent': {
      const d = v / 100;
      return d.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Math.abs(d) >= 1000 ? 0 : 2 });
    }
    case 'percent': return `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    case 'days': return `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} d`;
    case 'rating': return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    default: return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
}
export const axisValue = (v: number, unit: AnalyticsKpi['unit']) => unit === 'usd_cent' ? `$${(v / 100).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}` : (fmtValue(v, unit) ?? '');

export const AREA_LABEL: Record<string, string> = { financial: 'Financial', sales: 'Sales', production: 'Production', inventory: 'Inventory', category: 'Category', customer: 'Customer' };
export const AREA_ORDER = ['financial', 'sales', 'production', 'inventory', 'category', 'customer'];
export const SOURCE_LABEL: Record<string, string> = { cash_monkey: 'Cash Monkey', upright: 'Upright', jewelry: 'Jewelry', shipping: 'Shipping', fedex: 'FedEx', shopgoodwill: 'ShopGoodwill', goodwill_books: 'Goodwill Books', ebay: 'eBay', amazon: 'Amazon' };
export const STATUS_LABEL: Record<string, string> = { available: 'Computed', partial: 'Partial', unavailable: 'Not computable' };

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
export function frameworkCsv(kpis: AnalyticsKpi[]): string {
  const head = ['id', 'label', 'area', 'unit', 'value', 'status', 'reason', 'formula', 'required_inputs', 'coo', 'plan_2027'];
  const rows = kpis.map(k => [k.id, k.label, k.area, k.unit, k.value === null ? '' : String(k.value), k.status, k.reason, k.formula, k.requiredInputs.join('; '), String(k.coo), String(k.plan2027)].map(q).join(','));
  return [head.join(','), ...rows].join('\n');
}
export function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const pointCount = (k: AnalyticsKpi) => k.points.filter(p => p.value !== null).length;
export const hasData = (k: AnalyticsKpi) => k.value !== null || pointCount(k) > 0;
