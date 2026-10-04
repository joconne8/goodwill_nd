import { useEffect, useState } from 'react';
import { useGetGoodwillCatalog, getGetGoodwillCatalogQueryKey, type MetricQuery, type MetricResult, type ReportPeriod } from '@workspace/api-client-react';
import { Coverage, MetricView } from './MetricView';
import { EvidenceView } from './EvidenceView';
import { OperationsView } from './OperationsView';
import { AssistantPanel } from './AssistantPanel';
import { DatabaseView, SourceOverview } from './SystemView';
import { ReportingShell, type Page } from './ReportingShell';
import { errorMessage, validatePeriod } from './model';
import { DataTable, Notice, Panel, StatusTag } from './ui';

const PAGES: Page[] = ['overview', 'database', 'operations', 'reporting', 'listings', 'backlog', 'evidence', 'definitions'];
function hashPage(): Page {
  const value = window.location.hash.slice(1);
  return PAGES.includes(value as Page) ? value as Page : 'overview';
}

/**
 * Lead-owned shell integration mounts this under its QueryClientProvider.
 * All data is from generated API clients; this module never imports fixtures.
 */
export function ReportingApp({ legacyHref = import.meta.env.BASE_URL, acquisitionHref = `${import.meta.env.BASE_URL}acquisition` }: { legacyHref?: string; acquisitionHref?: string }) {
  const [page, setPage] = useState<Page>(hashPage);
  const [period, setPeriod] = useState<ReportPeriod>({ startDate: '2026-08-01', endDate: '2026-08-31' });
  const [draft, setDraft] = useState(period);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [sourceId, setSource] = useState('upright');
  const [storeId, setStore] = useState('');
  const [financialId, setFinancial] = useState<MetricQuery['metricId']>('net_item_sales');
  const [groupBy, setGroup] = useState<MetricQuery['groupBy']>('day');
  const [snapshotDraft, setSnapshotDraft] = useState('');
  const [snapshotAt, setSnapshot] = useState('');
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [lineageSource, setLineageSource] = useState('upright');
  const [batchId, setBatch] = useState<string | null>(null);
  const [selectedEvidence, setEvidence] = useState<MetricResult | null>(null);
  const catalog = useGetGoodwillCatalog({ query: { queryKey: getGetGoodwillCatalogQueryKey(), retry: false, staleTime: 0, refetchInterval: 30_000 } });

  useEffect(() => {
    const onHash = () => setPage(hashPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { document.title = `${page[0].toUpperCase()}${page.slice(1)} | Goodwill Reporting — synthetic`; }, [page]);
  const navigate = (next: Page) => { window.location.hash = next; setPage(next); };
  const inspect = (result: MetricResult) => { setEvidence(result); navigate('evidence'); };
  const openBatch = (id: string) => { setBatch(id); navigate('database'); };
  const businessSources = Array.from(new Set(catalog.data?.datasets.filter(d => ['sales', 'expense', 'statement'].includes(d.role)).map(d => d.sourceId)));
  const supported = Array.from(new Set(catalog.data?.datasets.filter(d => d.sourceId === sourceId).flatMap(d => d.supportedMetrics)))
    .filter(id => ['net_item_sales', 'source_net', 'shipping_expense'].includes(id)) as MetricQuery['metricId'][];
  const metricId = supported.includes(financialId) ? financialId : supported[0] ?? financialId;
  const query: MetricQuery = { sourceId, metricId, period, groupBy, ...(storeId ? { storeId } : {}) };
  const operationSource = ['ebay', 'shopgoodwill'].includes(sourceId) ? sourceId : null;
  return <ReportingShell page={page} onPageChange={navigate} legacyHref={legacyHref} acquisitionHref={acquisitionHref}>
    <Panel title="Reporting scope" description="Inclusive Eastern dates. Each figure uses one source or platform. Source-local results must not be combined.">
      <form className="gw-actions" onSubmit={e => {
        e.preventDefault(); const error = validatePeriod(draft); setPeriodError(error);
        if (!error) { setPeriod({ ...draft }); setSnapshot(''); }
      }}>
        <label className="gw-field">Start date<input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label>
        <label className="gw-field">End date<input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} /></label>
        <button className="gw-button gw-button-secondary" type="submit">Apply reporting dates</button>
      </form>
      {periodError && <Notice kind="error">{periodError} The applied scope is unchanged.</Notice>}
      <p className="gw-meta">Applied: {period.startDate} – {period.endDate} · America/New_York</p>
      {!['operations', 'definitions', 'evidence', 'overview', 'database'].includes(page) && <div className="gw-actions">
        <label className="gw-field">Source / platform<select aria-label="Source / platform" value={sourceId} disabled={!catalog.data} onChange={e => setSource(e.target.value)}>
          {!businessSources.length && <option value={sourceId}>{sourceId} — catalog unavailable</option>}
          {businessSources.map(source => <option key={source}>{source}</option>)}
        </select></label>
        <label className="gw-field">Store attribution<select aria-label="Store attribution" value={storeId} disabled={!catalog.data} onChange={e => setStore(e.target.value)}>
          <option value="">All stores within this source</option><option value="__unknown__">Unknown / unresolved attribution</option>
          {catalog.data?.stores.map(store => <option key={store.id} value={store.id}>{store.id} · {store.name} · {store.district}</option>)}
        </select></label>
        <label className="gw-field">Breakdown<select aria-label="Breakdown" value={groupBy} onChange={e => setGroup(e.target.value as MetricQuery['groupBy'])}>
          <option value="day">Eastern day</option><option value="store">Store</option><option value="category">Category</option><option value="none">No grouping</option>
        </select></label>
      </div>}
      {catalog.isPending && <Notice kind="info">Loading source definitions and actual coverage…</Notice>}
      {catalog.isError && <Notice kind="error" onRetry={() => void catalog.refetch()}>{errorMessage(catalog.error)}</Notice>}
    </Panel>
    {page === 'overview' && <SourceOverview catalog={catalog.data} period={period} onEvidence={inspect} onReport={id => { setSource(id); setStore(''); navigate('reporting'); }} onSelect={id => { setLineageSource(id); setBatch(null); navigate('database'); }} />}
    {page === 'database' && <DatabaseView sourceId={lineageSource} onSource={setLineageSource} batchId={batchId} onBatch={setBatch} />}
    {page === 'operations' && <>
      <Notice kind="info">Automated retrieval, Jev experiment runs and recipe review live in the <a href={acquisitionHref} data-testid="link-operations-acquisition">Jev acquisition console</a>. Rejected or duplicate batches can be traced under <button type="button" className="gw-linkish" data-testid="link-operations-lineage" onClick={() => navigate('database')}>Database &amp; lineage</button>.</Notice>
      <OperationsView catalog={catalog.data} period={period} />
    </>}
    {page === 'reporting' && <div className="gw-stack">
      <Panel title="Leadership and daily reporting" description="Sales, statements and carrier expense remain separate. No cross-source revenue, margin, labor productivity or sell-through figure is available.">
        <label className="gw-field">Financial definition<select aria-label="Financial definition" value={metricId} disabled={!supported.length} onChange={e => setFinancial(e.target.value as MetricQuery['metricId'])}>
          {(supported.length ? supported : [metricId]).map(id => <option key={id} value={id}>{catalog.data?.metrics.find(m => m.id === id)?.label ?? id}</option>)}
        </select></label>
        <p>Source net retains the source's own payout formula; it is not net item sales. Carrier shipping expense is not revenue or margin. Books use statement month, not payment date; Amazon posted activity is not order-day sales.</p>
      </Panel>
      <MetricView query={query} title="Source-local financial result" onEvidence={inspect} />
      <MetricView query={{ ...query, metricId: 'daily_customers', groupBy: 'day' }} title="Daily platform-local customers" onEvidence={inspect} />
      <AssistantPanel context={query} onEvidence={inspect} onBatch={openBatch} />
    </div>}
    {page === 'listings' && <div className="gw-stack">
      <Notice kind="info">Distinct new-listing events only, not sold item rows or relists. Supporting history includes June/July; choose those dates explicitly to inspect it.</Notice>
      {!operationSource ? <Notice kind="warning">Select ShopGoodwill or eBay. No listing coverage is claimed for this source.</Notice>
        : <MetricView query={{ ...query, metricId: 'listings', sourceId: operationSource }} title="New listings" onEvidence={inspect} />}
    </div>}
    {page === 'backlog' && <div className="gw-stack">
      <Panel title="One selected inventory snapshot" description="Backlog requires the complete declared catalog universe and exactly one snapshot. Never infer it from sales or sum snapshots.">
        <p>Enter the exact timestamp from an imported inventory snapshot (including its offset). The backend checks period, catalog/control universe and completeness; a missing or partial snapshot is unavailable, not zero.</p>
        <form className="gw-stack" onSubmit={e => {
          e.preventDefault();
          const value = snapshotDraft.trim();
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
            setSnapshotError('Enter one ISO timestamp with its source offset, for example YYYY-MM-DDTHH:mm:ss-04:00.'); return;
          }
          setSnapshotError(null); setSnapshot(value);
        }}>
          <label className="gw-field">Snapshot timestamp<input type="text" value={snapshotDraft} onChange={e => setSnapshotDraft(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss-04:00" /></label>
          <button className="gw-button gw-button-secondary" type="submit">Select snapshot</button>
        </form>
        {snapshotError && <Notice kind="error">{snapshotError} The selected snapshot is unchanged.</Notice>}
      </Panel>
      {!operationSource ? <Notice kind="warning">Select ShopGoodwill or eBay. No backlog coverage is claimed for this source.</Notice>
        : <MetricView query={{ ...query, sourceId: operationSource, metricId: 'backlog', ...(snapshotAt ? { snapshotAt } : {}) }} title="Selected-snapshot unlisted backlog" enabled={Boolean(snapshotAt)} onEvidence={inspect} />}
    </div>}
    {page === 'evidence' && <EvidenceView key={`${selectedEvidence?.publicationId}-${JSON.stringify(selectedEvidence?.query)}`} result={selectedEvidence} />}
    {page === 'definitions' && <div className="gw-stack">
      <Panel title="Nine business sources and six supporting datasets" description="Actual backend definitions and coverage, not invented source connections. All input data is synthetic.">
        {catalog.data && <>
          <DataTable caption="Dataset roles, grain and reporting basis" headers={['Dataset / source', 'Report / role', 'Grain / time basis', 'Supported metrics', 'Coverage']}>
            {catalog.data.datasets.map(d => <tr key={d.id}><td>{d.id}<br />{d.sourceId}</td><td>{d.reportType}<br />{d.role}</td><td>{d.grain}<br />{d.timeBasis}<p>Keys: {d.keyFields.join(' + ')}</p></td><td>{d.supportedMetrics.join(', ') || 'Supporting dataset; not a standalone financial KPI'}</td><td><StatusTag value={d.coverage.status} /><p>{d.coverage.reason}</p></td></tr>)}
          </DataTable>
          <Coverage coverage={catalog.data.datasets.map(d => d.coverage)} />
        </>}
      </Panel>
      <Panel title="Metric definitions and limitations" description="Demo conventions, not partner-approved accounting policy. Deterministic backend arithmetic; no AI-calculated financial figures.">
        {catalog.data?.metrics.map(metric => <div key={metric.id}><h3>{metric.label} · {metric.version}</h3><p>{metric.formula}</p><p>{metric.grain} · {metric.timeBasis} · {metric.unit}</p><p>Required: {metric.requiredDatasets.join(', ')}</p><p>Excluded: {metric.exclusions.join('; ') || 'See source definition'}</p>{metric.availabilityReason && <Notice kind="warning">{metric.availabilityReason}</Notice>}</div>)}
        <Notice kind="warning">No real sponsor credentials or customer data, approved production security, Business Central posting, approved AI assistant, human finance sign-off or measured time savings are claimed.</Notice>
      </Panel>
    </div>}
  </ReportingShell>;
}