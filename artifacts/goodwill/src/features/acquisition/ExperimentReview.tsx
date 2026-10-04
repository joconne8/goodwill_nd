import { useEffect, useState } from "react";

export interface ExperimentRecipeSummary {
  id: string; digest: string; version: string; kind: "jev" | "scripted";
  checksum: string; byteSize: number; period: { startDate: string; endDate: string };
  steps: { goal: string; operation: string; name: string }[];
}
/** Lead-owned authenticated adapter; no new endpoints or client credentials invented in this lane. */
export interface ExperimentalAcquisitionAdapter {
  access: { discoveryAuthorized: boolean; explanation: string };
  list(): Promise<{ recipes: ExperimentRecipeSummary[]; approvals: { id: string; version: string }[]; repairCount: number }>;
  start(input: { mode: "supervised-discovery" | "approved-replay"; approvalId?: string;
    sourceId: "upright"; reportType: "paid_order_items"; period: { startDate: string; endDate: string } }): Promise<{ id: string }>;
  approve(input: { recipeId: string; expectedDigest: string; verifiedRunId: string; confirmation: true }): Promise<{ id: string }>;
}
const button = "border border-foreground/80 bg-card px-3 py-2 text-sm disabled:opacity-40";
export function ExperimentReview({ adapter, period, verifiedRunIds, onRun }: {
  adapter?: ExperimentalAcquisitionAdapter; period: { startDate: string; endDate: string };
  verifiedRunIds: string[]; onRun: () => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<ExperimentalAcquisitionAdapter["list"]>> | null>(null);
  const [mode, setMode] = useState<"supervised-discovery" | "approved-replay">("supervised-discovery");
  const [approval, setApproval] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [runId, setRunId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async () => { if (adapter) setData(await adapter.list()); };
  useEffect(() => {
    let active = true;
    setData(null);
    if (adapter) adapter.list().then(d => { if (active) setData(d); })
      .catch(() => { if (active) setMessage("Experiment review is unavailable. Use a deterministic run or manual upload."); });
    return () => { active = false; };
  }, [adapter]);
  const perform = async (fn: () => Promise<string>) => {
    setBusy(true); setMessage("");
    try { setMessage(await fn()); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Experiment stopped. Use manual upload or a new deterministic run."); }
    finally { setBusy(false); }
  };
  const recipe = data?.recipes.find(r => r.id === recipeId);
  return (
    <section aria-labelledby="experimental-acquisition" className="border border-foreground/70 bg-card p-5 space-y-3" data-testid="experiment-review">
      <h2 id="experimental-acquisition" className="font-serif text-2xl">Experimental synthetic acquisition</h2>
      <p className="text-sm">Supervised discovery only. Jev may select observed, approved controls; code supplies all dates and filters. No live marketplace, financial AI or publication.</p>
      {!adapter ? (
        <p className="text-sm" data-testid="experiment-disabled">Disabled: model access, spending, evaluated thresholds and lead-approved wiring are not configured. Deterministic runs make zero model calls.</p>
      ) : <>
        <p className="text-sm">{adapter.access.explanation}</p>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm">Experiment mode
            <select className={button} value={mode} onChange={e => setMode(e.target.value as typeof mode)} data-testid="experiment-mode">
              <option value="supervised-discovery">Supervised discovery (may use paid Jev)</option>
              <option value="approved-replay">Approved recipe replay (zero model calls)</option>
            </select>
          </label>
          {mode === "approved-replay" && <label className="text-sm">Approved version
            <select className={button} value={approval} onChange={e => setApproval(e.target.value)}>
              <option value="">Select approval</option>
              {data?.approvals.map(a => <option key={a.id} value={a.id}>{a.version}</option>)}
            </select>
          </label>}
          <button className={button} data-testid="experiment-start" disabled={busy || !period.startDate || !period.endDate || period.startDate > period.endDate ||
            (mode === "supervised-discovery" ? !adapter.access.discoveryAuthorized : !approval)} onClick={() => perform(async () => {
              const r = await adapter.start({ mode, ...(mode === "approved-replay" ? { approvalId: approval } : {}),
                sourceId: "upright", reportType: "paid_order_items", period });
              onRun(); return `Experimental run ${r.id} queued. Review history to cancel or inspect; nothing is published.`;
            })}>Start selected experimental mode</button>
        </div>
        <button className={button} disabled={busy} onClick={() => perform(async () => "Review records refreshed.")}>Refresh review records</button>
        <p className="text-sm">Repair proposals: {data?.repairCount ?? "not loaded"}. Drift never changes an approved version automatically.</p>
        <label className="block text-sm">Recipe awaiting review
          <select className={button} value={recipeId} onChange={e => { setRecipeId(e.target.value); setConfirmed(false); }}>
            <option value="">Select verified discovery</option>
            {data?.recipes.map(r => <option key={r.id} value={r.id}>{r.kind} / {r.version}</option>)}
          </select>
        </label>
        {recipe && <div className="space-y-3">
          <p className="text-sm">{recipe.kind === "scripted" ? "Scripted test trace — NOT measured Jev results." : "Jev discovery trace."} Period {recipe.period.startDate} to {recipe.period.endDate}; {recipe.byteSize} bytes.</p>
          <p className="font-mono text-xs break-all">SHA256 {recipe.checksum}<br />Recipe digest {recipe.digest}</p>
          <ol className="list-decimal pl-5 text-sm">{recipe.steps.map((s, i) => <li key={i}>{s.goal}: {s.operation} {s.name}</li>)}</ol>
          <label className="block text-sm">Bind verified archived run
            <select className={button} value={runId} onChange={e => { setRunId(e.target.value); setConfirmed(false); }}>
              <option value="">Select verified run</option>
              {verifiedRunIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="block text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this exact synthetic recipe version and its verified download; approve model-free replay only.</label>
          <button className={button} data-testid="experiment-approve" disabled={busy || !confirmed || !runId} onClick={() => perform(async () => {
            const result = await adapter.approve({ recipeId: recipe.id, expectedDigest: recipe.digest, verifiedRunId: runId, confirmation: true });
            setConfirmed(false); return `Explicit approval ${result.id} recorded. No run started or data published.`;
          })}>Approve this version</button>
        </div>}
      </>}
      {message && <p role="status" className="text-sm" data-testid="experiment-status">{message}</p>}
    </section>
  );
}