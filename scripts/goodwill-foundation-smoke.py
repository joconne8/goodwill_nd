"""Supervised foundation API checks; uses only the synthetic development preview."""
import csv
import hashlib
import io
import json
import os
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/api/goodwill"
FIXTURE = ROOT / "docs/goodwill/evidence/github/goodwill/synthetic-data/02_upright_paid_order_items_aug2026.csv"

def request(path, body=None):
    req = Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                  headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except HTTPError as e:
        return e.code, json.load(e)

checks = []
def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print("PASS", name)

def controls(start, end):
    rows = [r for r in csv.DictReader(FIXTURE.open()) if start <= r["paid_at"][:10] <= end]
    gross = sum(Decimal(r["gross_sales"]) for r in rows)
    refunds = sum(Decimal(r["refund_amount"]) for r in rows)
    return len(rows), int(gross * 100), int(refunds * 100), int((gross - refunds) * 100)

examples = ROOT / "docs/goodwill/contracts/examples"
examples.mkdir(parents=True, exist_ok=True)

status, sources = request("/sources")
check("nine source workflows; no live connection implied", status == 200 and len(sources) == 9 and sum(s["status"] == "synthetic_fixture" for s in sources) == 1)
previous_checksum = None
for start, end in [("2026-08-01", "2026-08-07"), ("2026-08-08", "2026-08-14"), ("2026-08-01", "2026-08-31")]:
    period = {"startDate": start, "endDate": end}
    status, report = request("/report", period)
    check(f"{start}..{end}: real generated file identity", status == 200 and hashlib.sha256(report["csv"].encode()).hexdigest() == report["checksum"])
    if previous_checksum:
        check("changed date range changes file", previous_checksum != report["checksum"])
    previous_checksum = report["checksum"]
    status, result = request("/imports", report)
    expected = controls(start, end)
    check(f"{start}..{end}: persisted totals match independent Decimal oracle",
          status == 200 and (result["acceptedRows"], result["grossMinor"], result["refundMinor"], result["netMinor"]) == expected)
    status, replay = request("/imports", report)
    check("same file replay retains identity and never adds totals", status == 200 and replay == result)
    status, latest = request("/latest")
    check("reload/other-session API sees the published result", status == 200 and latest["result"]["importId"] == result["importId"])

# The final visible state is full August, not a sum of overlapping publications.
status, baseline = request("/latest")
check("full month does not accumulate prior overlapping periods", baseline["result"]["netMinor"] == 3615710 and baseline["result"]["acceptedRows"] == 650)
bad_cases = [
    ("wrong checksum", {**report, "csv": report["csv"] + "\n"}, "CHECKSUM_MISMATCH"),
    ("wrong period", {**report, "startDate": "2026-08-02"}, "WRONG_PERIOD"),
    ("unsupported period", {**report, "endDate": "2026-09-01"}, "UNSUPPORTED_PERIOD"),
    ("unsupported contract", {**report, "contractVersion": "2.0.0"}, "INVALID_REPORT"),
]
for label, bad, code in bad_cases:
    status, error = request("/imports", bad)
    check(label + " rejected", status == 400 and error["code"] == code)
    _, latest = request("/latest")
    check(label + " leaves last good unchanged", latest == baseline)

lines = report["csv"].strip().splitlines()
for label, text, code in [
    ("duplicate row", "\n".join(lines + [lines[1]]) + "\n", "DUPLICATE_ROW"),
    ("empty file", lines[0] + "\n", "EMPTY_REPORT"),
    ("malformed header", "wrong,header\n1,2\n", "INVALID_HEADER"),
    ("edited source", report["csv"].replace("32.62", "33.62", 1), "UNKNOWN_SYNTHETIC_REPORT"),
]:
    bad = {**report, "csv": text, "checksum": hashlib.sha256(text.encode()).hexdigest()}
    status, error = request("/imports", bad)
    check(label + " rejected", status == 400 and error["code"] == code)
    _, latest = request("/latest")
    check(label + " leaves last good unchanged", latest == baseline)

# These are generated outputs, not hand-authored competing fixtures.
(examples / "generated-report.json").write_text(json.dumps(report, indent=2) + "\n")
(examples / "published-result.json").write_text(json.dumps(baseline["result"], indent=2) + "\n")
(examples / "downloaded-report.csv").write_bytes(report["csv"].encode())
(examples / "expected-controls.json").write_text(json.dumps({
    "authority": "independent Python csv + Decimal calculation of the merged fixture",
    "fixtureSha256": hashlib.sha256(FIXTURE.read_bytes()).hexdigest(),
    "periods": [
        {"startDate": a, "endDate": b, "rows": controls(a, b)[0], "grossMinor": controls(a, b)[1],
         "refundMinor": controls(a, b)[2], "netMinor": controls(a, b)[3]}
        for a, b in [("2026-08-01", "2026-08-31"), ("2026-08-01", "2026-08-07"), ("2026-08-08", "2026-08-14")]
    ]
}, indent=2) + "\n")
print(json.dumps({"passed": len(checks), "checks": checks, "latestImport": baseline["result"]["importId"]}, indent=2))