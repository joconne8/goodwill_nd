/**
 * Schema examples ONLY. Never imported by runtime code or used as API fallbacks.
 * Demonstrates one illustrative record, not claimed fixture financial controls.
 */
const at = "2026-08-31T23:59:59Z";
const period = { startDate: "2026-08-01", endDate: "2026-08-31" };
const checksum = "0".repeat(64); // illustrative identity, not real file evidence
const artifact = {
  artifactId: "example-artifact", filename: "synthetic-example.csv", checksum,
  byteSize: 120, archivedAt: at, synthetic: true,
};
const coverage = {
  datasetId: "upright", status: "partial", startDate: period.startDate,
  endDate: period.endDate, lastGoodAt: at, latestAttemptAt: at,
  missingRows: null, reason: "Illustrative contract fixture, not production coverage",
};
const definition = {
  id: "net_item_sales", version: "2.0.0", label: "Net item sales",
  formula: "SUM(grossMinor - refundMinor)", grain: "source/order/item",
  unit: "usd_cent", timeBasis: "paid_at in America/New_York",
  exclusions: ["shipping", "tax", "fees"], requiredDatasets: ["upright"],
  availabilityReason: null,
};
const query = { metricId: "net_item_sales", sourceId: "upright", period, groupBy: "none" };
export const examples = {
  run: {
    id: "example-run", request: {
      sourceId: "upright", reportType: "paid_order_items", period, scenario: "success",
    },
    state: "verified", createdAt: at, updatedAt: at, attempt: 1,
    lastStep: "Verified exact downloaded bytes", artifact, failure: null, contractVersion: "2.0.0",
  },
  intake: { sourceId: "upright", reportType: "paid_order_items", period, inputKind: "run", inputId: "example-run" },
  batch: {
    id: "example-batch", sourceId: "upright", reportType: "paid_order_items", period,
    state: "published", runId: "example-run", artifact, receivedAt: at, publishedAt: at,
    inputRows: 1, acceptedRows: 1, rejectedRows: 0, duplicateRows: 0,
    publicationId: "example-publication", duplicateOf: null, supersedesBatchId: null,
    reconciliation: [{ name: "Net items", unit: "usd_cent", expected: 900, actual: 900, difference: 0, status: "matched" }],
    warnings: ["Contract example only"], failure: null, contractVersion: "2.0.0",
  },
  metric: {
    query, definition, publicationId: "example-publication", publishedAt: at,
    value: 900, points: [{ key: "upright", value: 900, contributingRows: 1, missingBuyerRows: 0 }],
    coverage: [coverage], batchIds: ["example-batch"], warnings: ["Contract example only"],
    currency: "USD", timezone: "America/New_York", synthetic: true, contractVersion: "2.0.0",
  },
  evidence: {
    items: [{
      recordId: "example-record", sourceId: "upright", batchId: "example-batch",
      runId: "example-run", artifactId: "example-artifact", checksum, sourceRow: 1,
      disposition: "accepted", values: { grossMinor: "1000", refundMinor: "100", netMinor: "900" }, reasons: [],
    }],
    total: 1, offset: 0, limit: 100, publicationId: "example-publication",
  },
  export: {
    filename: "synthetic-contract-example.csv", contentType: "text/csv",
    csv: "source,netMinor,synthetic\nupright,900,true\n", checksum,
    synthetic: true, publicationId: "example-publication",
  },
  catalog: {
    contractVersion: "2.0.0", synthetic: true, stores: [],
    metrics: [definition], datasets: [{
      id: "upright", sourceId: "upright", reportType: "paid_order_items",
      filename: "02_upright_paid_order_items_aug2026.csv", role: "sales",
      grain: "paid_order_id + item_id", timeBasis: "paid_at",
      keyFields: ["paid_order_id", "item_id"], monetaryFields: ["gross_sales", "refund_amount"],
      supportedMetrics: ["net_item_sales", "daily_customers"], coverage,
    }],
  },
};