import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGenerateGoodwillReport,
  useImportGoodwillReport,
  useGetGoodwillLatest,
  useGetGoodwillSources,
  getGetGoodwillLatestQueryKey,
  getGetGoodwillSourcesQueryKey,
  type SyntheticReport,
} from '@workspace/api-client-react';

const usd = (minor: number) =>
  (minor / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function errMsg(e: unknown): string {
  const x = e as { data?: { error?: string; code?: string }; message?: string };
  if (x?.data?.error) return `${x.data.error}${x.data.code ? ` (${x.data.code})` : ''}`;
  return x?.message ?? 'Request failed';
}

async function sha256(bytes: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const Mono = ({ children, ...p }: { children: React.ReactNode; 'data-testid'?: string }) => (
  <span className="font-mono text-[12px] break-all" {...p}>{children}</span>
);

const btn =
  'px-4 py-2 text-sm font-medium border border-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:translate-y-px';

export default function Home() {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-31');
  const [report, setReport] = useState<SyntheticReport | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const latest = useGetGoodwillLatest({
    query: {
      queryKey: getGetGoodwillLatestQueryKey(),
      refetchInterval: 15000,
    },
  });
  const sources = useGetGoodwillSources({
    query: { queryKey: getGetGoodwillSourcesQueryKey() },
  });
  const gen = useGenerateGoodwillReport();
  const imp = useImportGoodwillReport();

  const result = latest.data?.result ?? null;
  const busy = gen.isPending || imp.isPending;

  const generate = () => {
    setNote(null);
    setReport(null);
    setDownloaded(false);
    gen.mutate(
      { data: { startDate, endDate } },
      {
        onSuccess: (r) => {
          setReport(r);
          setNote({ kind: 'ok', text: `Generated ${r.filename}. Download it, then import the file.` });
        },
        onError: (e) => setNote({ kind: 'err', text: errMsg(e) }),
      },
    );
  };

  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = report.filename;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const doImport = (data: SyntheticReport) => {
    setNote(null);
    imp.mutate(
      { data },
      {
        onSuccess: (r) => {
          setNote({ kind: 'ok', text: `Published ${r.acceptedRows} rows from ${r.filename}.` });
          qc.invalidateQueries({ queryKey: getGetGoodwillLatestQueryKey() });
        },
        onError: (e) => setNote({ kind: 'err', text: errMsg(e) }),
      },
    );
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (!report) throw new Error('Generate and download a report before importing.');
      if (f.size > 250000) throw new Error('This foundation accepts CSV files up to 250 KB.');
      const buf = await f.arrayBuffer();
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(buf);
      const checksum = await sha256(buf);
      if (checksum !== report.checksum) throw new Error('This file does not match the generated report. Choose its unchanged downloaded CSV.');
      doImport({
        startDate: report.startDate,
        endDate: report.endDate,
        sourceId: 'upright',
        reportType: 'paid_order_items',
        filename: f.name,
        csv,
        checksum,
        synthetic: true,
        contractVersion: '1.0.0',
      });
    } catch (e) {
      setNote({ kind: 'err', text: errMsg(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b-2 border-foreground">
        <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Michiana operations and leadership / foundation build
          </p>
          <h1 className="mt-3 font-serif text-5xl md:text-7xl leading-[0.95]">
            Goodwill Reporting
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Every published total traces to a CSV explicitly imported into this shared synthetic workspace.
          </p>
          <p className="mt-4 text-sm">
            <a className="underline font-medium" href={`${import.meta.env.BASE_URL}reports`}>
              Open the full reporting application
            </a>
            {' '}— approved operator access is required; this retained foundation is not the complete product.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-[11px] uppercase" data-testid="banner-labels">
            {['Synthetic data', 'Manual acquisition', 'Supervised foundation', 'No live Upright compatibility'].map((t) => (
              <span key={t} className="border border-accent bg-accent/20 px-2 py-1">{t}</span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 space-y-14">
        <section aria-labelledby="s1">
          <h2 id="s1" className="font-serif text-3xl">1. Generate, download, import</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generation filters the existing synthetic Upright fixture. Nothing is published until you import.
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <div className="border border-foreground/70 bg-card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-mono uppercase">
                  Start
                  <input type="date" value={startDate} min="2026-08-01" max="2026-08-31"
                    disabled={busy} onChange={(e) => { setStartDate(e.target.value); setReport(null); setDownloaded(false); }} data-testid="input-start-date"
                    className="mt-1 w-full border border-input bg-background px-2 py-2 text-sm" />
                </label>
                <label className="text-xs font-mono uppercase">
                  End
                  <input type="date" value={endDate} min="2026-08-01" max="2026-08-31"
                    disabled={busy} onChange={(e) => { setEndDate(e.target.value); setReport(null); setDownloaded(false); }} data-testid="input-end-date"
                    className="mt-1 w-full border border-input bg-background px-2 py-2 text-sm" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className={`${btn} bg-primary text-primary-foreground`} onClick={generate}
                  disabled={busy || !startDate || !endDate} data-testid="button-generate">
                  {gen.isPending ? 'Generating...' : 'Generate report'}
                </button>
                <button className={`${btn} bg-card`} onClick={download} disabled={!report || busy}
                  data-testid="button-download">
                  Download CSV
                </button>
                <button className={`${btn} bg-card`} onClick={() => fileRef.current?.click()}
                  disabled={busy || !report || !downloaded} data-testid="button-import-file">
                  {imp.isPending ? 'Importing...' : 'Import CSV file'}
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])} data-testid="input-file" />
              </div>
              <p className="text-xs text-muted-foreground">
                Choose the downloaded file. Its bytes are checksummed here and validated by the server;
                edited or mismatched files are rejected.
              </p>
              {note && (
                <p role="status" data-testid="status-message"
                  className={`border-l-4 px-3 py-2 text-sm ${note.kind === 'ok' ? 'border-primary bg-primary/10' : 'border-destructive bg-destructive/10'}`}>
                  {note.text}
                </p>
              )}
            </div>

            <div className="border border-foreground/70 bg-card p-5" data-testid="panel-generated">
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Generated report metadata
              </h3>
              {!report ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No report generated in this session. Pick a date range within August 2026 and generate.
                </p>
              ) : (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">File</dt><dd><Mono data-testid="text-gen-filename">{report.filename}</Mono></dd>
                  <dt className="text-muted-foreground">Period</dt><dd><Mono>{report.startDate} to {report.endDate}</Mono></dd>
                  <dt className="text-muted-foreground">Source</dt><dd><Mono>{report.sourceId} / {report.reportType}</Mono></dd>
                  <dt className="text-muted-foreground">Contract</dt><dd><Mono>{report.contractVersion}, synthetic</Mono></dd>
                  <dt className="text-muted-foreground">SHA-256</dt><dd><Mono data-testid="text-gen-checksum">{report.checksum}</Mono></dd>
                  <dt className="text-muted-foreground">Size</dt><dd><Mono>{report.csv.length.toLocaleString()} chars</Mono></dd>
                  <dt className="text-muted-foreground">State</dt>
                  <dd className="text-sm">{downloaded ? 'Downloaded, awaiting import' : 'Generated, not yet downloaded'}</dd>
                </dl>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="s2">
          <h2 id="s2" className="font-serif text-3xl">2. Last published totals</h2>
          <p className="mt-1 text-sm text-muted-foreground">Refreshes every 15 seconds.</p>
          <div className="mt-5" data-testid="panel-latest">
            {latest.isLoading ? (
              <div className="h-40 animate-pulse bg-muted" />
            ) : latest.isError ? (
              <div className="border border-destructive bg-destructive/10 p-4 text-sm">
                Could not load the latest result: {errMsg(latest.error)}{' '}
                <button className="underline" onClick={() => latest.refetch()} data-testid="button-retry-latest">Retry</button>
              </div>
            ) : !result ? (
              <div className="border-2 border-dashed border-foreground/40 p-8 text-center">
                <p className="font-serif text-2xl">Nothing published yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No totals are shown until a downloaded CSV is imported and validated.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-px bg-foreground/70 border border-foreground/70 md:grid-cols-3">
                  {[['Gross', result.grossMinor], ['Refunds', result.refundMinor], ['Net', result.netMinor]].map(([l, v]) => (
                    <div key={l as string} className="bg-card p-5">
                      <div className="font-mono text-xs uppercase text-muted-foreground">{l}</div>
                      <div className="mt-1 font-serif text-4xl" data-testid={`text-total-${(l as string).toLowerCase()}`}>
                        {usd(v as number)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm border border-foreground/70 bg-card p-5">
                    <dt className="text-muted-foreground">Accepted rows</dt><dd><Mono data-testid="text-accepted-rows">{result.acceptedRows}</Mono></dd>
                    <dt className="text-muted-foreground">Coverage</dt><dd><Mono>{result.coverage}</Mono></dd>
                    <dt className="text-muted-foreground">Period</dt><dd><Mono>{result.startDate} to {result.endDate} ({result.timezone})</Mono></dd>
                    <dt className="text-muted-foreground">Published</dt><dd><Mono>{new Date(result.publishedAt).toLocaleString()}</Mono></dd>
                    <dt className="text-muted-foreground">Source</dt><dd><Mono>{result.sourceId} / {result.reportType}</Mono></dd>
                    <dt className="text-muted-foreground">File</dt><dd><Mono data-testid="text-latest-filename">{result.filename}</Mono></dd>
                    <dt className="text-muted-foreground">SHA-256</dt><dd><Mono data-testid="text-latest-checksum">{result.checksum}</Mono></dd>
                    <dt className="text-muted-foreground">Import</dt><dd><Mono>{result.importId}</Mono></dd>
                    <dt className="text-muted-foreground">Versions</dt><dd><Mono>contract {result.contractVersion}, definitions {result.definitionVersion}</Mono></dd>
                  </dl>
                  <div className="border border-foreground/70 bg-card p-5">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Warnings</h3>
                    {result.warnings.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">The server reported no warnings.</p>
                    ) : (
                      <ul className="mt-2 list-disc pl-5 text-sm space-y-1" data-testid="list-warnings">
                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="border border-foreground/70 bg-card overflow-auto max-h-96" tabIndex={0} aria-label="Scrollable supporting source rows">
                  <table className="w-full text-left text-xs font-mono" data-testid="table-rows">
                    <caption className="p-3 text-left font-sans text-sm text-muted-foreground">
                      Source rows ({result.rows.length}) that sum to the totals above
                    </caption>
                    <thead className="bg-muted uppercase">
                      <tr>
                        {['Row', 'Order', 'Item', 'Sold', 'Store', 'Buyer', 'Gross', 'Refund', 'Net'].map((h) => (
                          <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.sourceRow} className="border-t border-border" data-testid={`row-source-${r.sourceRow}`}>
                          <td className="px-3 py-1.5">{r.sourceRow}</td>
                          <td className="px-3 py-1.5">{r.orderId}</td>
                          <td className="px-3 py-1.5">{r.itemId}</td>
                          <td className="px-3 py-1.5">{r.soldDate}</td>
                          <td className="px-3 py-1.5">{r.storeId ?? 'unknown'}</td>
                          <td className="px-3 py-1.5">{r.buyerId ?? 'unknown'}</td>
                          <td className="px-3 py-1.5 text-right">{usd(r.grossMinor)}</td>
                          <td className="px-3 py-1.5 text-right">{usd(r.refundMinor)}</td>
                          <td className="px-3 py-1.5 text-right">{usd(r.netMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="s3" className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 id="s3" className="font-serif text-3xl">3. Definitions</h2>
            <dl className="mt-4 space-y-3 text-sm border border-foreground/70 bg-card p-5" data-testid="panel-definitions">
              <div><dt className="font-medium">Gross</dt><dd className="text-muted-foreground">Sum of item sale amounts in the imported rows, in USD cents converted for display.</dd></div>
              <div><dt className="font-medium">Refunds</dt><dd className="text-muted-foreground">Sum of refund amounts recorded on those same rows.</dd></div>
              <div><dt className="font-medium">Demo net item sales</dt><dd className="text-muted-foreground">Gross minus item refunds, per row, then summed. Shipping, tax, premiums and fees are excluded. Not payout or net margin.</dd></div>
              <div><dt className="font-medium">Coverage</dt><dd className="text-muted-foreground">Single synthetic source. Totals are not company-wide.</dd></div>
              <div><dt className="font-medium">Timezone</dt><dd className="text-muted-foreground">America/New_York.</dd></div>
            </dl>
          </div>
          <div>
            <h2 className="font-serif text-3xl">Unavailable metrics</h2>
            <ul className="mt-4 space-y-2 text-sm border border-destructive/60 bg-card p-5" data-testid="panel-unavailable">
              {['Cross-source revenue and reconciliation', 'Store-level and buyer-level rollups', 'Payouts, fees and taxes', 'Inventory, labor and donation intake', 'Live Upright data or compatibility', 'Trends, forecasts and charts'].map((m) => (
                <li key={m} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <span>{m}</span><span className="font-mono text-xs uppercase text-destructive">Unavailable</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="s4" className="pb-16">
          <h2 id="s4" className="font-serif text-3xl">4. Source status</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nine source workflows. Only Upright's synthetic fixture is wired into this foundation.</p>
          <div className="mt-5" data-testid="panel-sources">
            {sources.isLoading ? (
              <div className="h-48 animate-pulse bg-muted" />
            ) : sources.isError ? (
              <div className="border border-destructive bg-destructive/10 p-4 text-sm">
                Could not load sources: {errMsg(sources.error)}{' '}
                <button className="underline" onClick={() => sources.refetch()} data-testid="button-retry-sources">Retry</button>
              </div>
            ) : !sources.data || sources.data.length === 0 ? (
              <p className="border-2 border-dashed border-foreground/40 p-6 text-sm">The server returned no sources.</p>
            ) : (
              <ul className="grid gap-px border border-foreground/70 bg-foreground/70 md:grid-cols-3">
                {sources.data.map((s) => (
                  <li key={s.id} className="bg-card p-4" data-testid={`card-source-${s.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] uppercase ${s.status === 'synthetic_fixture' ? 'border-accent bg-accent/30' : 'border-foreground/40 text-muted-foreground'}`}>
                        {s.status === 'synthetic_fixture' ? 'Synthetic fixture' : 'Not connected'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Acquisition: {s.acquisitionClass}</p>
                    <p className="text-xs text-muted-foreground">Role: {s.accountingRole}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
