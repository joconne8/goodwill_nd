import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {seedFixturePack, datasets} from "../../../../artifacts/api-server/src/goodwill/data";
import {setup, root, file} from "../../../../artifacts/api-server/tests/data/helpers";

const oracle = JSON.parse(await readFile("docs/goodwill/verification/independent/oracle-output.json", "utf8"));
const period = {startDate: "2026-08-01", endDate: "2026-08-31"};
const query = (sourceId: string, metricId: string, extra: object = {}) =>
  ({sourceId, metricId, period, groupBy: "none", ...extra});

test("independent fixture oracle agrees with injected feature-service outputs", async () => {
  const env = await setup();
  const batches = await seedFixturePack(env.intake, root, {confirmSyntheticOnly: true, owner: "independent-qa"},
    async (url, bytes) => { env.archive.inbox.set(url.split("/").at(-1)!, bytes); });
  assert.equal(batches.length, 15);
  for (const [index, batch] of batches.entries()) {
    const expected = oracle.input_integrity[datasets[index].filename];
    assert.equal(batch.state, "published", `${batch.datasetId}: ${JSON.stringify(batch.failure)}`);
    assert.equal(batch.inputRows, expected.rows);
    assert.equal(batch.artifact?.checksum, expected.sha256);
  }

  for (const [metric, expectedMap] of [
    ["net_item_sales", oracle.net_item_sales_cents],
    ["source_net", oracle.source_net_cents],
    ["shipping_expense", oracle.carrier_expense_cents],
  ]) {
    for (const [sourceId, expected] of Object.entries(expectedMap as Record<string, number>)) {
      const {result, evidence} = await env.reporting.query(query(sourceId, metric));
      assert.equal(result.value, expected, `${sourceId}/${metric}`);
      assert.equal(result.points.reduce((sum, point) => sum + point.value, 0), expected);
      assert.equal(evidence.reduce((sum, row) => sum + Number(row.values.metricValue), 0), expected);
    }
  }

  for (const sourceId of ["shopgoodwill", "ebay"]) {
    const expectedDays = oracle.daily_shopgoodwill_ebay[sourceId];
    const customers = await env.reporting.query(query(sourceId, "daily_customers", {groupBy: "day"}));
    assert.equal(customers.result.value, null);
    assert.deepEqual(Object.fromEntries(customers.result.points.map(p => [p.key, p.value])),
      Object.fromEntries(Object.entries(expectedDays).map(([day, value]) => [day, (value as any).distinct_buyers])));
    const net = await env.reporting.query(query(sourceId, "net_item_sales", {groupBy: "day"}));
    assert.deepEqual(Object.fromEntries(net.result.points.map(p => [p.key, p.value])),
      Object.fromEntries(Object.entries(expectedDays).map(([day, value]) => [day, (value as any).net_item_sales_cents])));
  }

  const listingPeriodFilters = [
    ["2026-06", "2026-06-01", "2026-06-30"],
    ["2026-07", "2026-07-01", "2026-07-31"],
    ["2026-08", "2026-08-01", "2026-08-31"],
  ];
  for (const [month, startDate, endDate] of listingPeriodFilters) {
    for (const sourceId of ["shopgoodwill", "ebay"]) {
      const platform = sourceId === "ebay" ? "eBay" : "ShopGoodwill";
      const expected = oracle.listing_counts.filters[`${month}|${platform}`];
      const listingQuery = {sourceId, metricId: "listings", period: {startDate, endDate}, groupBy: "none"};
      assert.equal((await env.reporting.query(listingQuery)).result.value, expected.distinct_listings, `${month}/${sourceId}`);
      for (const [storeId, count] of Object.entries(expected.by_store as Record<string, number>)) {
        assert.equal((await env.reporting.query({...listingQuery, storeId: storeId || "__unknown__"})).result.value, count,
          `${month}/${sourceId}/${storeId}`);
      }
    }
  }

  for (const [snapshotAt, snapshot] of Object.entries(oracle.snapshot_universes) as [string, any][]) {
    for (const [platform, sourceId] of [["eBay", "ebay"], ["ShopGoodwill", "shopgoodwill"]]) {
      const expected = snapshot.by_platform[platform];
      const {result, evidence} = await env.reporting.query(query(sourceId, "backlog", {snapshotAt, groupBy: "category"}));
      assert.equal(result.value, expected.unlisted_backlog, `${snapshotAt}/${sourceId}`);
      assert.equal(evidence.length, expected.unlisted_backlog, `${snapshotAt}/${sourceId} evidence`);
    }
  }
  assert.deepEqual(Buffer.from(await file("08_ebay_listing_sales_aug2026.csv")),
    Buffer.from(await env.archive.read(batches[7].artifact!.artifactId)));
});