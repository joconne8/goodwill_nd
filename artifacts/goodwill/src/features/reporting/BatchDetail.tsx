import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportGoodwillReport, getGoodwillBatch, getGoodwillBatchRows, queryGoodwillMetrics, reviewGoodwillBatch, type CorrectionReview } from '@workspace/api-client-react';
import { EvidenceRows, Pagination } from './EvidenceView';
import { errorMessage, formatTimestamp, formatValue, saveDownload } from './model';
import { DataTable, Notice, Panel, StatusTag } from './ui';

export function BatchDetail({ batchId }: { batchId: string }) {
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [disposition, setDisposition] = useState<'' | 'accepted' | 'rejected' | 'duplicate'>('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [action, setAction] = useState<CorrectionReview['action']>('reject');
  const batch = useQuery({
    queryKey: ['goodwill-reporting', 'batch', batchId],
    queryFn: ({ signal }) => getGoodwillBatch(batchId, { signal }),
    retry: false, refetchInterval: 15_000,
  });
  const rows = useQuery({
    queryKey: ['goodwill-reporting', 'batch-rows', batchId, disposition, offset],
    queryFn: ({ signal }) => getGoodwillBatchRows(batchId, { offset, limit: 25, ...(disposition ? { disposition } : {}) }, { signal }),
    retry: false,
  });
  const current = useQuery({
    queryKey: ['goodwill-reporting', 'review-publication', batchId, batch.data?.sourceId, batch.data?.period],
    queryFn: ({ signal }) => queryGoodwillMetrics({
      sourceId: batch.data!.sourceId, metricId: 'net_item_sales', groupBy: 'none', period: batch.data!.period,
    }, { signal }),
    enabled: batch.data?.state === 'quarantined', retry: false, staleTime: Infinity, refetchOnWindowFocus: false,
  });
  const review = useMutation({
    mutationFn: (input: CorrectionReview) => reviewGoodwillBatch(batchId, input),
    onSuccess: async () => {
      setReason(''); setConfirmed(false);
      await client.invalidateQueries({ predicate: q => q.queryKey[0] === 'goodwill-reporting' || q.queryKey[0] === '/api/goodwill/v2/catalog' });
    },
    retry: false,
  });
  const download = useMutation({
    mutationFn: async () => {
      const csv = await exportGoodwillReport({ kind: 'rejections', batchId });
      saveDownload(new Blob([csv.csv], { type: csv.contentType }), csv.filename);
    }, retry: false,
  });
  return <Panel title="Batch detail and reconciliation" description={`Immutable attempt: ${batchId}`}>
    {batch.isPending ? <Notice kind="info">Loading batch detail…</Notice>
      : batch.isError ? <Notice kind="error" onRetry={() => void batch.refetch()}>{errorMessage(batch.error)}</Notice>
        : batch.data && <>
          <p>{batch.data.sourceId} / {batch.data.reportType} · {batch.data.period.startDate} – {batch.data.period.endDate} · <StatusTag value={batch.data.state} /></p>
          <p>Input {batch.data.inputRows} · accepted {batch.data.acceptedRows} · rejected {batch.data.rejectedRows} · duplicate {batch.data.duplicateRows}</p>
          <p className="gw-meta">Received {formatTimestamp(batch.data.receivedAt)} · published {formatTimestamp(batch.data.publishedAt)}</p>
          <p className="gw-meta">Publication {batch.data.publicationId ?? 'None'} · run {batch.data.runId ?? 'Manual upload'} · duplicate of {batch.data.duplicateOf ?? 'None'} · supersedes {batch.data.supersedesBatchId ?? 'None'}</p>
          {batch.data.artifact && <p className="gw-meta">Original: {batch.data.artifact.filename} · {batch.data.artifact.byteSize} bytes · artifact {batch.data.artifact.artifactId} · SHA256 {batch.data.artifact.checksum}</p>}
          {batch.data.failure && <Notice kind="error">{batch.data.failure.code}: {batch.data.failure.message} Next: {batch.data.failure.nextAction}</Notice>}
          {batch.data.warnings.map((warning, i) => <Notice kind="warning" key={i}>{warning}</Notice>)}
          {batch.data.state === 'duplicate' && !batch.data.publicationId && <Notice kind="warning">This duplicate references an unpublished attempt; it is not published coverage. A quarantined checksum can currently suppress a corrected-period retry. This data-service issue requires integration review, not a client workaround.</Notice>}
          <DataTable caption="Backend reconciliation controls; no client-derived financial arithmetic" headers={['Control', 'Expected', 'Actual', 'Difference', 'State']}>
            {batch.data.reconciliation.map(check => <tr key={check.name}><td>{check.name}</td><td>{formatValue(check.expected, check.unit)}</td><td>{formatValue(check.actual, check.unit)}</td><td>{formatValue(check.difference, check.unit)}</td><td><StatusTag value={check.status} /></td></tr>)}
            {!batch.data.reconciliation.length && <tr><td colSpan={5}>No reconciliation controls returned. This does not imply approval.</td></tr>}
          </DataTable>
          {batch.data.state === 'quarantined' && <div className="gw-stack">
            <h3>Correction review</h3>
            <Notice kind="warning">Approving supersession can change the published report for this identified source, report and scope. A correction must replace the exact original batch period and full key set, not a single isolated row. Original files and prior revisions remain. Reject leaves published figures unchanged. Review the conflicting rows before acting. Synthetic review only; no production finance approval is implied.</Notice>
            <p className="gw-meta">Current immutable publication: {current.data?.publicationId ?? 'Unavailable'}</p>
            {current.isError && <Notice kind="error">{errorMessage(current.error)}</Notice>}
            <button className="gw-button gw-button-secondary" disabled={current.isFetching || review.isPending} onClick={() => { setConfirmed(false); void current.refetch(); }}>Refresh review revision</button>
            <label className="gw-field">Review action<select aria-label="Review action" disabled={review.isPending} value={action} onChange={e => setAction(e.target.value as CorrectionReview['action'])}><option value="reject">Reject correction</option><option value="approve_supersession">Approve identified supersession</option></select></label>
            <label className="gw-field">Review reason (10–1000 characters)<textarea disabled={review.isPending} value={reason} minLength={10} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
            <label><input type="checkbox" disabled={review.isPending || current.isFetching} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this correction and confirm this action affects synthetic data only.</label>
            <button className="gw-button" disabled={review.isPending || current.isFetching || !confirmed || reason.trim().length < 10 || !current.data?.publicationId || current.isError} onClick={() => review.mutate({
              action, reason: reason.trim(), expectedPublicationId: current.data!.publicationId!, confirmSyntheticOnly: true,
            })}>{review.isPending ? 'Submitting review…' : 'Submit correction review'}</button>
            {review.isError && <Notice kind="error">{errorMessage(review.error)} A changed publication requires refreshed evidence and a new explicit review; it is never retried automatically.</Notice>}
          </div>}
        </>}
    {review.isSuccess && <Notice kind="success">Review recorded as {review.data.state}. History and current figures refreshed; previously selected evidence remains pinned.</Notice>}
    <label className="gw-field">Row disposition<select aria-label="Row disposition" value={disposition} onChange={e => { setDisposition(e.target.value as typeof disposition); setOffset(0); }}><option value="">All dispositions</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="duplicate">Duplicate</option></select></label>
    {rows.isPending ? <Notice kind="info">Loading source rows…</Notice>
      : rows.isError ? <Notice kind="error" onRetry={() => void rows.refetch()}>{errorMessage(rows.error)}</Notice>
        : rows.data && <><EvidenceRows page={rows.data} /><Pagination offset={offset} total={rows.data.total} limit={25} busy={rows.isFetching} onOffset={setOffset} /></>}
    <button className="gw-button gw-button-secondary" disabled={download.isPending} onClick={() => download.mutate()}>Rejection CSV</button>
    {download.isError && <Notice kind="error">{errorMessage(download.error)}</Notice>}
  </Panel>;
}