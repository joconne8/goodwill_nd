#!/usr/bin/env python3
"""Independent Decimal-based ledger oracle for the immutable Goodwill fixture pack."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2] / "evidence/github/goodwill/synthetic-data"
MANIFEST = json.loads((ROOT / "manifest.json").read_text())


def dec(row: dict[str, str], field: str) -> Decimal:
    return Decimal(row[field])


def cents(value: Decimal) -> int:
    scaled = value * 100
    if scaled != scaled.to_integral_value():
        raise AssertionError(f"non-cent amount {value}")
    return int(scaled)


def load(name: str) -> list[dict[str, str]]:
    with (ROOT / name).open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def total(rows: list[dict[str, str]], formula) -> int:
    return cents(sum((formula(row) for row in rows), Decimal(0)))


def dates(row: dict[str, str], field: str) -> str:
    return row[field][:10]


def main() -> None:
    integrity = {}
    all_rows = {}
    for name, control in MANIFEST["files"].items():
        raw = (ROOT / name).read_bytes()
        rows = load(name)
        digest = hashlib.sha256(raw).hexdigest()
        assert digest == control["sha256"], f"{name}: SHA256 {digest} != manifest"
        assert len(rows) == control["rows"], f"{name}: row count {len(rows)} != manifest"
        integrity[name] = {"rows": len(rows), "sha256": digest, "pass": True}
        all_rows[name] = rows

    names = {key: key for key in MANIFEST["files"]}
    source_rows = {
        "cash_monkey": all_rows[names["01_cash_monkey_orders_aug2026.csv"]],
        "upright": all_rows[names["02_upright_paid_order_items_aug2026.csv"]],
        "jewelry": all_rows[names["03_jewelry_report_aug2026.csv"]],
        "shipping": all_rows[names["04_shipping_osm_pb_easypost_aug2026.csv"]],
        "fedex": all_rows[names["05_fedex_charges_refunds_aug2026.csv"]],
        "shopgoodwill": all_rows[names["06_shopgoodwill_periodic_reports_aug2026.csv"]],
        "goodwill_books": all_rows[names["07_goodwill_books_payment_statement_aug2026.csv"]],
        "ebay": all_rows[names["08_ebay_listing_sales_aug2026.csv"]],
        "amazon": all_rows[names["09_amazon_payments_summary_aug2026.csv"]],
    }
    net_items = {
        "cash_monkey": total(source_rows["cash_monkey"], lambda r: dec(r, "item_revenue") - dec(r, "refund_amount")),
        "upright": total(source_rows["upright"], lambda r: dec(r, "gross_sales") - dec(r, "refund_amount")),
        "shopgoodwill": total(source_rows["shopgoodwill"], lambda r: dec(r, "gross_sales") - dec(r, "refund_amount")),
        "goodwill_books": total(source_rows["goodwill_books"], lambda r: dec(r, "gross_sales") - dec(r, "refund_amount")),
        "ebay": total(source_rows["ebay"], lambda r: dec(r, "sale_amount") - dec(r, "refund_amount")),
        "amazon": total(source_rows["amazon"], lambda r: dec(r, "product_sales") - dec(r, "refunds")),
    }
    source_net = {
        "cash_monkey": total(source_rows["cash_monkey"], lambda r: dec(r, "item_revenue") + dec(r, "shipping_revenue") - dec(r, "refund_amount") - dec(r, "payment_fee")),
        "upright": total(source_rows["upright"], lambda r: dec(r, "gross_sales") + dec(r, "shipping_collected") - dec(r, "refund_amount")),
        "jewelry": total(source_rows["jewelry"], lambda r: dec(r, "gross_sales") - dec(r, "appraisal_fee") - dec(r, "commission_fee")),
        "shopgoodwill": total(source_rows["shopgoodwill"], lambda r: dec(r, "gross_sales") + dec(r, "buyer_premium") + dec(r, "shipping_collected") - dec(r, "refund_amount")),
        "goodwill_books": total(source_rows["goodwill_books"], lambda r: dec(r, "gross_sales") + dec(r, "shipping_credit") - dec(r, "refund_amount") - dec(r, "marketplace_fee")),
        "ebay": total(source_rows["ebay"], lambda r: dec(r, "sale_amount") + dec(r, "shipping_paid") - dec(r, "refund_amount") - dec(r, "ebay_fee")),
        "amazon": total(source_rows["amazon"], lambda r: dec(r, "product_sales") + dec(r, "shipping_credits") - dec(r, "promo_rebates") - dec(r, "selling_fees") - dec(r, "fba_or_shipping_fees") - dec(r, "refunds")),
    }
    expenses = {
        "shipping": total(source_rows["shipping"], lambda r: dec(r, "postage_amount") + dec(r, "adjustment_amount")),
        "fedex": total(source_rows["fedex"], lambda r: dec(r, "charge_amount") - dec(r, "refund_amount")),
    }
    control_totals_cents = {
        name: {field: total(all_rows[name], lambda row, field=field: dec(row, field))
               for field in fields}
        for name, fields in MANIFEST["control_totals"].items()
    }
    for name, fields in MANIFEST["control_totals"].items():
        for field, expected in fields.items():
            assert control_totals_cents[name][field] == cents(Decimal(expected)), f"{name}/{field} manifest control"

    daily = {}
    missing_ordinals = {}
    for source in ("shopgoodwill", "ebay"):
        name = "06_shopgoodwill_periodic_reports_aug2026.csv" if source == "shopgoodwill" else "08_ebay_listing_sales_aug2026.csv"
        rows = source_rows[source]
        groups = defaultdict(lambda: {"rows": 0, "gross_item_sales_cents": 0, "refunds_cents": 0, "net_item_sales_cents": 0, "buyers": set(), "missing_buyer_rows": 0, "missing_store_rows": 0})
        for row in rows:
            day = dates(row, "sale_date")
            gross_field = "gross_sales" if source == "shopgoodwill" else "sale_amount"
            refund_field = "refund_amount"
            g = groups[day]
            gross, refund = cents(dec(row, gross_field)), cents(dec(row, refund_field))
            g["rows"] += 1
            g["gross_item_sales_cents"] += gross
            g["refunds_cents"] += refund
            g["net_item_sales_cents"] += gross - refund
            if row.get("buyer_id", "").strip():
                g["buyers"].add(row["buyer_id"])
            else:
                g["missing_buyer_rows"] += 1
            if not row.get("store_id", "").strip():
                g["missing_store_rows"] += 1
        daily[source] = {
            day: {**{k: v for k, v in value.items() if k != "buyers"}, "distinct_buyers": len(value["buyers"])}
            for day, value in sorted(groups.items())
        }
    for control in MANIFEST["daily_core_metrics"]:
        source = "shopgoodwill" if control["platform"] == "ShopGoodwill" else "ebay"
        calculated = daily[source][control["day"]]
        assert calculated["rows"] == control["rows"]
        assert calculated["distinct_buyers"] == control["distinct_platform_buyers"]
        assert calculated["gross_item_sales_cents"] == cents(Decimal(control["gross_item_sales"]))
        assert calculated["refunds_cents"] == cents(Decimal(control["refunds"]))
        assert calculated["net_item_sales_cents"] == cents(Decimal(control["net_item_revenue"]))
        assert calculated["missing_store_rows"] == control["missing_store_rows"]

    for filename, rows in all_rows.items():
        fields = rows[0].keys() if rows else ()
        for field in ("buyer_id", "store_id"):
            if field in fields:
                missing_ordinals[f"{filename}:{field}"] = [i for i, row in enumerate(rows, 1) if not row.get(field, "").strip()]

    listing_rows = all_rows["11_listing_events_aug2026.csv"]
    listing_counts = {"month_platform_store": {}, "day_platform_store": {}, "platform_month": {}, "filters": {}}
    buckets = defaultdict(set)
    day_buckets = defaultdict(set)
    for row in listing_rows:
        stamp = row["listed_at"][:10]
        buckets[(stamp[:7], row["platform"], row["store_id"])].add(row["listing_id"])
        day_buckets[(stamp, row["platform"], row["store_id"])].add(row["listing_id"])
    listing_counts["month_platform_store"] = {"|".join(k): len(v) for k, v in sorted(buckets.items())}
    listing_counts["day_platform_store"] = {"|".join(k): len(v) for k, v in sorted(day_buckets.items())}
    platform_month = defaultdict(set)
    for row in listing_rows:
        platform_month[(row["platform"], row["listed_at"][:7])].add(row["listing_id"])
    listing_counts["platform_month"] = {"|".join(k): len(v) for k, v in sorted(platform_month.items())}
    for period, start, end in (("2026-08", "2026-08-01", "2026-08-31"), ("2026-06", "2026-06-01", "2026-06-30"), ("2026-07", "2026-07-01", "2026-07-31")):
        for platform in sorted({r["platform"] for r in listing_rows}):
            chosen = [r for r in listing_rows if start <= r["listed_at"][:10] <= end and r["platform"] == platform]
            listing_counts["filters"][f"{period}|{platform}"] = {
                "distinct_listings": len({r["listing_id"] for r in chosen}),
                "by_store": {store: len({r["listing_id"] for r in chosen if r["store_id"] == store})
                             for store in sorted({r["store_id"] for r in chosen})},
            }

    catalog_ids = {r["item_id"] for r in all_rows["13_item_catalog.csv"]}
    catalog = {r["item_id"]: r for r in all_rows["13_item_catalog.csv"]}
    snapshots = {}
    for at, control in MANIFEST["inventory_controls"].items():
        rows = [r for r in all_rows["12_inventory_snapshots_aug2026.csv"] if r["snapshot_at"] == at]
        item_ids = [r["item_id"] for r in rows]
        cutoff = at
        declared_scope = {
            item_id for item_id, item in catalog.items()
            if item["received_at"] <= cutoff and (
                not item["sold_at"] or item["sold_at"] > cutoff
                or (item["canceled_at"] and item["canceled_at"] <= cutoff)
            )
        }
        actual_scope = set(item_ids)
        states = defaultdict(int)
        by_platform = defaultdict(lambda: {"inventory_rows": 0, "unlisted_backlog": 0})
        for row in rows:
            states[row["workflow_state"]] += 1
            platform = catalog[row["item_id"]]["platform"]
            by_platform[platform]["inventory_rows"] += 1
            if row["workflow_state"] != "listed":
                by_platform[platform]["unlisted_backlog"] += 1
        backlog_states = {"received", "awaiting_inspection", "awaiting_photography", "ready_to_list"}
        snapshots[at] = {
            "rows": len(rows), "distinct_items": len(set(item_ids)), "duplicate_item_ids": len(item_ids) - len(set(item_ids)),
            "snapshot_items_outside_catalog": len(set(item_ids) - catalog_ids),
            "snapshot_item_ids_sha256": hashlib.sha256("\n".join(sorted(set(item_ids))).encode()).hexdigest(),
            "declared_catalog_scope_count": len(declared_scope),
            "declared_catalog_scope_missing": len(declared_scope - actual_scope),
            "outside_declared_catalog_scope": len(actual_scope - declared_scope),
            "total_inventory": len(item_ids),
            "unlisted_backlog": sum(1 for r in rows if r["workflow_state"] in backlog_states),
            "workflow_states": dict(sorted(states.items())),
            "by_platform": dict(sorted(by_platform.items())),
            "missing_store_rows": sum(1 for r in rows if not r["store_id"].strip()),
            "manifest_control": control,
        }

    exclusions = {}
    for relative, count in MANIFEST["incremental_files"].items():
        path = ROOT / relative
        exclusions[relative] = {"rows": len(load(relative)), "expected_rows": count, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "excluded_from_august": True}
    for relative in ("test-fixtures/ebay_duplicate_replay.csv", "test-fixtures/ebay_invalid_rows.csv"):
        path = ROOT / relative
        exclusions[relative] = {"rows": len(load(relative)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "excluded_from_august": True, "purpose": "opt-in replay/rejection test only"}
    replay = load("test-fixtures/ebay_duplicate_replay.csv")
    invalid = load("test-fixtures/ebay_invalid_rows.csv")
    ebay_keys = {row["transaction_id"] for row in source_rows["ebay"]}
    assert replay == source_rows["ebay"][:25]
    assert len(invalid) == 5
    try:
        date.fromisoformat(invalid[0]["sale_date"])
        raise AssertionError("invalid replay fixture date unexpectedly parsed")
    except ValueError:
        pass
    assert Decimal(invalid[1]["sale_amount"]) < 0
    assert not invalid[2]["transaction_id"]
    try:
        Decimal(invalid[3]["sale_amount"])
        raise AssertionError("invalid replay fixture amount unexpectedly parsed")
    except Exception as error:
        if isinstance(error, AssertionError):
            raise
    assert Decimal(invalid[4]["refund_amount"]) > Decimal(invalid[4]["sale_amount"])
    for relative in MANIFEST["incremental_files"]:
        inc = load(relative)
        assert all(row["sale_date"] == "2026-09-01" for row in inc)
        key = "order_id" if "shopgoodwill" in relative else "transaction_id"
        primary = {row[key] for row in source_rows["shopgoodwill" if "shopgoodwill" in relative else "ebay"]}
        assert not ({row[key] for row in inc} & primary)
    assert "incremental/" in MANIFEST["excluded_from_august"]
    assert "test-fixtures/" in MANIFEST["excluded_from_august"]

    exception_source_files = {
        "01_cash_monkey_orders_aug2026.csv", "02_upright_paid_order_items_aug2026.csv",
        "03_jewelry_report_aug2026.csv", "06_shopgoodwill_periodic_reports_aug2026.csv",
        "07_goodwill_books_payment_statement_aug2026.csv", "08_ebay_listing_sales_aug2026.csv",
        "09_amazon_payments_summary_aug2026.csv",
    }
    expected_exception_rows = {
        (name, str(ordinal), field)
        for name, rows in all_rows.items()
        if name in exception_source_files
        for ordinal, row in enumerate(rows, 1)
        for field in ("buyer_id", "store_id")
        if field in row and not row[field].strip()
    }
    declared_exception_rows = {
        (row["source_file"], row["source_row_id"], row["field"])
        for row in all_rows["14_quality_exceptions.csv"]
        if row["field"] in ("buyer_id", "store_id")
    }
    assert expected_exception_rows == declared_exception_rows

    expected_manifest = {
        "net_items": {"cash_monkey": 1032846, "upright": 3615710, "shopgoodwill": 11126218, "goodwill_books": 918493, "ebay": 5551526, "amazon": 1306005},
        "source_net": {"jewelry": 1799730},
        "expenses": {"shipping": 3281419, "fedex": 2012104},
    }
    assert net_items == expected_manifest["net_items"], (net_items, expected_manifest["net_items"])
    assert source_net["jewelry"] == expected_manifest["source_net"]["jewelry"]
    assert expenses == expected_manifest["expenses"]
    assert len(all_rows["14_quality_exceptions.csv"]) == MANIFEST["expected_exceptions"]
    assert all(v["rows"] == v["expected_rows"] for v in exclusions.values() if "expected_rows" in v)
    for value in snapshots.values():
        c = value["manifest_control"]
        assert value["total_inventory"] == c["total_inventory"]
        assert value["unlisted_backlog"] == c["unlisted_backlog"]
        assert value["workflow_states"] == c["workflow_states"]
        assert value["declared_catalog_scope_missing"] == 0
        assert value["outside_declared_catalog_scope"] == 0

    print(json.dumps({
        "input_integrity": integrity, "net_item_sales_cents": net_items, "source_net_cents": source_net,
        "carrier_expense_cents": expenses, "manifest_control_totals_cents": control_totals_cents,
        "daily_shopgoodwill_ebay": daily, "listing_counts": listing_counts,
        "snapshot_universes": snapshots, "missing_buyer_store_ordinals": missing_ordinals,
        "opt_in_exclusions": exclusions,
        "validation": {"fixture_hashes_and_counts": "PASS", "manifest_financial_controls": "PASS",
                       "daily_manifest_controls": "PASS", "inventory_controls": "PASS",
                       "base_source_missing_buyer_store_exception_ordinals": "PASS",
                       "opt_in_replay_rejection_incremental_exclusions": "PASS"},
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()