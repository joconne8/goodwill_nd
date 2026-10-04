import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listGoodwillBatches, queryGoodwillMetrics, type GoodwillCatalog, type GoodwillSystemOverview, type MetricQuery, type MetricResult, type ReportPeriod } from '@workspace/api-client-react';
import { BatchDetail } from './BatchDetail';
import { errorMessage, formatValue } from './model';
import { useSystemOverview } from './systemApi';
import { DataTable, Notice, Panel, StatusTag } from './ui';

const BUSINESS_ROLES = ['sales', 'expense', 'statement'];
const n = (v: number) => v.toLocaleString('en-US');

function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="gw-skeleton" aria-hidden="true">{Array.from({ length: rows }, (_, i) => <span key={i} />)}</div>;
}

/** All nine business sources, each separate; supporting datasets listed apart. */
function SourceFigure({ sourceId, period, onEvidence }: { sourceId: string; period: ReportPeriod; onEvidence: (r: MetricResult) => void }) {
  const metricId: MetricQuery['metricId'] = ['shipping', 'fedex'].includes(sourceId) ? 'shipping_expense' : 'source_net';
  const query: MetricQuery = { sourceId, metricId, period, groupBy: 'none' };
  const q = useQuery({ queryKey: ['goodwill-reporting', 'overview-metric', query], queryFn: ({ signal }) => queryGoodwillMetrics(query, { signal }), retry: false });
  if (q.isPending) return <Skeleton rows={2} />;
  if (q.isError) return <Notice kind="error" onRetry={() => void q.refetch()}>{errorMessage(q.error)}</Notice>;
  const r = q.data;
  const gaps = r.coverage.filter(c => c.status !== 'complete');
  return <div className="gw-source-figure" data-testid={`figure-source-${sourceId}`}>
    <p className="gw-meta">{r.definition.label} · {period.startDate} – {period.endDate} · all stores in this source</p>
    <p className="gw-source-value" data-testid={`text-figure-${sourceId}`}>{r.value === null ? 'Unavailable' : formatValue(r.value, r.definition.unit)}</p>
    <p className="gw-meta">{r.definition.formula}</p>
    {r.definition.availabilityReason && <p className="gw-meta">{r.definition.availabilityReason}</p>}
    {gaps.map(c => <p key={c.datasetId} className="gw-meta"><StatusTag value={c.status} /> {c.datasetId}: {c.reason}</p>)}
    {r.warnings.map((w, i) => <p key={i} className="gw-meta">{w}</p>)}
    <p className="gw-meta">Publication {r.publicationId ?? 'none'}{r.publishedAt ? ` · ${new Date(r.publishedAt).toLocaleString()}` : ''}</p>
    {r.publicationId && <button type="button" className="gw-chip" data-testid={`button-evidence-${sourceId}`} onClick={() => onEvidence(r)}>Inspect evidence</button>}
  </div>;
}

export function SourceOverview({ catalog, period, onEvidence, onSelect, onReport }: {
  period: ReportPeriod; onEvidence: (r: MetricResult) => void;
  catalog?: GoodwillCatalog; onSelect: (sourceId: string) => void; onReport: (sourceId: string) => void;
}) {
  const overview = useSystemOverview();
  const supporting = catalog?.datasets.filter(d => !BUSINESS_ROLES.includes(d.role)) ?? [];
  return <div className="gw-stack">
    <Panel title="All nine business sources" description={`Each card is source-local. The figure is for the applied period ${period.startDate} – ${period.endDate}, all stores; accepted rows, batches and publications below are all-time metadata from the current publication. There is deliberately no combined total across sources.`}>
      {overview.isPending && <Skeleton rows={9} />}
      {overview.isError && <Notice kind="error" onRetry={() => void overview.refetch()}>{errorMessage(overview.error)}</Notice>}
      {overview.data && <>
        <ul className="gw-source-grid" data-testid="list-sources">
          {overview.data.sources.map(s => <li key={s.sourceId} className="gw-source-card" data-testid={`card-source-${s.sourceId}`}>
            <div className="gw-source-top"><h3>{s.label}</h3><StatusTag value={s.status} /></div>
            <p className="gw-meta">{s.sourceId}</p>
            <SourceFigure sourceId={s.sourceId} period={period} onEvidence={onEvidence} />
            <p className="gw-meta">All-time metadata</p>
            <dl className="gw-source-stats">
              <div><dt>Accepted rows</dt><dd data-testid={`text-accepted-${s.sourceId}`}>{n(s.acceptedRows)}</dd></div>
              <div><dt>Batches</dt><dd>{n(s.batchCount)}</dd></div>
              <div><dt>Publications</dt><dd>{n(s.publicationCount)}</dd></div>
              <div><dt>Datasets</dt><dd>{n(s.datasetCount)}</dd></div>
            </dl>
            <div className="gw-actions">
              <button type="button" className="gw-button" data-testid={`button-report-${s.sourceId}`} onClick={() => onReport(s.sourceId)}>Open report</button>
              <button type="button" className="gw-button gw-button-secondary" data-testid={`button-lineage-${s.sourceId}`} onClick={() => onSelect(s.sourceId)}>Trace batches incl. rejected</button>
            </div>
          </li>)}
        </ul>
        {overview.data.sources.length !== 9 && <Notice kind="warning">Backend returned {overview.data.sources.length} business sources; nine are required. Missing sources are an acceptance failure, not omitted silently.</Notice>}
      </>}
    </Panel>
    <Panel title="Six supporting datasets" description="Stores, listing events, inventory snapshots, item catalog, quality exceptions and order lifecycle. They support metrics; they are not additional sales sources.">
      {!catalog ? <Skeleton rows={3} /> : <DataTable caption="Supporting dataset roles" headers={['Dataset', 'Role', 'Grain', 'Coverage']}>
        {supporting.map(d => <tr key={d.id}><td>{d.id}<br /><span className="gw-meta">{d.sourceId}</span></td><td>{d.role}</td><td>{d.grain}</td><td><StatusTag value={d.coverage.status} /></td></tr>)}
      </DataTable>}
    </Panel>
  </div>;
}

function Tables({ data }: { data: GoodwillSystemOverview }) {
  return <DataTable caption={`${data.database.engine} tables, counts verified ${new Date(data.database.verifiedAt).toLocaleString()}`} headers={['Table', 'Rows']}>
    {data.database.tables.map(t => <tr key={t.name} data-testid={`row-table-${t.name}`}><td><code>{t.name}</code></td><td className="gw-num">{n(t.rowCount)}</td></tr>)}
  </DataTable>;
}

/** Actual PostgreSQL persistence and batch/publication lineage via existing APIs. */
export function DatabaseView({ sourceId, onSource, batchId, onBatch }: {
  sourceId: string; onSource: (id: string) => void; batchId: string | null; onBatch: (id: string | null) => void;
}) {
  const overview = useSystemOverview();
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const batches = useQuery({
    queryKey: ['goodwill-reporting', 'lineage-batches', sourceId, offset],
    queryFn: ({ signal }) => listGoodwillBatches({ offset, limit, sourceId }, { signal }), retry: false,
  });
  return <div className="gw-stack">
    <Panel title="PostgreSQL database" description="Live read-only row counts from the running database. These are the actual tables; there is no separate warehouse or relational fact schema.">
      {overview.isPending && <Skeleton rows={6} />}
      {overview.isError && <Notice kind="error" onRetry={() => void overview.refetch()}>{errorMessage(overview.error)}</Notice>}
      {overview.data && <div className="gw-split">
        <Tables data={overview.data} />
        <div className="gw-stack gw-explain">
          <h3>How records are stored</h3>
          <p>Rows are PostgreSQL tables whose identifiers, state and timestamps are columns, with source values, normalized fields and reasons held in JSONB metadata.</p>
          <p>Primary keys and uniqueness are database-enforced. Links between run, artifact, batch, record and publication are carried as identifiers and maintained by application code; they should not be read as complete foreign-key constraints.</p>
          <p>Original file bytes: {overview.data.storage.originalBytesInDatabase ? 'stored in the database' : 'not stored in PostgreSQL'}. Storage kind: <code>{overview.data.storage.kind}</code>; the database keeps references and checksums only. No signed URLs or credentials are shown.</p>
          <p className="gw-meta">Query mode: {overview.data.queryMode}</p>
        </div>
      </div>}
    </Panel>
    <Panel title="Batch and publication lineage" description="Choose a business source, then a batch (including rejected or duplicate batches) to see archive metadata, accepted/rejected rows with reasons, and the publication it feeds. Rejected batches never replace the last-good publication.">
      <div className="gw-actions">
        <label className="gw-field">Source<select data-testid="select-lineage-source" value={sourceId} onChange={e => { onSource(e.target.value); setOffset(0); onBatch(null); }}>
          {(overview.data?.sources ?? [{ sourceId, label: sourceId }]).map(s => <option key={s.sourceId} value={s.sourceId}>{s.label}</option>)}
        </select></label>
      </div>
      {batches.isPending && <Skeleton rows={4} />}
      {batches.isError && <Notice kind="error" onRetry={() => void batches.refetch()}>{errorMessage(batches.error)}</Notice>}
      {batches.data && <>
        <DataTable caption={`${batches.data.total} batches for ${sourceId}`} headers={['Batch', 'Period', 'State', '']}>
          {batches.data.items.map(b => <tr key={b.id} aria-selected={b.id === batchId}>
            <td><code>{b.id}</code></td><td>{b.period.startDate} – {b.period.endDate}</td><td><StatusTag value={b.state} /></td>
            <td><button type="button" className="gw-button gw-button-secondary" data-testid={`button-batch-${b.id}`} onClick={() => onBatch(b.id)}>{b.id === batchId ? 'Selected' : 'Inspect lineage'}</button></td>
          </tr>)}
          {!batches.data.items.length && <tr><td colSpan={4}>No batches imported for this source yet. Acquire or upload a file from Operations.</td></tr>}
        </DataTable>
        <div className="gw-actions">
          <button className="gw-button gw-button-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
          <button className="gw-button gw-button-secondary" disabled={offset + limit >= batches.data.total} onClick={() => setOffset(offset + limit)}>Next</button>
        </div>
      </>}
    </Panel>
    {batchId && <BatchDetail key={batchId} batchId={batchId} />}
  </div>;
}
