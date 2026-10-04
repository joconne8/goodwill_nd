#!/usr/bin/env python3
"""Independent exact-byte period control. No application metric/report imports."""
import csv
import hashlib
import io
from datetime import datetime, date
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs/goodwill/evidence/github/goodwill/synthetic-data/02_upright_paid_order_items_aug2026.csv"
EASTERN = ZoneInfo("America/New_York")
with SOURCE.open(encoding="utf-8", newline="") as source:
    rows = list(csv.reader(source))

for start, end, expected_count, expected_sha in [
    ("2026-08-01", "2026-08-07", 141, "f13d40cf2b281296d965a4aaa1c96d65740a6571b5e0ee448730db9e21c87436"),
    ("2026-08-08", "2026-08-14", 129, "903b5693b4d2a37fbd2ea5299800796bd21881304cdd4c9fa673b84e4be817b6"),
]:
    low, high = date.fromisoformat(start), date.fromisoformat(end)
    selected = [row for row in rows[1:]
                if low <= datetime.fromisoformat(row[1]).astimezone(EASTERN).date() <= high]
    assert len(selected) == expected_count
    text = io.StringIO(newline="")
    csv.writer(text, lineterminator="\n").writerows([rows[0], *selected])
    expected = text.getvalue().encode("utf-8")
    artifact = ROOT / f"docs/goodwill/acquisition/evidence/synthetic_upright_{start}_{end}.csv"
    actual = artifact.read_bytes()
    assert actual == expected, "Browser bytes differ from independently selected original records"
    digest = hashlib.sha256(actual).hexdigest()
    assert digest == expected_sha
    print(f"PASS {start}..{end}: {len(selected)} items, {len(actual)} bytes, sha256={digest}")