import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryGoodwillEvidence, type EvidencePage, type EvidenceRecord, type MetricResult } from '@workspace/api-client-react';
import { errorMessage, formatValue } from './model';
import { ExportButtons } from './MetricView';
import { DataTable, Notice, Panel, StatusTag } from './ui';

export function EvidenceRows({ page }: { page: EvidencePage }) {
  return <DataTable caption="Original source values and normalized fields; cents remain decimal strings" headers={['Record / source ordinal', 'Disposition', 'Source values and normalized fields', 'Provenance', 'Reasons']}>
    {page.items.map((row: EvidenceRecord) => <tr key={row.recordId}>
      <td>{row.recordId}<br />Data record {row.sourceRow}</td>
      <td><StatusTag value={row.disposition} /></td>
      <td><dl>{Object.entries(row.values).map(([key, value]) => <div key={key}><dt className="gw-meta">{key}</dt><dd>{value || '(empty)'}</dd></div>)}</dl></td>
      <td className="gw-meta">Source: {row.sourceId}<br />Batch: {row.batchId}<br />Run: {row.runId ?? 'Manual upload'}<br />Artifact: {row.artifactId}<br />SHA256: {row.checksum}</td>
      <td>{row.reasons.length ? row.reasons.map((reason, i) => <p key={i}>{reason.code}: {reason.message}<br />Next: {reason.nextAction}</p>) : 'No row-level reasons'}</td>
    </tr>)}
    {!page.items.length && <tr><td colSpan={5}>No rows in this page.</td></tr>}
  </DataTable>;
}

export function Pagination({ offset, total, limit, busy, onOffset }: {
  offset: number; total: number; limit: number; busy: boolean; onOffset: (offset: number) => void;
}) {
  return <div className="gw-actions">
    <button className="gw-button gw-button-secondary" disabled={busy || offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))}>Previous page</button>
    <span role="status">{total ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}` : '0 records'}</span>
    <button className="gw-button gw-button-secondary" disabled={busy || offset + limit >= total} onClick={() => onOffset(offset + limit)}>Next page</button>
  </div>;
}

export function EvidenceView({ result }: { result: MetricResult | null }) {
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const evidence = useQuery({
    queryKey: ['goodwill-reporting', 'evidence', result?.query, result?.publicationId, offset],
    queryFn: ({ signal }) => queryGoodwillEvidence({ query: result!.query, publicationId: result!.publicationId!, offset, limit }, { signal }),
    enabled: Boolean(result?.publicationId), retry: false,
  });
  return <Panel title="Finance evidence" description="Select a figure from reporting, listings or backlog. This view stays pinned to its immutable publication even if new imports occur.">
    {!result ? <Notice kind="info">No figure selected. Open a report and choose “Inspect contributing evidence”.</Notice> : <>
      <p className="gw-total">{formatValue(result.value, result.definition.unit)}</p>
      <p>{result.definition.label} · {result.query.sourceId} · {result.query.period.startDate} – {result.query.period.endDate}</p>
      <p>Definition {result.definition.version}: {result.definition.formula}</p>
      <p className="gw-meta">Pinned publication: {result.publicationId}</p>
      <p>Reconciliation and correction review are available under Operations → batch detail. This is evidence, not an accounting journal or Business Central posting.</p>
      {result.query.metricId === 'daily_customers' && <Notice kind="info">Evidence explains platform/day buyer identity. A row count is not a distinct buyer count; per-store and daily distinct counts are not additive.</Notice>}
      {evidence.isPending ? <Notice kind="info">Loading revision-pinned evidence…</Notice>
        : evidence.isError ? <Notice kind="error" onRetry={() => void evidence.refetch()}>{errorMessage(evidence.error)}</Notice>
          : evidence.data?.publicationId !== result.publicationId ? <Notice kind="error">Evidence revision did not match the selected figure. Rows are not displayed.</Notice>
            : evidence.data && <><EvidenceRows page={evidence.data} /><Pagination offset={offset} total={evidence.data.total} limit={limit} busy={evidence.isFetching} onOffset={setOffset} /></>}
      <ExportButtons result={result} />
    </>}
  </Panel>;
}