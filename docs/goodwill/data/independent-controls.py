"""Read unchanged original bytes with Python CSV/Decimal, never application code."""
import csv, json, pathlib, hashlib
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1] / "evidence/github/goodwill/synthetic-data"
rows = {p.name: list(csv.DictReader(p.open(newline=""))) for p in sorted(ROOT.glob("*.csv"))}
manifest = json.loads((ROOT / "manifest.json").read_text())
sources = [
    ("cash_monkey", "01", "item_revenue", "refund_amount", "order_date"),
    ("upright", "02", "gross_sales", "refund_amount", "paid_at"),
    ("shopgoodwill", "06", "gross_sales", "refund_amount", "sale_date"),
    ("goodwill_books", "07", "gross_sales", "refund_amount", None),
    ("ebay", "08", "sale_amount", "refund_amount", "sale_date"),
    ("amazon", "09", "product_sales", "refunds", "posted_date"),
]
def cents(value):
    result = Decimal(value) * 100
    assert result == int(result)
    return int(result)
def eastern(value):
    return datetime.fromisoformat(value).astimezone(ZoneInfo("America/New_York")).date().isoformat() if "T" in value else value
def file(prefix):
    return next(name for name in rows if name.startswith(prefix + "_"))
expected = {"files": {}, "net_items": {}, "source_net": {}, "expenses": {}, "customers": {}, "listings": {}, "snapshots": {}}
for name, values in rows.items():
    checksum = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    assert checksum == manifest["files"][name]["sha256"]
    assert len(values) == manifest["files"][name]["rows"]
    expected["files"][name] = {"rows": len(values), "sha256": checksum}
    for field, control in manifest["control_totals"].get(name, {}).items():
        assert sum(cents(r[field]) for r in values) == cents(control), (name, field)
for source, prefix, gross, refund, basis in sources:
    values = rows[file(prefix)]
    expected["net_items"][source] = sum(cents(r[gross]) - cents(r[refund]) for r in values)
    if basis and "buyer_id" in values[0]:
        daily = {}
        for r in values:
            date = eastern(r[basis]); daily.setdefault(date, set())
            if r["buyer_id"]: daily[date].add(r["buyer_id"])
        expected["customers"][source] = {date: len(ids) for date, ids in sorted(daily.items())}
for source, prefix, field in [
    ("cash_monkey","01","payout_amount"),("upright","02","net_sales"),("jewelry","03","net_sales"),
    ("shopgoodwill","06","net_sales"),("goodwill_books","07","net_payout"),("ebay","08","payout_amount"),("amazon","09","net_proceeds"),
]:
    expected["source_net"][source] = sum(cents(r[field]) for r in rows[file(prefix)])
expected["expenses"]["shipping"] = sum(cents(r["postage_amount"]) + cents(r["adjustment_amount"]) for r in rows[file("04")])
expected["expenses"]["fedex"] = sum(cents(r["charge_amount"]) - cents(r["refund_amount"]) for r in rows[file("05")])
for platform, source in [("ShopGoodwill","shopgoodwill"),("eBay","ebay")]:
    expected["listings"][source] = len({r["listing_id"] for r in rows[file("11")] if r["platform"] == platform and "2026-08-01" <= eastern(r["listed_at"]) <= "2026-08-31"})
catalog = {r["item_id"]: r for r in rows[file("13")]}
for at, control in manifest["inventory_controls"].items():
    cutoff = datetime.fromisoformat(at)
    scope = {item for item, r in catalog.items() if datetime.fromisoformat(r["received_at"]) <= cutoff and (
        not r["sold_at"] or datetime.fromisoformat(r["sold_at"]) > cutoff or r["canceled_at"] and datetime.fromisoformat(r["canceled_at"]) <= cutoff)}
    snapshot = [r for r in rows[file("12")] if r["snapshot_at"] == at]
    assert {r["item_id"] for r in snapshot} == scope
    assert len(snapshot) == control["total_inventory"]
    assert sum(r["workflow_state"] != "listed" for r in snapshot) == control["unlisted_backlog"]
    expected["snapshots"][at] = {
        source: sum(r["workflow_state"] != "listed" and catalog[r["item_id"]]["platform"] == platform for r in snapshot)
        for platform, source in [("ShopGoodwill", "shopgoodwill"), ("eBay", "ebay")]
    }
assert expected["net_items"] == dict(cash_monkey=1032846, upright=3615710, shopgoodwill=11126218, goodwill_books=918493, ebay=5551526, amazon=1306005)
assert expected["source_net"]["jewelry"] == 1799730
assert expected["expenses"] == dict(shipping=3281419, fedex=2012104)
print(json.dumps(expected, sort_keys=True))