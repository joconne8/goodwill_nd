import { randomUUID } from "node:crypto";
import { CreateGoodwillBatchBody, RequestGoodwillUploadBody, ReviewGoodwillBatchBody } from "@workspace/api-zod";
import { datasetFor } from "./catalog";
import { hash, normalize, parseCsv, period, money, sum } from "./normalize";
import { DataError, type Archive, type Artifact, type Batch, type Controls, type LedgerRecord, type Publication, type Repository, type StagedRow, type Tx, type Upload } from "./types";

export interface VerifiedRun {
  bytes: Uint8Array; artifact: Artifact;
  manifest: {runId: string; sourceId: string; reportType: string; startDate: string; endDate: string; checksum: string; byteSize: number};
}
export interface Dependencies {
  repository: Repository; archive: Archive; controls: Controls;
  resolveVerifiedRun: (id: string) => Promise<VerifiedRun>;
}
export async function current(tx: Tx) {
  const head = await tx.get<{id: string}>("heads","current");
  return head ? tx.get<Publication>("publications",head.id) : null;
}
export async function recordsFor(tx: Tx, publication: Publication | null) {
  const ids = new Set(publication?.recordIds ?? []);
  return (await tx.list<LedgerRecord>("records")).filter(r => ids.has(r.id));
}
export class IntakeService {
  constructor(public readonly deps: Dependencies) {}
  /** Start only after predecessor is stopped; never interrupt an active intake worker. */
  async initialize() {
    await this.deps.repository.transaction(async tx => {
      for (const batch of await tx.list<Batch>("batches")) {
        if (["received","validated","reconciled"].includes(batch.state)) {
          batch.state = "failed"; batch.failure = new DataError("INTERRUPTED","Intake interrupted before publication; inspect original upload/run and retry.",503).failure();
          await tx.put("batches",batch.id,batch);
        }
      }
    });
  }
  async requestUpload(input: unknown, owner: string) {
    const parsed = RequestGoodwillUploadBody.strict().safeParse(input);
    if (!parsed.success || !owner) throw new DataError("INVALID_UPLOAD", "Upload metadata or operator identity is invalid.");
    const body = parsed.data;
    if (!datasetFor(body.sourceId,body.reportType)) throw new DataError("UNSUPPORTED_DATASET", "Select one supported source and report.");
    if (!/^[^/\\\u0000-\u001f]+\.csv$/i.test(body.filename)) throw new DataError("INVALID_FILENAME", "Only a CSV basename is accepted.");
    const ticket: Upload = {...body,id: randomUUID(),owner,expiresAt: new Date(Date.now()+600000).toISOString(),consumedBy: null};
    const uploadUrl = await this.deps.archive.signUpload(ticket.id,ticket.expiresAt);
    await this.deps.repository.transaction(tx => tx.put("uploads",ticket.id,ticket));
    return {uploadId: ticket.id,uploadUrl,expiresAt: ticket.expiresAt};
  }
  async createBatch(input: unknown, owner: string): Promise<Batch> {
    const parsed = CreateGoodwillBatchBody.strict().extend({period: CreateGoodwillBatchBody.shape.period.strict()}).safeParse(input);
    if (!parsed.success || !owner) throw new DataError("INVALID_INTAKE", "Use a server-issued upload or verified run ID.");
    const body = parsed.data, d = datasetFor(body.sourceId,body.reportType);
    if (!d) throw new DataError("UNSUPPORTED_DATASET", "Unknown source/report pair.");
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(body.inputId))throw new DataError("INVALID_INPUT_ID","Use an opaque server-issued identifier, never a URL or path.");
    period(body.period);
    const batch: Batch = { id: randomUUID(), datasetId: d.id, sourceId: d.sourceId, reportType: d.reportType,
      period: body.period, state: "received", runId: body.inputKind === "run" ? body.inputId : null, artifact: null,
      receivedAt: new Date().toISOString(), publishedAt: null, inputRows: 0, acceptedRows: 0, rejectedRows: 0,
      duplicateRows: 0, publicationId: null, duplicateOf: null, supersedesBatchId: null, reconciliation: [],
      warnings: ["Synthetic only; source scopes are not additive."], failure: null, contractVersion: "2.0.0", coverageComplete: false };
    await this.deps.repository.transaction(tx => tx.put("batches",batch.id,batch));
    let bytes: Uint8Array, ticket: Upload | null = null;
    try {
      if (body.inputKind === "upload") {
        ticket = await this.deps.repository.transaction(tx => tx.get<Upload>("uploads",body.inputId));
        if (!ticket || ticket.owner !== owner) throw new DataError("UPLOAD_NOT_FOUND", "Upload ticket does not belong to this operator.",404);
        if (ticket.sourceId !== d.sourceId || ticket.reportType !== d.reportType) throw new DataError("RECEIPT_SCOPE_MISMATCH", "Upload source/report differs from the request.");
        if (ticket.consumedBy) throw new DataError("UPLOAD_CONSUMED", "Upload was already consumed; inspect its original batch.",409);
        if (Date.parse(ticket.expiresAt) <= Date.now()) throw new DataError("UPLOAD_EXPIRED", "Request a new upload ticket.",409);
        bytes = await this.deps.archive.readUpload(ticket.id);
        if (bytes.length !== ticket.byteSize || hash(bytes) !== ticket.checksum) throw new DataError("ARTIFACT_IDENTITY_MISMATCH", "Uploaded byte size or SHA256 differs from its ticket.");
        batch.artifact = await this.deps.archive.put(ticket.id,bytes,{filename: ticket.filename,checksum: ticket.checksum});
      } else {
        const run = await this.deps.resolveVerifiedRun(body.inputId), m = run.manifest;
        if (m.runId !== body.inputId || m.sourceId !== d.sourceId || m.reportType !== d.reportType ||
          m.startDate !== body.period.startDate || m.endDate !== body.period.endDate)
          throw new DataError("RUN_SCOPE_MISMATCH", "Verified run does not match the requested source/report/period.");
        bytes = run.bytes; batch.artifact = run.artifact;
        if (hash(bytes) !== m.checksum || bytes.length !== m.byteSize) throw new DataError("ARTIFACT_IDENTITY_MISMATCH", "Verified acquisition bytes changed.");
      }
      if (bytes.length !== batch.artifact.byteSize || hash(bytes) !== batch.artifact.checksum)
        throw new DataError("ARTIFACT_IDENTITY_MISMATCH", "Archived artifact metadata differs from the resolved bytes.");
      // Re-read the sealed object: transient bytes alone do not establish durable provenance.
      const archived = await this.deps.archive.read(batch.artifact.artifactId);
      if (archived.length !== bytes.length || hash(archived) !== batch.artifact.checksum)
        throw new DataError("ARTIFACT_IDENTITY_MISMATCH", "Immutable archived evidence failed re-verification.");
      return await this.deps.repository.transaction(async tx => {
        if (ticket) {
          const locked = await tx.get<Upload>("uploads",ticket.id);
          if (!locked || locked.consumedBy) throw new DataError("UPLOAD_CONSUMED", "Another intake already consumed this ticket.",409);
          if (Date.parse(locked.expiresAt) <= Date.now()) throw new DataError("UPLOAD_EXPIRED", "Ticket expired before intake.",409);
          await tx.put("uploads",ticket.id,{...locked,consumedBy: batch.id});
        }
        const priorArtifact = await tx.get<Artifact>("artifacts",batch.artifact!.artifactId);
        if (priorArtifact) {
          if (priorArtifact.checksum !== batch.artifact!.checksum || priorArtifact.byteSize !== batch.artifact!.byteSize)
            throw new DataError("IMMUTABLE_ARTIFACT_CONFLICT", "Artifact identity is already assigned.",409);
          batch.artifact = priorArtifact;
        } else await tx.put("artifacts",batch.artifact!.artifactId,batch.artifact);
        const previous = (await tx.list<Batch>("batches")).find(b => b.id !== batch.id && b.sourceId === d.sourceId &&
          b.reportType === d.reportType && b.period.startDate === batch.period.startDate &&
          b.period.endDate === batch.period.endDate &&
          b.artifact?.checksum === batch.artifact!.checksum && !["received","failed"].includes(b.state));
        if (previous) {
          batch.state = "duplicate"; batch.duplicateOf = previous.id; batch.publicationId = previous.publicationId;
          batch.warnings.push("File-level replay; no records re-inspected or republished.");
          await tx.put("batches",batch.id,batch); return batch;
        }
        let fields: string[][];
        try { fields = parseCsv(bytes,d.header); }
        catch (error) { return this.quarantine(tx,batch,error); }
        batch.state = "validated"; batch.inputRows = fields.length;
        const head = await current(tx), existing = await recordsFor(tx,head);
        const keys = new Map(existing.filter(r => r.datasetId === d.id).map(r => [r.key,r]));
        const seen = new Map<string,LedgerRecord>(), staged: StagedRow[] = [], candidates: LedgerRecord[] = [];
        let conflict = false, formulaMismatch = false;
        fields.forEach((row,index) => {
          const ordinal = index+1, stagedRow: StagedRow = { id: `${batch.id}_${ordinal}`, batchId: batch.id, sourceRow: ordinal,
            record: null, values: Object.fromEntries(d.header.map((f,i) => [f,row[i] ?? null])), disposition: "rejected", reasons: [] };
          try {
            const n = normalize(d,row,body.period);
            const record: LedgerRecord = {...n,id: hash(`${batch.id}\0${ordinal}\0${n.fingerprint}`),batchId: batch.id, runId: batch.runId,
              artifactId: batch.artifact!.artifactId,checksum: batch.artifact!.checksum,sourceRow: ordinal};
            stagedRow.record = record; stagedRow.values = record.values;
            const old = seen.get(record.key) ?? keys.get(record.key);
            if (old && old.fingerprint === record.fingerprint) {
              stagedRow.disposition = "duplicate"; stagedRow.reasons.push("SAME_KEY_SAME_VALUES"); batch.duplicateRows++;
            } else if (old) {
              conflict = true; stagedRow.reasons.push("CONFLICTING_IDENTITY"); batch.rejectedRows++;
            } else { stagedRow.disposition = "accepted"; stagedRow.reasons.push(...record.warnings); batch.acceptedRows++; candidates.push(record); }
            seen.set(record.key,record);
          } catch (e) {
            const error = e instanceof DataError ? e : new DataError("INVALID_RECORD","Record failed validation.");
            stagedRow.reasons.push(error.code); batch.rejectedRows++;
            if (error.code === "SOURCE_FORMULA_MISMATCH" || error.code === "WRONG_PERIOD" || error.code === "STATEMENT_PERIOD_REQUIRED")
              formulaMismatch = true;
          }
          staged.push(stagedRow);
        });
        for (const row of staged) await tx.put("rows",row.id,row);
        // Verified bytes/scope do not prove financial acceptance of rejected records.
        batch.coverageComplete = body.inputKind === "run" && batch.rejectedRows === 0;
        const knownEntry = Object.entries(this.deps.controls.files).find(([filename,c])=>c.sha256===batch.artifact!.checksum && (filename===d.filename || c.datasetId===d.id));
        const known = knownEntry?.[1];
        const all = staged.filter(r => r.record).map(r => r.record!);
        const trusted = known?.sha256 === batch.artifact!.checksum;
        if (trusted) {
          batch.reconciliation.push({name: "independent_manifest_rows",unit:"count",expected:known.rows,actual:fields.length,
            difference:fields.length-known.rows,status:fields.length === known.rows ? "matched" : "mismatch"});
          for (const [field,total] of Object.entries(this.deps.controls.control_totals[knownEntry![0]] ?? {})) {
            const expected = money(total,true), actual = sum(all.map(r => r.values[field] as number));
            batch.reconciliation.push({name: `independent_manifest_${field}`,unit:"usd_cent",expected,actual,difference:sum([actual,-expected]),status:actual === expected ? "matched" : "mismatch"});
          }
          batch.coverageComplete = batch.rejectedRows === 0 && (["dimension","listing","snapshot","catalog","exception","lifecycle"].includes(d.role) ||
            body.period.startDate === (known.startDate ?? "2026-08-01") && body.period.endDate === (known.endDate ?? "2026-08-31"));
        }
        batch.reconciliation.push({name:"source_formula_validation",unit:"count",expected:0,actual:formulaMismatch ? 1 : 0,difference:formulaMismatch ? 1 : 0,status:formulaMismatch ? "mismatch" : "matched"});
        if (conflict || formulaMismatch || batch.reconciliation.some(c => c.status === "mismatch"))
          return this.quarantine(tx,batch,new DataError(conflict ? "CONFLICTING_IDENTITY" : "RECONCILIATION_MISMATCH","Batch held; last-good publication remains unchanged.",409));
        if (!candidates.length) {
          if (batch.rejectedRows) return this.quarantine(tx,batch,new DataError("NO_ACCEPTED_ROWS","No new valid records to publish."));
          batch.state = "duplicate"; batch.publicationId = head?.id ?? null;
          batch.duplicateOf = existing.find(r => r.datasetId === d.id)?.batchId ?? null;
          await tx.put("batches",batch.id,batch); return batch;
        }
        batch.state = "reconciled";
        try { return await this.publish(tx,batch,head,existing,candidates); }
        catch(error) {
          if(error instanceof DataError && error.code==="UNSAFE_TOTAL")return this.quarantine(tx,batch,error);
          throw error;
        }
      });
    } catch (e) {
      const error = e instanceof DataError ? e : new DataError("INFRASTRUCTURE_FAILURE","Storage, database or verified-run resolution failed.",503);
      batch.state = error.status === 503 ? "failed" : "quarantined"; batch.failure = error.failure();
      // This independent attempt update cannot alter the current ledger revision.
      await this.deps.repository.transaction(tx => tx.put("batches",batch.id,batch));
      return batch;
    }
  }
  private async quarantine(tx: Tx, batch: Batch, error: unknown) {
    batch.state = "quarantined"; batch.coverageComplete = false;
    batch.failure = (error instanceof DataError ? error : new DataError("INVALID_FILE","File cannot be parsed.")).failure();
    await tx.put("batches",batch.id,batch); return batch;
  }
  private async publish(tx: Tx, batch: Batch, head: Publication | null, kept: LedgerRecord[], incoming: LedgerRecord[]) {
    const d=datasetFor(batch.sourceId,batch.reportType)!;
    const sourceRecords=[...kept.filter(r=>r.datasetId===d.id),...incoming];
    // Check both source fields and supported derived money before changing any head.
    // Bound each sign separately: a safe grand total can hide an unsafe day/store/category subset.
    const amounts = [
      ...d.monetaryFields.map(field=>sourceRecords.map(r=>r.values[field] as number)),
      ...(["netItemMinor","sourceNetMinor","expenseMinor"] as const).map(field=>
        sourceRecords.map(r=>r[field]).filter((value): value is number=>value !== null)),
    ];
    for(const values of amounts) {
      sum(values.filter(value=>value > 0));
      sum(values.filter(value=>value < 0));
    }
    const publication: Publication = {id:randomUUID(),at:new Date().toISOString(),parentId:head?.id ?? null,
      recordIds:[...kept.map(r=>r.id),...incoming.map(r=>r.id)],batchIds:[...new Set([...kept.map(r=>r.batchId),batch.id])]};
    for (const record of incoming) {
      await tx.put("records",record.id,record);
      // One database-primary-key slot per dataset/grain identity; immutable versions remain separate.
      await tx.put("heads",`identity_${record.datasetId}_${hash(record.key)}`,{datasetId:record.datasetId,key:record.key,recordId:record.id,publicationId:publication.id});
    }
    await tx.put("publications",publication.id,publication);
    await tx.put("heads","current",{id:publication.id});
    batch.state = batch.rejectedRows ? "partial" : "published"; batch.publicationId = publication.id; batch.publishedAt = publication.at;
    if (!batch.coverageComplete) batch.warnings.push("Observed rows only; the caller's period does not establish complete coverage.");
    await tx.put("batches",batch.id,batch); return batch;
  }
  async review(batchId: string, input: unknown, reviewer: string) {
    const result = ReviewGoodwillBatchBody.strict().safeParse(input);
    if (!result.success || !reviewer) throw new DataError("INVALID_REVIEW","Explicit synthetic confirmation, current publication and a reason are required.");
    const body = result.data;
    return this.deps.repository.transaction(async tx => {
      const batch = await tx.get<Batch>("batches",batchId), head = await current(tx);
      if (!batch) throw new DataError("BATCH_NOT_FOUND","Unknown correction batch.",404);
      if (!head || head.id !== body.expectedPublicationId) throw new DataError("PUBLICATION_CHANGED","Current publication changed; refresh before review.",409);
      if (batch.state !== "quarantined" || batch.failure?.code !== "CONFLICTING_IDENTITY") throw new DataError("NOT_A_CORRECTION","Only an identified conflicting dataset can be reviewed.",409);
      const staged = (await tx.list<StagedRow>("rows")).filter(r=>r.batchId===batchId);
      await tx.put("audit",randomUUID(),{batchId,reviewer,at:new Date().toISOString(),...body,
        before:{state:batch.state,failure:batch.failure,acceptedRows:batch.acceptedRows,rejectedRows:batch.rejectedRows,duplicateRows:batch.duplicateRows},
        originalStaging:staged.map(r=>({sourceRow:r.sourceRow,disposition:r.disposition,reasons:r.reasons}))});
      if (body.action === "reject") {
        batch.failure = new DataError("CORRECTION_REJECTED","Reviewer rejected the synthetic correction.",409).failure();
        await tx.put("batches",batch.id,batch); return batch;
      }
      if (staged.some(r=>!r.record || r.reasons.some(c=>!["CONFLICTING_IDENTITY","SAME_KEY_SAME_VALUES","UNKNOWN_STORE","MISSING_BUYER","UNCONFIRMED_SUPPLIER"].includes(c))))
        throw new DataError("INVALID_CORRECTION_ROWS","Correction contains malformed or non-reconciling records.",409);
      const incoming = staged.map(r=>r.record!), keys = new Set(incoming.map(r=>r.key));
      if (keys.size !== incoming.length) throw new DataError("AMBIGUOUS_CORRECTION","Correction must contain unique source keys.",409);
      const existing = await recordsFor(tx,head), scope = existing.filter(r=>r.datasetId===batch.datasetId && keys.has(r.key));
      const affected = [...new Set(scope.map(r=>r.batchId))];
      if (affected.length !== 1) throw new DataError("AMBIGUOUS_CORRECTION_SCOPE","Correction must identify exactly one original batch.",409);
      const original = await tx.get<Batch>("batches",affected[0]);
      const originalRows = existing.filter(r=>r.datasetId===batch.datasetId && r.batchId===affected[0]);
      if (!original || JSON.stringify(original.period)!==JSON.stringify(batch.period) || originalRows.length!==incoming.length || originalRows.some(r=>!keys.has(r.key)))
        throw new DataError("CORRECTION_SCOPE_MISMATCH","Correction must replace the exact original batch period and key set.",409);
      batch.supersedesBatchId = original.id; batch.acceptedRows = incoming.length; batch.rejectedRows = 0; batch.duplicateRows = 0;
      batch.coverageComplete = original.coverageComplete; batch.failure = null;
      batch.warnings.push("Explicit synthetic supersession approved; prior staging dispositions retained in immutable review audit.");
      batch.reconciliation = [{name:"reviewed_scope_identity",unit:"count",expected:originalRows.length,actual:incoming.length,difference:0,status:"matched"}];
      for (const row of staged) await tx.put("rows",row.id,{...row,disposition:"accepted",reasons:[...row.record!.warnings,"REVIEWED_CORRECTION"]});
      original.state = "superseded"; await tx.put("batches",original.id,original);
      return this.publish(tx,batch,head,existing.filter(r=>!originalRows.some(o=>o.id===r.id)),incoming);
    });
  }
}