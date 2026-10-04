import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getGoodwillSystemOverview, getGoodwillExperiments, startGoodwillExperimentRun, approveGoodwillExperimentRecipe } from '@workspace/api-client-react';
import type { ExperimentalAcquisitionAdapter } from '@/features/acquisition';

export const SYSTEM_OVERVIEW_KEY = ['goodwill-reporting', 'system-overview'] as const;

export function useSystemOverview() {
  return useQuery({ queryKey: SYSTEM_OVERVIEW_KEY, queryFn: ({ signal }) => getGoodwillSystemOverview({ signal }), retry: false, staleTime: 0, refetchInterval: 60_000 });
}

/** Authenticated adapter for the merged ExperimentReview. Never fabricates a provider call. */
export function useExperimentAdapter(): { adapter?: ExperimentalAcquisitionAdapter; error?: string; loading: boolean } {
  const q = useQuery({ queryKey: ['goodwill-reporting', 'experiments'], queryFn: ({ signal }) => getGoodwillExperiments({ signal }), retry: false });
  const adapter = useMemo<ExperimentalAcquisitionAdapter | undefined>(() => q.data ? {
    access: q.data.access,
    list: () => getGoodwillExperiments(),
    start: async input => {
      const scope = { sourceId: input.sourceId, reportType: input.reportType, period: input.period };
      if (input.mode === 'approved-replay') {
        if (!input.approvalId) throw new Error('Select an approved recipe before replay.');
        return startGoodwillExperimentRun({ ...scope, mode: input.mode, approvalId: input.approvalId });
      }
      return startGoodwillExperimentRun({ ...scope, mode: input.mode });
    },
    approve: input => approveGoodwillExperimentRecipe(input),
  } : undefined, [q.data]);
  return { adapter, loading: q.isPending, error: q.error instanceof Error ? q.error.message : undefined };
}
