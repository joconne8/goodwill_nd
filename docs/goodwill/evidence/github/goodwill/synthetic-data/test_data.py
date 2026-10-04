"""Fixture integrity checks, not a certification of an application's importer."""
import csv
import hashlib
import json
import subprocess
import sys
import unittest
from collections import Counter
from datetime import date, datetime
from decimal import Decimal as D
from pathlib import Path

from generate import FILES, ROOT, SCHEMAS


def load(name):
    with (ROOT/name).open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


class FixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tables = {name: load(name) for name in SCHEMAS}
        cls.manifest = json.loads((ROOT/"manifest.json").read_text())

    def test_headers_counts_checksums(self):
        self.assertTrue(self.manifest["synthetic"])
        for name, rows in self.tables.items():
            with (ROOT/name).open(encoding="utf-8") as handle:
                self.assertEqual(handle.readline().strip(), SCHEMAS[name])
            self.assertEqual(len(rows), self.manifest["files"][name]["rows"])
            self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),
                             self.manifest["files"][name]["sha256"])
            self.assertGreater(len(rows), 0)

    def test_cent_exact_financial_formulas(self):
        formulas = {
            FILES["CM"]: ("payout_amount", ["item_revenue", "shipping_revenue"], ["refund_amount", "payment_fee"]),
            FILES["UP"]: ("net_sales", ["gross_sales", "shipping_collected"], ["refund_amount"]),
            FILES["JWL"]: ("net_sales", ["gross_sales"], ["appraisal_fee", "commission_fee"]),
            FILES["SGW"]: ("net_sales", ["gross_sales", "buyer_premium", "shipping_collected"], ["refund_amount"]),
            FILES["GWB"]: ("net_payout", ["gross_sales", "shipping_credit"], ["refund_amount", "marketplace_fee"]),
            FILES["EB"]: ("payout_amount", ["sale_amount", "shipping_paid"], ["refund_amount", "ebay_fee"]),
            FILES["AMZ"]: ("net_proceeds", ["product_sales", "shipping_credits"],
                          ["promo_rebates", "selling_fees", "fba_or_shipping_fees", "refunds"]),
            "05_fedex_charges_refunds_aug2026.csv": ("net_amount", ["charge_amount"], ["refund_amount"]),
        }
        for name, (net, plus, minus) in formulas.items():
            for row in self.tables[name]:
                self.assertEqual(D(row[net]), sum((D(row[f]) for f in plus), D(0)) -
                                 sum((D(row[f]) for f in minus), D(0)), (name, row))
        for name, totals in self.manifest["control_totals"].items():
            for field, expected in totals.items():
                self.assertEqual(sum((D(r[field]) for r in self.tables[name]), D(0)), D(expected))

    def test_primary_keys_and_store_coverage(self):
        store_ids = {r["store_id"] for r in self.tables["10_stores.csv"]}
        self.assertEqual(len(store_ids), 24)
        keys = {"CM": "order_id", "UP": "paid_order_id", "JWL": "item_id",
                "SGW": "order_id", "GWB": "order_id", "EB": "transaction_id",
                "AMZ": "amazon_order_id"}
        for prefix, key in keys.items():
            rows = self.tables[FILES[prefix]]
            self.assertEqual(len({r[key] for r in rows}), len(rows))
            self.assertEqual({r["store_id"] for r in rows if r["store_id"]}, store_ids)
        for rows in self.tables.values():
            for row in rows:
                if row.get("store_id"):
                    self.assertIn(row["store_id"], store_ids)

    def test_shipping_foreign_keys_dates_and_uniqueness(self):
        lifecycle = {r["order_id"]: r for r in self.tables["15_order_lifecycle.csv"]}
        orders = {}
        for prefix, key, day in [("CM", "order_id", "order_date"), ("UP", "paid_order_id", "paid_at"),
                                  ("SGW", "order_id", "sale_date"), ("EB", "transaction_id", "sale_date"),
                                  ("AMZ", "amazon_order_id", "posted_date")]:
            for row in self.tables[FILES[prefix]]:
                orders[row[key]] = (row, date.fromisoformat(row[day][:10]))
        for row in self.tables[FILES["GWB"]]:
            orders[row["order_id"]] = (row, date.fromisoformat(lifecycle[row["order_id"]]["ordered_at"][:10]))
        shipments = self.tables["04_shipping_osm_pb_easypost_aug2026.csv"] + self.tables["05_fedex_charges_refunds_aug2026.csv"]
        self.assertEqual(len({r["order_id"] for r in shipments}), len(shipments))
        self.assertEqual(len({r["transaction_id"] for r in shipments}), len(shipments))
        for row in shipments:
            self.assertIn(row["order_id"], orders)
            sale, sold = orders[row["order_id"]]
            ship = date.fromisoformat(row["ship_date"])
            self.assertGreaterEqual(ship, sold)
            self.assertEqual(ship.month, 8)
            self.assertLess(ship.weekday(), 5)
            self.assertEqual(str(ship), lifecycle[row["order_id"]]["ship_date"])
            if "store_id" in row:
                self.assertEqual(row["store_id"], sale["store_id"])
        self.assertEqual(set(lifecycle), set(orders))
        shipped = {r["order_id"] for r in lifecycle.values() if r["fulfillment_status"] == "shipped"}
        self.assertEqual(shipped, {r["order_id"] for r in shipments})
        for row in lifecycle.values():
            source = self.tables[row["source_file"]][int(row["source_row_id"])-1]
            self.assertIn(row["order_id"], source.values())
            if row["refund_recorded_at"]:
                self.assertGreaterEqual(row["refund_recorded_at"], row["ordered_at"])
                self.assertLessEqual(row["refund_recorded_at"], self.manifest["as_of"])
                if row["ship_date"]:
                    self.assertGreaterEqual(row["refund_recorded_at"][:10], row["ship_date"])

    def test_catalog_listing_and_complete_snapshots(self):
        catalog = {r["item_id"]: r for r in self.tables["13_item_catalog.csv"]}
        self.assertEqual(len(catalog), len(self.tables["13_item_catalog.csv"]))
        listings = {r["listing_id"]: r for r in self.tables["11_listing_events_aug2026.csv"]}
        self.assertEqual(len(listings), len(self.tables["11_listing_events_aug2026.csv"]))
        for entry in catalog.values():
            received = datetime.fromisoformat(entry["received_at"])
            if entry["listed_at"]:
                listed = datetime.fromisoformat(entry["listed_at"])
                self.assertGreater(listed, received)
                self.assertIn(entry["listing_id"], listings)
                self.assertEqual(listings[entry["listing_id"]]["item_id"], entry["item_id"])
                if entry["sold_at"]:
                    self.assertGreater(datetime.fromisoformat(entry["sold_at"]), listed)
        for prefix in ["SGW", "EB"]:
            for row in self.tables[FILES[prefix]]:
                entry = catalog[row["item_id"]]
                self.assertEqual(row["store_id"], entry["store_id"])
                self.assertEqual(row["sale_date"], entry["sold_at"][:10])
                if prefix == "EB":
                    self.assertEqual(row["listing_id"], entry["listing_id"])
        snapshots = self.tables["12_inventory_snapshots_aug2026.csv"]
        self.assertEqual(len({(r["snapshot_at"], r["item_id"]) for r in snapshots}), len(snapshots))
        for cutoff, control in self.manifest["inventory_controls"].items():
            expected = {key for key, entry in catalog.items() if entry["received_at"] <= cutoff
                        and (not entry["sold_at"] or entry["sold_at"] > cutoff or
                             (entry["canceled_at"] and entry["canceled_at"] <= cutoff))}
            actual = [r for r in snapshots if r["snapshot_at"] == cutoff]
            self.assertEqual({r["item_id"] for r in actual}, expected)
            self.assertEqual(len(actual), control["total_inventory"])
            self.assertEqual(sum(r["workflow_state"] != "listed" for r in actual), control["unlisted_backlog"])
            self.assertEqual(dict(Counter(r["workflow_state"] for r in actual)), control["workflow_states"])
            for row in actual:
                entry = catalog[row["item_id"]]
                self.assertEqual(row["store_id"], entry["store_id"])
                self.assertEqual(row["workflow_state"] == "listed",
                                 bool(entry["listed_at"] and entry["listed_at"] <= cutoff and
                                      not (entry["canceled_at"] and entry["canceled_at"] <= cutoff)))

    def test_daily_metrics_and_repeat_buyers(self):
        for control in self.manifest["daily_core_metrics"]:
            prefix = "SGW" if control["platform"] == "ShopGoodwill" else "EB"
            field = "gross_sales" if prefix == "SGW" else "sale_amount"
            rows = [r for r in self.tables[FILES[prefix]] if r["sale_date"] == control["day"]]
            self.assertGreater(len(rows), 0)
            self.assertEqual(len(rows), control["rows"])
            self.assertEqual(sum((D(r[field])-D(r["refund_amount"]) for r in rows), D(0)),
                             D(control["net_item_revenue"]))
            self.assertEqual(len({r["buyer_id"] for r in rows if r["buyer_id"]}),
                             control["distinct_platform_buyers"])
            self.assertEqual(sum(not r["store_id"] for r in rows), control["missing_store_rows"])
        for prefix in ["SGW", "EB"]:
            rows = self.tables[FILES[prefix]]
            self.assertLess(len({r["buyer_id"] for r in rows}), len(rows)*.75)
            gross = "gross_sales" if prefix == "SGW" else "sale_amount"
            self.assertTrue(any(D(r["refund_amount"]) == D(r[gross]) for r in rows))
            self.assertTrue(any(D(0) < D(r["refund_amount"]) < D(r[gross]) for r in rows))

    def test_exception_ledger_is_exhaustive(self):
        actual = set()
        for name in FILES.values():
            for n, row in enumerate(self.tables[name], 1):
                for field in ["store_id", "buyer_id", "supplier"]:
                    if field in row and not row[field]:
                        actual.add((name, str(n), field))
        ledger = self.tables["14_quality_exceptions.csv"]
        self.assertEqual(actual, {(r["source_file"], r["source_row_id"], r["field"]) for r in ledger})
        self.assertEqual(len(ledger), self.manifest["expected_exceptions"])

    def test_replay_invalid_and_incremental_fixtures(self):
        replay = load("test-fixtures/ebay_duplicate_replay.csv")
        self.assertEqual(replay, self.tables[FILES["EB"]][:25])
        bad = load("test-fixtures/ebay_invalid_rows.csv")
        self.assertEqual(len(bad), 5)
        with self.assertRaises(ValueError):
            date.fromisoformat(bad[0]["sale_date"])
        self.assertLess(D(bad[1]["sale_amount"]), 0)
        self.assertEqual(bad[2]["transaction_id"], "")
        with self.assertRaises(Exception):
            D(bad[3]["sale_amount"])
        self.assertGreater(D(bad[4]["refund_amount"]), D(bad[4]["sale_amount"]))
        for name, count in self.manifest["incremental_files"].items():
            rows = load(name)
            self.assertEqual(len(rows), count)
            self.assertEqual({r["sale_date"] for r in rows}, {"2026-09-01"})
            key = "order_id" if "shopgoodwill" in name else "transaction_id"
            prefix = "SGW" if "shopgoodwill" in name else "EB"
            self.assertFalse({r[key] for r in rows} & {r[key] for r in self.tables[FILES[prefix]]})

    def test_isbn_checksums(self):
        for row in self.tables[FILES["GWB"]]:
            isbn = row["isbn"]
            self.assertEqual(len(isbn), 13)
            self.assertEqual(sum(int(c)*(1 if i % 2 == 0 else 3)
                                 for i, c in enumerate(isbn)) % 10, 0)

    def test_reproducibility(self):
        paths = list(ROOT.glob("*.csv")) + list(ROOT.glob("*/*.csv")) + [ROOT/"manifest.json"]
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        subprocess.run([sys.executable, str(ROOT/"generate.py")], check=True, capture_output=True)
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})


if __name__ == "__main__":
    unittest.main(verbosity=2)