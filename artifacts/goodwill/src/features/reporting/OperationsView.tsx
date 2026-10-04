import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelGoodwillRun, createGoodwillBatch, downloadGoodwillRun, listGoodwillBatches,
  listGoodwillRuns, requestGoodwillUpload, startGoodwillRun,
  type AcquisitionRequestScenario, type AcquisitionRun, type DatasetDefinition, type GoodwillCatalog, type ImportBatchState, type ReportPeriod,
} from '@workspace/api-client-react';
import { BatchDetail } from './BatchDetail';
import { Pagination } from './EvidenceView';
import { checksum, errorMessage, formatTimestamp, MAX_FILE_BYTES, saveDownload, validatePeriod } from './model';
import { DataTable, Notice, Panel, StatusTag } from './ui';

export function OperationsView({ catalog, period }: { catalog?: GoodwillCatalog; period: ReportPeriod }) {
  const client = useQueryClient();
  const [runOffset, setRunOffset] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const [source, setSource] = useState('');
  const [state, setState] = useState<ImportBatchState | ''>('');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [datasetId, setDatasetId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [scenario, setScenario] = useState<AcquisitionRequestScenario>('success');
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadStep, setUploadStep] = useState('');
  const limit = 20;
  const dataset = catalog?.datasets.find(d => d.id === datasetId) ?? catalog?.datasets[0];
  const runs = useQuery({
    queryKey: ['goodwill-reporting', 'runs', runOffset],
    queryFn: ({ signal }) => listGoodwillRuns({ offset: runOffset, limit }, { signal }),
    refetchInterval: 3000, retry: false,
  });
  const batches = useQuery({
    queryKey: ['goodwill-reporting', 'batches', batchOffset, source, state],
    queryFn: ({ signal }) => listGoodwillBatches({ offset: batchOffset, limit, ...(source ? { sourceId: source } : {}), ...(state ? { state } : {}) }, { signal }),
    refetchInterval: 15_000, retry: false,
  });
  const refresh = async () => {
    await client.invalidateQueries({ predicate: q => q.queryKey[0] === 'goodwill-reporting' || q.queryKey[0] === '/api/goodwill/v2/catalog' });
  };
  const acquisition = useMutation({
    mutationFn: (retry?: AcquisitionRun) => {
      const selectedPeriod = retry?.request.period ?? period;
      const error = validatePeriod(selectedPeriod);
      if (error) throw new Error(error);
      return startGoodwillRun({ sourceId: 'upright', reportType: 'paid_order_items', period: selectedPeriod, scenario: retry?.request.scenario ?? scenario, ...(retry ? { retryOf: retry.id } : {}) });
    }, onSuccess: refresh, retry: false,
  });
  const cancel = useMutation({ mutationFn: (runId: string) => cancelGoodwillRun(runId), onSuccess: refresh, retry: false });
  const acquiredImport = useMutation({
    mutationFn: (run: AcquisitionRun) => createGoodwillBatch({ sourceId: run.request.sourceId, reportType: run.request.reportType, period: run.request.period, inputKind: 'run', inputId: run.id }),
    onSuccess: async batch => { setSelectedBatch(batch.id); setBatchOffset(0); await refresh(); }, retry: false,
  });
  const original = useMutation({
    mutationFn: async (run: AcquisitionRun) => {
      const blob = await downloadGoodwillRun(run.id);
      if (!(blob instanceof Blob)) throw new Error('The download did not return a binary attachment.');
      saveDownload(blob, run.artifact?.filename ?? `synthetic-${run.id}.csv`);
    }, retry: false,
  });
  const upload = useMutation({
    mutationFn: async (input: { file: File; dataset: DatasetDefinition; period: ReportPeriod }) => {
      const invalid = validatePeriod(input.period);
      if (invalid) throw new Error(invalid);
      if (!input.file.size || input.file.size > MAX_FILE_BYTES) throw new Error('Choose a nonempty CSV no larger than 5 MiB.');
      setUploadStep('Hashing original bytes');
      const bytes = await input.file.arrayBuffer();
      const hash = await checksum(bytes);
      const ticket = await requestGoodwillUpload({
        sourceId: input.dataset.sourceId, reportType: input.dataset.reportType,
        filename: input.file.name, byteSize: bytes.byteLength, checksum: hash,
      });
      setUploadStep('Uploading original bytes to private storage');
      // The capability is transient. Never place it in state, logs or lineage.
      const response = await fetch(ticket.uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'application/octet-stream' }, credentials: 'omit' });
      if (!response.ok) throw new Error(`Private-storage PUT failed (${response.status}). No intake requested.`);
      setUploadStep('Verifying and importing server-owned artifact');
      return createGoodwillBatch({ sourceId: input.dataset.sourceId, reportType: input.dataset.reportType, period: input.period, inputKind: 'upload', inputId: ticket.uploadId });
    },
    onSuccess: async batch => {
      setSelectedBatch(batch.id); setBatchOffset(0); setFile(null); setConfirmed(false);
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
    },
    onSettled: () => setUploadStep(''), retry: false,
  });
  return <div className="gw-stack">
    <Panel title="Simulated Upright acquisition" description="Only the Upright-style replica is automated. Verification establishes file integrity, not accepted financial publication.">
      <p>Adapted paid-order-item / Eastern-date workflow; not the live order-level / Pacific-date vendor form.</p>
      <p>Requested interval: {period.startDate} – {period.endDate}</p>
      <label className="gw-field">Replica scenario<select aria-label="Replica scenario" value={scenario} disabled={acquisition.isPending} onChange={e => setScenario(e.target.value as AcquisitionRequestScenario)}>{['success', 'delayed', 'session_expired', 'dom_drift', 'missing_report'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></label>
      <button className="gw-button" disabled={acquisition.isPending || Boolean(validatePeriod(period))} onClick={() => acquisition.mutate(undefined)}>{acquisition.isPending ? 'Starting…' : 'Acquire simulated report'}</button>
      {acquisition.isSuccess && <Notice kind="success">Run {acquisition.data.id} recorded as {acquisition.data.state}. Nothing has been imported yet.</Notice>}
      {[acquisition, cancel, acquiredImport, original].map((m, i) => m.isError && <Notice kind="error" key={i}>{errorMessage(m.error)}</Notice>)}
      {acquiredImport.isSuccess && <Notice kind={['failed', 'quarantined'].includes(acquiredImport.data.state) ? 'warning' : 'info'}>Intake attempt {acquiredImport.data.id}: {acquiredImport.data.state}. Inspect batch detail below.</Notice>}
      {runs.isPending ? <Notice kind="info">Loading persistent run history…</Notice>
        : runs.isError ? <Notice kind="error" onRetry={() => void runs.refetch()}>{errorMessage(runs.error)}</Notice>
          : runs.data && <>
            <DataTable caption="Acquisition history (server records)" headers={['Run / attempt', 'Period / scenario', 'State / last step', 'Last update / provenance', 'Actions']}>
              {runs.data.items.map(run => <tr key={run.id}>
                <td>{run.id}<br />Attempt {run.attempt}{run.request.retryOf && <p>Retry of {run.request.retryOf}</p>}</td>
                <td>{run.request.period.startDate} – {run.request.period.endDate}<br />{run.request.scenario}</td>
                <td><StatusTag value={run.state} /><p>{run.lastStep}</p>{run.failure && <p>{run.failure.code}: {run.failure.message}<br />Next: {run.failure.nextAction}</p>}</td>
                <td>{formatTimestamp(run.updatedAt)}{run.artifact && <p className="gw-meta">{run.artifact.filename} · {run.artifact.byteSize} bytes<br />Artifact {run.artifact.artifactId}<br />SHA256 {run.artifact.checksum}</p>}</td>
                <td><div className="gw-actions">
                  {['queued', 'running', 'downloaded'].includes(run.state) && <button className="gw-button gw-button-secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(run.id)}>Cancel run</button>}
                  {run.state === 'failed' && run.attempt < 2 && run.failure?.retryable && <button className="gw-button gw-button-secondary" disabled={acquisition.isPending} onClick={() => acquisition.mutate(run)}>Retry once</button>}
                  {run.state === 'verified' && <><button className="gw-button gw-button-secondary" disabled={original.isPending} onClick={() => original.mutate(run)}>Download original</button><button className="gw-button" disabled={acquiredImport.isPending} onClick={() => acquiredImport.mutate(run)}>Import verified run</button></>}
                </div></td>
              </tr>)}
              {!runs.data.items.length && <tr><td colSpan={5}>No acquisition attempts recorded.</td></tr>}
            </DataTable>
            <Pagination offset={runOffset} total={runs.data.total} limit={limit} busy={runs.isFetching} onOffset={setRunOffset} />
          </>}
    </Panel>
    <Panel title="Common manual intake — all 15 datasets" description="Select the declared source/report identity. The server verifies the original bytes and uses the same parser and publication controls as acquired reports.">
      <p>Requested interval: {period.startDate} – {period.endDate}. Other sources use manual synthetic exports only; none is a live connector.</p>
      <label className="gw-field">Dataset<select aria-label="Dataset" disabled={!catalog || upload.isPending} value={dataset?.id ?? ''} onChange={e => setDatasetId(e.target.value)}>{catalog?.datasets.map(d => <option key={d.id} value={d.id}>{d.sourceId} / {d.reportType} ({d.role})</option>)}</select></label>
      {dataset && <p>{dataset.grain} · {dataset.timeBasis} · expected file {dataset.filename}</p>}
      <label className="gw-field">Original synthetic CSV (maximum 5 MiB)<input ref={fileInput} type="file" accept=".csv,text/csv" disabled={upload.isPending} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <label><input type="checkbox" disabled={upload.isPending} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I confirm this file contains synthetic data only.</label>
      <button className="gw-button" disabled={!dataset || !file || !confirmed || upload.isPending || Boolean(validatePeriod(period))} onClick={() => { if (file && dataset) upload.mutate({ file, dataset, period: { ...period } }); }}>{upload.isPending ? 'Importing…' : 'Upload and import original'}</button>
      {uploadStep && <p role="status">{uploadStep}</p>}
      {upload.isError && <Notice kind="error">{errorMessage(upload.error)} A retry requests a new ticket; no bundled file is substituted.</Notice>}
      {upload.isSuccess && <Notice kind={['failed', 'quarantined'].includes(upload.data.state) ? 'warning' : 'info'}>Server recorded {upload.data.id} as {upload.data.state}. The detailed result is below.</Notice>}
    </Panel>
    <Panel title="Import history" description="Every attempt remains visible, including failures, rejected rows, duplicates and superseded records.">
      <div className="gw-actions">
        <label className="gw-field">History source<select aria-label="History source" value={source} onChange={e => { setSource(e.target.value); setBatchOffset(0); }}><option value="">All sources — history only, not a financial total</option>{Array.from(new Set(catalog?.datasets.map(d => d.sourceId))).map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="gw-field">Batch state<select aria-label="Batch state" value={state} onChange={e => { setState(e.target.value as ImportBatchState | ''); setBatchOffset(0); }}><option value="">All states</option>{['received', 'validated', 'reconciled', 'published', 'partial', 'duplicate', 'quarantined', 'failed', 'superseded'].map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      {batches.isPending ? <Notice kind="info">Loading persistent batch history…</Notice>
        : batches.isError ? <Notice kind="error" onRetry={() => void batches.refetch()}>{errorMessage(batches.error)}</Notice>
          : batches.data && <>
            <DataTable caption="Common intake attempts; row counts are not financial or customer totals" headers={['Batch / source / period', 'State', 'Rows: input / accepted / rejected / duplicate', 'Publication / time', 'Detail']}>
              {batches.data.items.map(batch => <tr key={batch.id}><td>{batch.id}<p>{batch.sourceId} / {batch.reportType}<br />{batch.period.startDate} – {batch.period.endDate}</p></td><td><StatusTag value={batch.state} />{batch.failure && <p>{batch.failure.code}: {batch.failure.message}</p>}</td><td>{batch.inputRows} / {batch.acceptedRows} / {batch.rejectedRows} / {batch.duplicateRows}</td><td className="gw-meta">{batch.publicationId ?? 'Not published'}<br />{formatTimestamp(batch.receivedAt)}{batch.duplicateOf && <p>Duplicate of {batch.duplicateOf}</p>}</td><td><button className="gw-button gw-button-secondary" onClick={() => setSelectedBatch(batch.id)}>Inspect batch</button></td></tr>)}
              {!batches.data.items.length && <tr><td colSpan={5}>No attempts match these history filters.</td></tr>}
            </DataTable>
            <Pagination offset={batchOffset} total={batches.data.total} limit={limit} busy={batches.isFetching} onOffset={setBatchOffset} />
          </>}
    </Panel>
    {selectedBatch && <BatchDetail key={selectedBatch} batchId={selectedBatch} />}
  </div>;
}