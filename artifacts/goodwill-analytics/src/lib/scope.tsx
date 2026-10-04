import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AnalyticsScope } from '@workspace/api-client-react';

export const SNAPSHOT_AT = '2026-08-31T23:59:59-04:00';
interface S { sourceId: AnalyticsScope['sourceId']; startDate: string; endDate: string; storeId: string; snapshot: boolean }
interface Ctx { state: S; set: (p: Partial<S>) => void; scope: AnalyticsScope }
const C = createContext<Ctx | null>(null);

export function ScopeStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<S>({ sourceId: 'shopgoodwill', startDate: '2026-08-01', endDate: '2026-08-31', storeId: '', snapshot: false });
  const value = useMemo<Ctx>(() => ({
    state, set: p => setState(s => ({ ...s, ...p })),
    scope: { sourceId: state.sourceId, period: { startDate: state.startDate, endDate: state.endDate }, ...(state.storeId ? { storeId: state.storeId } : {}), ...(state.snapshot ? { snapshotAt: SNAPSHOT_AT } : {}) },
  }), [state]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useScope() { const c = useContext(C); if (!c) throw new Error('scope'); return c; }
