import { useMutation, useQuery } from '@tanstack/react-query';
import { exportGoodwillReport, queryGoodwillMetrics, type MetricQuery, type MetricResult, type SourceCoverage } from '@workspace/api-client-react';
import { errorMessage, formatTimestamp, formatValue, hasEvidence, queryKey, saveDownload } from './model';
import { DataTable, Notice, Panel, StatusTag } from './ui';

export function Coverage({ coverage }: { coverage: SourceCoverage[] }) {
  return <DataTable caption="Coverage and last-good publication" headers={['Dataset', 'State', 'Report interval', 'Last good / latest attempt', 'Limitations']}>
    {coverage.map(c => <tr key={c.datasetId}>
      <td>{c.datasetId}</td><td><StatusTag value={c.status} /></td>
      <td>{c.startDate ?? 'Unknown'} – {c.endDate ?? 'Unknown'}</td>
      <td>{formatTimestamp(c.lastGoodAt)}<br /><span className="gw-muted">Latest: {formatTimestamp(c.latestAttemptAt)}</span></td>
      <td>{c.reason}{c.missingRows !== null && <p>Missing/incomplete rows: {c.missingRows}</p>}</td>
    </tr>)}
    {!coverage.length && <tr><td colSpan={5}>Coverage unavailable. An empty report does not establish completeness.</td></tr>}
  </DataTable>;
}

export function ExportButtons({ result }: { result: MetricResult }) {
  const download = useMutation({
    mutationFn: async (kind: 'summary' | 'evidence') => {
      if (!result.publicationId || !hasEvidence(result)) throw new Error('No queryable published evidence is available.');
      const exported = await exportGoodwillReport({ kind, query: result.query, publicationId: result.publicationId });
      if (exported.publicationId !== result.publicationId) throw new Error('Export revision did not match the displayed figure. Nothing downloaded.');
      saveDownload(new Blob([exported.csv], { type: exported.contentType }), exported.filename);
    },
  });
  return <div className="gw-stack">
    <div className="gw-actions">
      <button className="gw-button gw-button-secondary" disabled={download.isPending || !hasEvidence(result)} onClick={() => download.mutate('summary')}>Summary CSV</button>
      <button className="gw-button gw-button-secondary" disabled={download.isPending || !hasEvidence(result)} onClick={() => download.mutate('evidence')}>Evidence CSV</button>
      {download.isPending && <span role="status">Preparing download…</span>}
    </div>
    {download.isError && <Notice kind="error">{errorMessage(download.error)}</Notice>}
  </div>;
}

export function MetricView({ query, title, onEvidence, enabled = true }: {
  query: MetricQuery; title: string; onEvidence: (result: MetricResult) => void; enabled?: boolean;
}) {
  const result = useQuery({
    queryKey: queryKey(query),
    queryFn: ({ signal }) => queryGoodwillMetrics(query, { signal }),
    enabled, retry: false, staleTime: 0, refetchInterval: 30_000,
  });
  return <Panel title={title} description={`Only ${query.sourceId} · ${query.period.startDate} through ${query.period.endDate} · Eastern reporting dates`}
    actions={<button className="gw-button gw-button-secondary" disabled={!enabled || result.isFetching} onClick={() => void result.refetch()}>Refresh figure</button>}>
    {!enabled ? <Notice kind="info">Select one snapshot timestamp before requesting backlog.</Notice>
      : result.isPending ? <Notice kind="info">Loading the backend figure…</Notice>
        : result.isError ? <Notice kind="error" onRetry={() => void result.refetch()}>{errorMessage(result.error)}</Notice>
          : result.data && <MetricResultView result={result.data} onEvidence={onEvidence} />}
  </Panel>;
}

function MetricResultView({ result, onEvidence }: { result: MetricResult; onEvidence: (result: MetricResult) => void }) {
  return <div className="gw-stack">
    <div>
      <p className="gw-meta">{result.definition.label} · definition {result.definition.version}</p>
      <p className="gw-total" data-testid={`metric-${result.query.metricId}`}>{formatValue(result.value, result.definition.unit)}</p>
      {result.query.metricId === 'daily_customers' && result.value === null && <p>Daily distinct buyers are shown below. There is no unique period total and daily counts must not be summed.</p>}
      <p>{result.definition.formula}</p>
      <p className="gw-muted">{result.definition.grain} · {result.definition.timeBasis} · {result.currency} · {result.timezone}</p>
      {result.definition.availabilityReason && <Notice kind="warning">{result.definition.availabilityReason}</Notice>}
      {result.definition.exclusions.length > 0 && <p>Excluded: {result.definition.exclusions.join('; ')}.</p>}
      <p className="gw-meta">Publication: {result.publicationId ?? 'None'} · {formatTimestamp(result.publishedAt)}</p>
      <p className="gw-meta">Contributing batches: {result.batchIds.length ? result.batchIds.join(', ') : 'None'}</p>
      {result.query.snapshotAt && <p>Selected snapshot (source timestamp): <strong>{result.query.snapshotAt}</strong></p>}
    </div>
    {result.warnings.map((warning, i) => <Notice key={`${i}-${warning}`} kind="warning">{warning}</Notice>)}
    <DataTable caption="Server-calculated breakdown; pagination and display formatting do not change totals" headers={['Group', result.definition.unit === 'usd_cent' ? 'USD' : 'Count', 'Contributing rows', 'Missing buyer rows']}>
      {result.points.map(point => <tr key={point.key}><td>{point.key}</td><td>{formatValue(point.value, result.definition.unit)}</td><td>{point.contributingRows}</td><td>{point.missingBuyerRows}</td></tr>)}
      {!result.points.length && <tr><td colSpan={4}>No breakdown points returned. Missing coverage is not a zero.</td></tr>}
    </DataTable>
    <Coverage coverage={result.coverage} />
    <button className="gw-button" disabled={!hasEvidence(result)} onClick={() => onEvidence(result)}>Inspect contributing evidence</button>
    <ExportButtons result={result} />
  </div>;
}