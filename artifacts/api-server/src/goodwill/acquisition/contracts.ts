import type { AcquisitionRequest, AcquisitionRun, RawArtifact, WorkflowFailure } from "@workspace/api-zod";

// Wire dates are ISO strings. The Zod-generator types use Date, although JSON does not.
export type Run = Omit<AcquisitionRun, "createdAt" | "updatedAt" | "artifact"> & {
  createdAt: string; updatedAt: string; artifact: Artifact | null;
  downloadedAt?: string;
  /** Metadata-only audit; never URLs, HTML, cookies or filesystem paths. */
  steps?: { name: string; at: string }[];
};
export type Artifact = Omit<RawArtifact, "archivedAt"> & { archivedAt: string };
export type Request = AcquisitionRequest;
export interface RunRepository {
  create(run: Run): Promise<void>;
  get(id: string): Promise<Run | null>;
  list(offset: number, limit: number): Promise<{ items: Run[]; total: number }>;
  /** Atomic compare-and-set; cancellation must win over a late download. */
  replace(run: Run, expected: Run["state"][]): Promise<boolean>;
  /** Called before accepting requests, with no old process still running. */
  interruptUnfinished(at: string): Promise<void>;
}
export interface Archive {
  /** Immutable private object write. Idempotency key is the server-issued run ID. */
  put(key: string, bytes: Uint8Array, metadata: { filename: string; checksum: string }): Promise<Artifact>;
  read(artifactId: string): Promise<Uint8Array>;
}
export interface DownloadManifest {
  sourceId: "upright"; reportType: "paid_order_items";
  startDate: string; endDate: string; timezone: "America/New_York";
  synthetic: true; contractVersion: "1.0.0";
  filename: string; checksum: string; byteSize: number;
}
export interface DownloadEvidence {
  bytes: Uint8Array; manifest: DownloadManifest;
  suggestedFilename: string; downloadedAt: string;
}
export type Step = (name: string) => Promise<void>;
export interface Replay {
  acquire(request: Request, signal: AbortSignal, step: Step): Promise<DownloadEvidence>;
}
export class AcquisitionError extends Error {
  constructor(public code: string, message: string, public retryable = false,
    public nextAction = "Use the manual CSV intake or review the synthetic run parameters.",
    public status = 400) { super(message); }
  toFailure(): WorkflowFailure {
    return { code: this.code, message: this.message, retryable: this.retryable, nextAction: this.nextAction };
  }
}
export const terminal = (state: Run["state"]) => ["verified", "failed", "cancelled"].includes(state);
export function aborted(signal: AbortSignal) {
  if (signal.aborted) throw new AcquisitionError("CANCELLED", "Acquisition was cancelled.", false, "Start a new run when ready.");
}