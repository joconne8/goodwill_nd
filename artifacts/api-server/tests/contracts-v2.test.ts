import { test } from "node:test";
import assert from "node:assert/strict";
import {
  StartGoodwillRunBody, StartGoodwillRunResponse,
  CreateGoodwillBatchBody, CreateGoodwillBatchResponse,
  QueryGoodwillMetricsBody, QueryGoodwillMetricsResponse,
  QueryGoodwillEvidenceResponse, ExportGoodwillReportResponse,
  RequestGoodwillUploadBody, ReviewGoodwillBatchBody,
  GetGoodwillCatalogResponse,
} from "@workspace/api-zod";
import { examples } from "./fixtures/contracts-v2";

test("v2 examples validate against generated validators without implementing the endpoints", () => {
  StartGoodwillRunBody.parse(examples.run.request);
  StartGoodwillRunResponse.parse(examples.run);
  CreateGoodwillBatchBody.parse(examples.intake);
  CreateGoodwillBatchResponse.parse(examples.batch);
  QueryGoodwillMetricsBody.parse(examples.metric.query);
  QueryGoodwillMetricsResponse.parse(examples.metric);
  QueryGoodwillEvidenceResponse.parse(examples.evidence);
  ExportGoodwillReportResponse.parse(examples.export);
  GetGoodwillCatalogResponse.parse(examples.catalog);
});

test("all lifecycle and partial/missing examples retain explicit state", () => {
  for (const state of ["queued", "running", "downloaded", "verified", "failed", "cancelled"]) {
    StartGoodwillRunResponse.parse({ ...examples.run, state });
  }
  for (const state of ["received", "validated", "reconciled", "published", "partial", "duplicate", "quarantined", "failed", "superseded"]) {
    CreateGoodwillBatchResponse.parse({ ...examples.batch, state });
  }
  const unavailable = QueryGoodwillMetricsResponse.parse({
    ...examples.metric, value: null, publicationId: null, publishedAt: null,
    points: [], batchIds: [], coverage: [{ ...examples.metric.coverage[0], status: "missing" }],
  });
  assert.equal(unavailable.value, null);
  assert.equal(examples.batch.acceptedRows + examples.batch.rejectedRows + examples.batch.duplicateRows, examples.batch.inputRows);
});

test("structural guards reject fractional money, oversized uploads and unconfirmed corrections", () => {
  assert.equal(QueryGoodwillMetricsResponse.safeParse({ ...examples.metric, value: 12.34 }).success, false);
  assert.equal(StartGoodwillRunResponse.safeParse({ ...examples.run, attempt: 3 }).success, false);
  assert.equal(RequestGoodwillUploadBody.safeParse({
    sourceId: "ebay", reportType: "listing_sales", filename: "synthetic.csv",
    checksum: "0".repeat(64), byteSize: 5242881,
  }).success, false);
  assert.equal(ReviewGoodwillBatchBody.safeParse({
    action: "approve_supersession", expectedPublicationId: "example-publication",
    reason: "Reviewed synthetic correction", confirmSyntheticOnly: false,
  }).success, false);
});