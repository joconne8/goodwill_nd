import test from "node:test";
import assert from "node:assert/strict";
import {setup, file, upload, august} from "../../../../artifacts/api-server/tests/data/helpers";

// TEST ONLY: injected MemoryRepository/MemoryArchive from the feature's test helpers.
test("same bytes are replay-identical only inside the exact period; wrong-period and malformed attempts preserve last-good", async () => {
  const env = await setup();
  const bytes = await file("08_ebay_listing_sales_aug2026.csv");
  const wrongPeriod = {startDate: "2026-08-02", endDate: "2026-08-31"};
  const first = await upload(env, "ebay", "listing_sales", bytes, wrongPeriod, "wrong-period.csv");
  assert.equal(first.state, "quarantined");
  assert.equal(first.failure?.code, "RECONCILIATION_MISMATCH");
  const firstQuarantine = structuredClone(first);

  const accepted = await upload(env, "ebay", "listing_sales", bytes, august, "corrected-period.csv");
  assert.equal(accepted.state, "published", JSON.stringify(accepted.failure));
  assert.equal(accepted.inputRows, 900);
  assert.equal(accepted.acceptedRows, 900);
  assert.equal(accepted.rejectedRows, 0);
  assert.equal(accepted.duplicateRows, 0);
  const acceptedQuery = {sourceId: "ebay", metricId: "net_item_sales", period: august, groupBy: "none"};
  const published = await env.reporting.query(acceptedQuery);
  assert.equal(published.result.value, 5_551_526); // $55,515.26, integer cents
  assert.equal(published.result.publicationId, accepted.publicationId);

  const replay = await upload(env, "ebay", "listing_sales", bytes, august, "same-scope-replay.csv");
  assert.equal(replay.state, "duplicate");
  assert.equal(replay.duplicateOf, accepted.id);
  assert.equal(replay.publicationId, accepted.publicationId);

  const malformed = Buffer.from("not,a,valid,ebay,header\none,two,three,four,five\n");
  const malformedWrongPeriod = {startDate: "2026-07-01", endDate: "2026-07-31"};
  const badFirst = await upload(env, "ebay", "listing_sales", malformed, malformedWrongPeriod, "bad.csv");
  assert.equal(badFirst.state, "quarantined");
  assert.equal(badFirst.failure?.code, "INVALID_HEADER");
  const badCorrectedScope = await upload(env, "ebay", "listing_sales", malformed, august, "bad.csv");
  assert.equal(badCorrectedScope.state, "quarantined");
  assert.notEqual(badCorrectedScope.state, "duplicate");
  assert.equal(badCorrectedScope.failure?.code, "INVALID_HEADER");
  assert.equal(badCorrectedScope.inputRows, 0);

  const retained = await env.reporting.query(acceptedQuery);
  assert.equal(retained.result.value, 5_551_526);
  assert.equal(retained.result.publicationId, accepted.publicationId);
  const stillQuarantined = await env.repository.transaction(tx => tx.get("batches", first.id));
  assert.deepEqual(stillQuarantined, firstQuarantine);
});