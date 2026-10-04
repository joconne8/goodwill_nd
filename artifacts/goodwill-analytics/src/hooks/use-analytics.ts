import { useQuery } from '@tanstack/react-query';
import { queryGoodwillAnalytics, queryGoodwillEvidence, type AnalyticsScope, type EvidenceQuery } from '@workspace/api-client-react';

// Key carries the full scope: a different context never shows previous results.
export const analyticsKey = (scope: AnalyticsScope) => ['goodwill-analytics', scope] as const;
export function useAnalytics(scope: AnalyticsScope) {
  return useQuery({ queryKey: analyticsKey(scope), queryFn: ({ signal }) => queryGoodwillAnalytics(scope, { signal }), retry: false, staleTime: 5 * 60_000, refetchOnWindowFocus: false });
}
export function useEvidence(q: EvidenceQuery | null) {
  return useQuery({ queryKey: ['goodwill-evidence', q], queryFn: ({ signal }) => queryGoodwillEvidence(q!, { signal }), enabled: !!q, retry: false, staleTime: 5 * 60_000 });
}
