import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExperimentReview, type ExperimentalAcquisitionAdapter } from './ExperimentReview';
import {
  useListGoodwillRuns, useStartGoodwillRun, useCancelGoodwillRun, downloadGoodwillRun,
  useRequestGoodwillUpload, useCreateGoodwillBatch, useGetGoodwillCatalog, useGetGoodwillSources,
  getListGoodwillRunsQueryKey, getListGoodwillBatchesQueryKey,
  AcquisitionRequestScenario,
  type AcquisitionRun, type ImportBatch,
} from '@workspace/api-client-react';

const btn = 'px-3 py-1.5 text-sm font-medium border border-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:translate-y-px bg-card';
const mono = 'font-mono text-[12px] break-all';
const field = 'mt-1 w-full border border-input bg-background px-2 py-2 text-sm';

function errMsg(e: unknown): string {
  const x = e as { data?: { error?: string; code?: string }; message?: string };
  if (x?.data?.error) return `${x.data.error}${x.data.code ? ` (${x.data.code})` : ''}`;
  return x?.message ?? 'Request failed';
}
async function sha256(bytes: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const Note = ({ kind, children, id }: { kind: 'ok' | 'err'; children: React.ReactNode; id: string }) => (
  <p role="status" data-testid={id} className={`border-l-4 px-3 py-2 text-sm ${kind === 'ok' ? 'border-primary bg-primary/10' : 'border-destructive bg-destructive/10'}`}>{children}</p>
);

export function AcquisitionConsole({ experiment }: { experiment?: ExperimentalAcquisitionAdapter } = {}) {
  const qc = useQueryClient();
  const [startDate, setStart] = useState('2026-08-01');
  const [endDate, setEnd] = useState('2026-08-31');
  const [scenario, setScenario] = useState<AcquisitionRequestScenario>('success');
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [intakeNote, setIntakeNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  const runs = useListGoodwillRuns({ limit: 50 }, { query: { queryKey: getListGoodwillRunsQueryKey({ limit: 50 }), refetchInterval: 3000 } });
  const sources = useGetGoodwillSources();
  const catalog = useGetGoodwillCatalog();
  const start = useStartGoodwillRun();
  const cancel = useCancelGoodwillRun();
  const reqUpload = useRequestGoodwillUpload();
  const createBatch = useCreateGoodwillBatch();

  const refresh = () => { qc.invalidateQueries({ queryKey: getListGoodwillRunsQueryKey({ limit: 50 }) }); };
  const dateErr = !startDate || !endDate ? 'Both dates required.' : startDate > endDate ? 'Start must not be after end.' : null;

  const begin = (retryOf?: string) => {
    setNote(null);
    const original = retryOf ? runs.data?.items.find(r => r.id === retryOf) : undefined;
    start.mutate(
      { data: { sourceId: 'upright', reportType: 'paid_order_items', period: original?.request.period ?? { startDate, endDate }, scenario, ...(retryOf ? { retryOf } : {}) } },
      { onSuccess: (r) => { setNote({ kind: 'ok', text: `Run ${r.id} accepted (${r.state}). Acquisition only; nothing is published.` }); refresh(); },
        onError: (e) => setNote({ kind: 'err', text: errMsg(e) }) },
    );
  };

  const doCancel = (id: string) => cancel.mutate({ runId: id }, { onSuccess: refresh, onError: (e) => setNote({ kind: 'err', text: errMsg(e) }) });

  const doDownload = async (r: AcquisitionRun) => {
    if (!r.artifact) return;
    try {
      const blob = await downloadGoodwillRun(r.id);
      if (!(blob instanceof Blob)) throw new Error('Download response was not the contracted binary file.');
      const bytes = await blob.arrayBuffer();
      if (bytes.byteLength !== r.artifact.byteSize || await sha256(bytes) !== r.artifact.checksum)
        throw new Error('Download identity differs from the verified run artifact. No file was delivered.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = r.artifact.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote({ kind: 'ok', text: `Download requested for ${r.artifact.filename}. This is not publication.` });
    } catch (e) { setNote({ kind: 'err', text: errMsg(e) }); }
  };

  const intakeRun = (r: AcquisitionRun) => {
    setIntakeNote(null);
    createBatch.mutate(
      { data: { sourceId: r.request.sourceId, reportType: r.request.reportType, period: r.request.period, inputKind: 'run', inputId: r.id } },
      { onSuccess: (b) => { setBatches((x) => [b, ...x]); setIntakeNote({ kind: 'ok', text: `Batch ${b.id} created from run ${r.id}: state ${b.state}.` }); qc.invalidateQueries({ queryKey: getListGoodwillBatchesQueryKey() }); qc.invalidateQueries({ queryKey: ['goodwill-reporting'] }); },
        onError: (e) => setIntakeNote({ kind: 'err', text: errMsg(e) }) },
    );
  };

  // manual fallback
  const datasets = catalog.data?.datasets ?? [];
  const [dsId, setDsId] = useState('');
  const ds = useMemo(() => datasets.find((d) => d.id === dsId), [datasets, dsId]);
  const [mStart, setMStart] = useState('2026-08-01');
  const [mEnd, setMEnd] = useState('2026-08-31');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const manual = async () => {
    if (!ds || !file) return;
    setIntakeNote(null);
    try {
      if (!mStart || !mEnd || mStart > mEnd) throw new Error('Provide both dates in chronological order.');
      if (!/\.csv$/i.test(file.name)) throw new Error('Only approved source-specific CSV files are supported. XLSX, PDFs and other formats require a reviewed adapter.');
      if (file.size === 0) throw new Error('File is empty.');
      if (file.size > 5242880) throw new Error('File exceeds the 5 MiB upload limit.');
      setStep('Hashing file bytes');
      const bytes = await file.arrayBuffer();
      const checksum = await sha256(bytes);
      setStep('Requesting upload ticket');
      const ticket = await reqUpload.mutateAsync({ data: { sourceId: ds.sourceId, reportType: ds.reportType, filename: file.name, byteSize: bytes.byteLength, checksum } });
      setStep('Uploading exact bytes (PUT)');
      const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
      if (!put.ok) throw new Error(`Upload PUT failed (HTTP ${put.status}). No batch created.`);
      setStep('Creating intake batch');
      const b = await createBatch.mutateAsync({ data: { sourceId: ds.sourceId, reportType: ds.reportType, period: { startDate: mStart, endDate: mEnd }, inputKind: 'upload', inputId: ticket.uploadId } });
      setBatches((x) => [b, ...x]);
      setIntakeNote({ kind: 'ok', text: `Batch ${b.id} created from upload ${ticket.uploadId}: state ${b.state}.` });
      qc.invalidateQueries({ queryKey: getListGoodwillBatchesQueryKey() }); qc.invalidateQueries({ queryKey: ['goodwill-reporting'] });
      setFile(null); if (fileRef.current) fileRef.current.value = '';
    } catch (e) { setIntakeNote({ kind: 'err', text: errMsg(e) }); }
    finally { setStep(null); }
  };

  const items = runs.data?.items ?? [];
  const retryCount = (id: string) => {
    const byId = new Map(items.map((x) => [x.id, x]));
    const root = (x: AcquisitionRun): string => { let c = x; let g = 0; while (c.request.retryOf && byId.has(c.request.retryOf) && g++ < 10) c = byId.get(c.request.retryOf)!; return c.id; };
    const target = byId.get(id); if (!target) return 0;
    const r = root(target);
    return items.filter((x) => x.request.retryOf && root(x) === r).length;
  };
  const when = (s: string) => new Date(s).toLocaleString();

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b-2 border-foreground">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Acquisition console</p>
          <h1 className="mt-2 font-serif text-4xl md:text-6xl leading-[0.95]">Acquire, then intake</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">A downloaded or verified file is not published data. Publication only follows a separate batch intake. No metrics are shown here.</p>
          <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px] uppercase">
            {['Synthetic', 'Paid item grain', 'Eastern time', 'Download is not publish'].map((t) => <span key={t} className="border border-accent bg-accent/20 px-2 py-1">{t}</span>)}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 space-y-12">
        <section aria-labelledby="a1" className="space-y-4">
          <h2 id="a1" className="font-serif text-3xl">Start a run</h2>
          <div className="border border-foreground/70 bg-card p-5 grid gap-3 md:grid-cols-4 items-end">
            <label className="text-xs font-mono uppercase">Start<input type="date" className={field} value={startDate} onChange={(e) => setStart(e.target.value)} data-testid="input-run-start" /></label>
            <label className="text-xs font-mono uppercase">End<input type="date" className={field} value={endDate} onChange={(e) => setEnd(e.target.value)} data-testid="input-run-end" /></label>
            <label className="text-xs font-mono uppercase">Scenario
              <select className={field} value={scenario} onChange={(e) => setScenario(e.target.value as AcquisitionRequestScenario)} data-testid="select-run-scenario">
                {Object.values(AcquisitionRequestScenario).map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <button className={`${btn} bg-primary text-primary-foreground`} disabled={!!dateErr || start.isPending} onClick={() => begin()} data-testid="button-start-run">{start.isPending ? 'Starting...' : 'Start deterministic run'}</button>
          </div>
          <p className="text-xs text-muted-foreground">Source upright, report paid_order_items. Retry is explicit and only offered on failed or cancelled runs.</p>
          {dateErr && <Note kind="err" id="status-run-date">{dateErr}</Note>}
          {note && <Note kind={note.kind} id="status-run">{note.text}</Note>}
        </section>

        <ExperimentReview adapter={experiment} period={{ startDate, endDate }} verifiedRunIds={items.filter(r => r.state === 'verified').map(r => r.id)} onRun={refresh} />

        <section aria-labelledby="a2" className="space-y-3">
          <h2 id="a2" className="font-serif text-3xl">Run history</h2>
          {runs.isLoading ? <div className="h-32 animate-pulse bg-muted" /> : runs.isError ? (
            <div className="border border-destructive bg-destructive/10 p-4 text-sm">Could not load runs: {errMsg(runs.error)} <button className="underline" onClick={() => runs.refetch()} data-testid="button-retry-runs">Retry</button></div>
          ) : items.length === 0 ? (
            <div className="border-2 border-dashed border-foreground/40 p-8 text-center"><p className="font-serif text-2xl">No runs yet</p><p className="text-sm text-muted-foreground">Start a run above. Polling every 3 seconds.</p></div>
          ) : (
            <ul className="space-y-3">
              {items.map((r) => (
                <li key={r.id} className="border border-foreground/70 bg-card p-4 space-y-2" data-testid={`row-run-${r.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={mono}>{r.id}</span>
                    <span className={`border px-2 py-0.5 font-mono text-[11px] uppercase ${r.state === 'failed' || r.state === 'cancelled' ? 'border-destructive bg-destructive/10' : r.state === 'verified' || r.state === 'downloaded' ? 'border-primary bg-primary/10' : 'border-foreground/40'}`} data-testid={`state-run-${r.id}`}>{r.state}</span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Request</dt><dd className={mono}>{r.request.sourceId} / {r.request.reportType} / {r.request.period.startDate} to {r.request.period.endDate} / {r.request.scenario}{r.request.retryOf ? ` / retry of ${r.request.retryOf}` : ''}</dd>
                    <dt className="text-muted-foreground">Last step</dt><dd className={mono}>{r.lastStep} (attempt {r.attempt})</dd>
                    <dt className="text-muted-foreground">Created / updated</dt><dd className={mono}>{when(r.createdAt)} / {when(r.updatedAt)}</dd>
                    {r.artifact && (<><dt className="text-muted-foreground">Artifact</dt><dd className={mono}>{r.artifact.filename}, {r.artifact.byteSize} bytes, sha256 {r.artifact.checksum}, archived {when(r.artifact.archivedAt)}</dd></>)}
                  </dl>
                  {r.failure && (
                    <div className="border-l-4 border-destructive bg-destructive/10 px-3 py-2 text-sm" data-testid={`failure-run-${r.id}`}>
                      <p><span className="font-mono text-xs">{r.failure.code}</span> {r.failure.message}</p>
                      <p>Next action: {r.failure.nextAction}. {r.failure.retryable ? 'Retryable.' : 'Not retryable.'}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(r.state === 'queued' || r.state === 'running' || r.state === 'downloaded') && <button className={btn} onClick={() => doCancel(r.id)} disabled={cancel.isPending} data-testid={`button-cancel-${r.id}`}>Cancel</button>}
                    {(r.state === 'failed' || r.state === 'cancelled') && <button className={btn} onClick={() => begin(r.id)} disabled={start.isPending || r.attempt >= 2 || retryCount(r.id) >= 1} title={r.attempt >= 2 || retryCount(r.id) >= 1 ? 'One retry maximum (two attempts total)' : undefined} data-testid={`button-retry-${r.id}`}>{r.attempt >= 2 || retryCount(r.id) >= 1 ? 'Retry limit reached' : 'Retry'}</button>}
                    {r.artifact && <button className={btn} onClick={() => doDownload(r)} data-testid={`button-download-${r.id}`}>Download (not publish)</button>}
                    {r.state === 'verified' && <button className={`${btn} bg-primary text-primary-foreground`} onClick={() => intakeRun(r)} disabled={createBatch.isPending} data-testid={`button-intake-${r.id}`}>Create intake batch</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="a3" className="space-y-3">
          <h2 id="a3" className="font-serif text-3xl">Manual fallback: ticket, PUT, intake</h2>
          <p className="text-sm text-muted-foreground">Choose a catalog report, then a file. Its real bytes are hashed, uploaded with a ticket, and handed to batch intake. The console does not parse or sniff the file.</p>
          {catalog.isError ? <div className="border border-destructive bg-destructive/10 p-4 text-sm">Catalog unavailable: {errMsg(catalog.error)} <button className="underline" onClick={() => catalog.refetch()}>Retry</button></div> : (
            <div className="border border-foreground/70 bg-card p-5 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-mono uppercase md:col-span-2">Catalog report
                <select className={field} value={dsId} onChange={(e) => setDsId(e.target.value)} data-testid="select-manual-dataset">
                  <option value="">{catalog.isLoading ? 'Loading catalog...' : 'Select a report'}</option>
                  {datasets.map((d) => <option key={d.id} value={d.id}>{d.sourceId} / {d.reportType} ({d.filename})</option>)}
                </select></label>
              <label className="text-xs font-mono uppercase">Start<input type="date" className={field} value={mStart} onChange={(e) => setMStart(e.target.value)} data-testid="input-manual-start" /></label>
              <label className="text-xs font-mono uppercase">End<input type="date" className={field} value={mEnd} onChange={(e) => setMEnd(e.target.value)} data-testid="input-manual-end" /></label>
              <label className="text-xs font-mono uppercase md:col-span-2">File
                <input ref={fileRef} type="file" accept=".csv,text/csv" disabled={!!step} className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="input-manual-file" /></label>
              <div className="md:col-span-2 flex items-center gap-3">
                <button className={`${btn} bg-primary text-primary-foreground`} disabled={!ds || !file || !!step} onClick={manual} data-testid="button-manual-submit">{step ?? 'Upload and create batch'}</button>
              </div>
            </div>
          )}
          {intakeNote && <Note kind={intakeNote.kind} id="status-intake">{intakeNote.text}</Note>}
          {batches.length > 0 && (
            <ul className="space-y-2" data-testid="list-batches">
              {batches.map((b) => (
                <li key={b.id} className="border border-foreground/70 bg-card p-3 text-sm">
                  <span className={mono}>{b.id}</span> state <span className="font-mono">{b.state}</span>, run {b.runId ?? 'none'}, rows in {b.inputRows}, accepted {b.acceptedRows}, rejected {b.rejectedRows}
                  {b.failure && <p className="text-destructive">{b.failure.message} Next: {b.failure.nextAction}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="a4" className="space-y-3 pb-16">
          <h2 id="a4" className="font-serif text-3xl">Reference workflows</h2>
          {sources.isLoading ? <div className="h-32 animate-pulse bg-muted" /> : sources.isError ? (
            <div className="border border-destructive bg-destructive/10 p-4 text-sm">Could not load sources: {errMsg(sources.error)} <button className="underline" onClick={() => sources.refetch()}>Retry</button></div>
          ) : (
            <ul className="grid gap-px border border-foreground/70 bg-foreground/70 md:grid-cols-3" data-testid="panel-workflows">
              {(sources.data ?? []).map((s) => (
                <li key={s.id} className="bg-card p-4" data-testid={`card-workflow-${s.id}`}>
                  <div className="flex justify-between gap-2"><span className="font-medium">{s.name}</span>
                    <span className="font-mono text-[10px] uppercase border px-1.5 py-0.5">{s.status === 'synthetic_fixture' ? 'Synthetic supported' : 'Not connected'}</span></div>
                  <p className="mt-2 text-xs text-muted-foreground">Acquisition: {s.acquisitionClass}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default AcquisitionConsole;
