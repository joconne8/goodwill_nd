import { useEffect, useRef, useState } from 'react';
import type { SyntheticReport } from '@workspace/api-client-react';

export type ReplicaScenario =
  | 'success' | 'delayed' | 'session_expired' | 'dom_drift'
  | 'missing_report' | 'wrong_dates' | 'failed_download';
export type GenerationTransport = (req: { startDate: string; endDate: string }) => Promise<SyntheticReport>;

const SCENARIOS: ReplicaScenario[] = ['success', 'delayed', 'session_expired', 'dom_drift', 'missing_report', 'wrong_dates', 'failed_download'];
const MIN = '2026-08-01';
const MAX = '2026-08-31';

export const defaultTransport: GenerationTransport = async (req) => {
  const base = import.meta.env.BASE_URL ?? '/';
  const res = await fetch(`${base.endsWith('/') ? base : base + '/'}api/goodwill/report`.replace(/^\/\//, '/'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: req.startDate, endDate: req.endDate }),
  });
  if (!res.ok) {
    let msg = `Generation failed (HTTP ${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = `${j.error}${j.code ? ` (${j.code})` : ''}`; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await res.json()) as SyntheticReport;
};

function readScenario(prop?: string): ReplicaScenario {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scenario') : null;
  const v = prop ?? q ?? 'success';
  return (SCENARIOS as string[]).includes(v) ? (v as ReplicaScenario) : 'success';
}

const field = 'mt-1 w-full border border-input bg-background px-2 py-2 text-sm';
const btn = 'px-4 py-2 text-sm font-medium border border-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:translate-y-px';

export function ReplicaPortal({ scenario, generate }: { scenario?: string; generate?: GenerationTransport }) {
  const sc = readScenario(scenario);
  const transport = generate ?? defaultTransport;
  const [view, setView] = useState<'paid' | 'reports'>('paid');
  const [startDate, setStart] = useState('2026-08-01');
  const [endDate, setEnd] = useState('2026-08-31');
  const [tz, setTz] = useState('America/New_York');
  const [channel, setChannel] = useState('all');
  const [payment, setPayment] = useState('paid');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SyntheticReport | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const seq = useRef(0);

  const invalidate = () => { seq.current++; setReport(null); setDownloaded(false); setError(null); setBusy(false); };
  useEffect(() => { invalidate(); }, [startDate, endDate, tz, channel, payment]);

  const validate = (): { code: string; message: string } | null => {
    const E = (code: string, message: string) => ({ code, message });
    if (!startDate || !endDate) return E('INVALID_PERIOD', 'Both dates are required.');
    if (startDate < MIN || endDate > MAX || startDate > MAX || endDate < MIN) return E('UNSUPPORTED_PERIOD', 'Only August 2026 dates are supported by this synthetic replica.');
    if (startDate > endDate) return E('INVALID_PERIOD', 'Start date must not be after end date (chronological order required).');
    if (tz !== 'America/New_York') return E('INVALID_FILTER', 'Unsupported timezone: only Eastern (America/New_York) is supported.');
    if (channel !== 'all') return E('INVALID_FILTER', 'Unsupported channel filter: only All is supported.');
    if (payment !== 'paid') return E('INVALID_FILTER', 'Unsupported payment status: only Paid is supported.');
    return null;
  };

  const openConfirm = () => {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null); setConfirming(true);
  };

  const run = async () => {
    setConfirming(false);
    const my = ++seq.current;
    setReport(null); setDownloaded(false); setError(null); setBusy(true);
    const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
    try {
      if (sc === 'session_expired') throw fail('SESSION_EXPIRED', 'Session expired. Sign in to the source again; no report was requested.');
      if (sc === 'dom_drift') throw fail('DOM_DRIFT', 'The page structure changed; the Generate control was not found.');
      if (sc === 'delayed') await new Promise((r) => setTimeout(r, 700));
      if (sc === 'missing_report') throw fail('MISSING_REPORT', 'Report not found in Past reports after generation. Nothing to download.');
      let r = await transport({ startDate, endDate });
      if (my !== seq.current) return;
      if (sc === 'wrong_dates') r = { ...r, startDate: '2026-08-02' };
      if (!r || typeof r.csv !== 'string' || r.csv.trim().split('\n').length < 2) throw fail('EMPTY_REPORT', 'Generated file has no item data; rejected.');
      if (new TextEncoder().encode(r.csv).length > 5242880) throw fail('INVALID_FILE_SIZE', 'Generated file exceeds the 5 MiB limit.');
      if (r.startDate !== startDate || r.endDate !== endDate) throw fail('WRONG_REPORT_DATES', `Returned report covers ${r.startDate} to ${r.endDate}, not the requested ${startDate} to ${endDate}. Rejected.`);
      setReport(r); setCreatedAt(new Date().toISOString());
    } catch (e) {
      if (my === seq.current) setError({ code: (e as { code?: string }).code ?? 'GENERATION_FAILED', message: e instanceof Error ? e.message : 'Generation failed' });
    } finally {
      if (my === seq.current) setBusy(false);
    }
  };

  const download = () => {
    if (!report) return;
    if (sc === 'failed_download') { setError({ code: 'DOWNLOAD_FAILED', message: 'Download failed. The file was not saved; nothing was downloaded.' }); return; }
    const url = URL.createObjectURL(new Blob([report.csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = report.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  };

  const manifest = report ? JSON.stringify({
    sourceId: report.sourceId, reportType: report.reportType,
    startDate: report.startDate, endDate: report.endDate,
    timezone: 'America/New_York', synthetic: true, filename: report.filename,
    checksum: report.checksum, byteSize: new TextEncoder().encode(report.csv).length,
    contractVersion: '1.0.0',
  }) : '';

  const genProps = sc === 'dom_drift' ? { 'data-testid': 'replica-generate-moved' } : { 'data-testid': 'replica-generate' };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b-2 border-foreground bg-accent/30">
        <div className="mx-auto max-w-5xl px-5 py-3 text-xs font-mono uppercase leading-relaxed" data-testid="replica-disclosure">
          Replica of a screenshot-reviewed report flow. Synthetic. Grain: paid ITEM rows, timezone Eastern.
          Live source reports are unverified orders in Pacific time per the reviewed screenshots; this does not match them.
          Downloading is not publishing. No email is sent.
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-5 py-6 grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-2" aria-label="Replica navigation">
          <p className="font-mono text-[11px] uppercase text-muted-foreground">Upright replica / Reports</p>
          <button className={`${btn} w-full text-left ${view === 'reports' ? 'bg-primary text-primary-foreground' : 'bg-card'}`} data-testid="replica-reports" onClick={() => setView('reports')}>Reports</button>
          <button className={`${btn} w-full text-left ${view === 'paid' ? 'bg-primary text-primary-foreground' : 'bg-card'}`} data-testid="replica-paid-orders" onClick={() => setView('paid')}>Paid orders</button>
        </nav>
        <main className="space-y-6">
          {view === 'reports' ? (
            <section className="border border-foreground/70 bg-card p-5">
              <h1 className="font-serif text-3xl">Reports</h1>
              <p className="mt-2 text-sm text-muted-foreground">Open Paid orders to generate the synthetic paid order item report.</p>
            </section>
          ) : (
            <section className="border border-foreground/70 bg-card p-5 space-y-4">
              <h1 className="font-serif text-3xl">Paid order report</h1>
              <p className="text-sm text-muted-foreground">Rows are paid items, one per order line, filtered by paid date.</p>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <label className="text-xs font-mono uppercase">Start
                  <input type="date" className={field} value={startDate} onChange={(e) => setStart(e.target.value)} data-testid="replica-start" /></label>
                <label className="text-xs font-mono uppercase">End
                  <input type="date" className={field} value={endDate} onChange={(e) => setEnd(e.target.value)} data-testid="replica-end" /></label>
              </div>
              <div className="grid gap-3 max-w-md">
                <label className="text-xs font-mono uppercase">Timezone
                  <select className={field} value={tz} onChange={(e) => setTz(e.target.value)} data-testid="replica-timezone">
                    <option value="America/New_York">Eastern (America/New_York)</option>
                    <option value="America/Los_Angeles">Pacific (unsupported)</option>
                  </select></label>
                <label className="text-xs font-mono uppercase">Channel
                  <select className={field} value={channel} onChange={(e) => setChannel(e.target.value)} data-testid="replica-channel">
                    <option value="all">All</option>
                    <option value="online">Online (unsupported)</option>
                  </select></label>
                <label className="text-xs font-mono uppercase">Payment status
                  <select className={field} value={payment} onChange={(e) => setPayment(e.target.value)} data-testid="replica-payment">
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded (unsupported)</option>
                  </select></label>
              </div>
              <button className={`${btn} bg-primary text-primary-foreground`} onClick={openConfirm} disabled={busy} {...genProps}>
                {busy ? 'Generating...' : 'Generate report'}
              </button>
              <p className="text-xs text-muted-foreground">The file appears below when ready. No email is sent.</p>
            </section>
          )}

          {error && <p role="alert" className="border-l-4 border-destructive bg-destructive/10 px-3 py-2 text-sm" data-testid="replica-error" data-code={error.code}>{error.message}</p>}

          <section className="border border-foreground/70 bg-card p-5">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Past reports</h2>
            {!report ? (
              <p className="mt-3 text-sm text-muted-foreground">{busy ? 'Generation in progress.' : 'No report generated for the current inputs.'}</p>
            ) : (
              <div className="mt-3 space-y-3">
                <table className="w-full text-left text-sm">
                  <thead className="font-mono text-xs uppercase"><tr><th className="py-1">Created</th><th>Period</th><th>Status</th><th>Link</th></tr></thead>
                  <tbody><tr className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{createdAt}</td>
                    <td className="font-mono text-xs">{report.startDate} to {report.endDate}</td>
                     <td><span data-testid="replica-ready" className="border border-primary bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] uppercase">Complete</span></td>
                    <td><button className="underline text-sm" onClick={download} data-testid="replica-download">Download {report.filename}</button></td>
                  </tr></tbody>
                </table>
                 <p className="text-xs text-muted-foreground">{downloaded ? 'Download requested. Browser replay separately verifies completion; not published.' : 'Not yet downloaded.'}</p>
                <pre className="overflow-auto bg-muted p-3 font-mono text-[11px] whitespace-pre-wrap break-all" data-testid="replica-manifest">{manifest}</pre>
              </div>
            )}
          </section>
        </main>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" role="dialog" aria-modal="true" aria-labelledby="rc-t">
          <div className="max-w-md border-2 border-foreground bg-card p-6 space-y-3">
            <h2 id="rc-t" className="font-serif text-2xl">Generate this report?</h2>
            <p className="text-sm">Paid items, {startDate} to {endDate}, Eastern time, all channels. The file is made here for download. No email is sent.</p>
            <div className="flex gap-2">
              <button className={`${btn} bg-primary text-primary-foreground`} onClick={run} data-testid="replica-confirm">Confirm and generate</button>
              <button className={`${btn} bg-card`} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReplicaPortal;
