"""Independent Decimal controls: never imports application parsers or metrics."""
import csv
import hashlib
import json
from decimal import Decimal
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pack = root / "docs/goodwill/evidence/github/goodwill/synthetic-data"
tree = json.loads((root / "docs/goodwill/evidence/target/tree.json").read_text())
checked = 0
newline_only = 0
for item in tree["tree"]:
    if item["type"] != "blob" or not item["path"].startswith("synthetic-data/"):
        continue
    file = pack / item["path"].removeprefix("synthetic-data/")
    body = file.read_bytes()
    git_hash = lambda b: hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()
    if git_hash(body) != item["sha"]:
        # The historical repository snapshot uses CRLF; goodwill_nd has LF.
        # No other content difference is accepted and neither fixture is rewritten.
        assert git_hash(body.replace(b"\r\n", b"\n")) == item["sha"], f"Upstream fixture altered: {file.name}"
        newline_only += 1
    checked += 1

files = sorted(pack.glob("[0-9]*.csv"))
rows = {f.name: list(csv.DictReader(f.open(newline=""))) for f in files}
assert len(rows) == 15 and sum(map(len, rows.values())) == 27544
manifest = json.loads((pack / "manifest.json").read_text())
for name, amounts in manifest["control_totals"].items():
    for field, expected in amounts.items():
        actual = sum((Decimal(row[field]) for row in rows[name]), Decimal(0))
        assert actual == Decimal(expected), (name, field, actual, expected)

# Hand-checkable source controls: separate source net item fields, never summed.
financial = [
    (1, "item_revenue", "refund_amount", 1032846),
    (2, "gross_sales", "refund_amount", 3615710),
    (6, "gross_sales", "refund_amount", 11126218),
    (7, "gross_sales", "refund_amount", 918493),
    (8, "sale_amount", "refund_amount", 5551526),
    (9, "product_sales", "refunds", 1306005),
]
for number, gross, refunds, expected in financial:
    data = next(v for k, v in rows.items() if k.startswith(f"{number:02}_"))
    actual = sum((Decimal(r[gross]) - Decimal(r[refunds]) for r in data), Decimal(0)) * 100
    assert actual == expected, (number, actual, expected)

unlisted = {"received", "awaiting_inspection", "awaiting_photography", "ready_to_list"}
inventory = rows["12_inventory_snapshots_aug2026.csv"]
for instant, expected in manifest["inventory_controls"].items():
    selected = [r for r in inventory if r["snapshot_at"] == instant]
    assert len({r["item_id"] for r in selected}) == expected["total_inventory"]
    assert sum(r["workflow_state"] in unlisted for r in selected) == expected["unlisted_backlog"]
print(f"PASS: {checked} target files match ({newline_only} differ only in CRLF/LF); 15 base datasets / 27,544 records; "
      "all manifest money controls, six separate item controls, three separate snapshots")