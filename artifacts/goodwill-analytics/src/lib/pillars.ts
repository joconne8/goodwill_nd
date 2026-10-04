export const PILLARS = ['growth', 'profitability', 'productivity', 'inventory', 'engagement'] as const;
export type Pillar = (typeof PILLARS)[number];
export const PILLAR_LABEL: Record<Pillar, string> = { growth: 'Growth', profitability: 'Profitability', productivity: 'Productivity', inventory: 'Inventory', engagement: 'Engagement' };
const ids = (p: Pillar, l: string[]) => l.map(i => [i, p] as const);
const MAP = new Map<string, Pillar>([
  ...ids('growth', ['enterprise_revenue', 'yoy_growth']),
  ...ids('profitability', ['gross_margin', 'net_margin', 'profit_labor', 'asp', 'median_price', 'category_sales', 'category_margin', 'category_asp', 'top_revenue', 'top_margin']),
  ...ids('inventory', ['backlog', 'time_to_list', 'donation_listing', 'unsold', 'sell_through', 'days_sell', 'relisted', 'category_units', 'category_sell']),
  ...ids('engagement', ['buyers', 'repeat_buyers', 'new_buyers', 'satisfaction', 'nps', 'conversion']),
]);
// Everything else (production throughput, labor productivity, per-employee) is productivity.
export const pillarOf = (id: string): Pillar => MAP.get(id) ?? 'productivity';
