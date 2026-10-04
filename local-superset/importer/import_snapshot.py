#!/usr/bin/env python3
"""Validate one Goodwill aggregate snapshot, then commit it atomically."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg2

MAX_BYTES = 262_144
SAFE_INTEGER = 9_007_199_254_740_991
SOURCES = {
    "cash_monkey": {"net_item_sales", "source_net", "daily_customers"},
    "upright": {"net_item_sales", "source_net", "daily_customers"},
    "jewelry": {"source_net"},
    "shipping": {"shipping_expense"},
    "fedex": {"shipping_expense"},
    "shopgoodwill": {"net_item_sales", "source_net", "daily_customers"},
    "goodwill_books": {"source_net"},
    "ebay": {"net_item_sales", "source_net", "daily_customers"},
    "amazon": {"net_item_sales", "source_net"},
}
METRIC_UNITS = {
    "net_item_sales": "usd_cent",
    "source_net": "usd_cent",
    "shipping_expense": "usd_cent",
    "daily_customers": "count",
}
HEX_64 = re.compile(r"^[a-f0-9]{64}$")
STORE_ID = re.compile(r"^(GW-[0-9]{3}|__unknown__)$")
DAY = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


class InvalidSnapshot(ValueError):
    pass


def fail(message: str) -> None:
    raise InvalidSnapshot(message)


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            fail("JSON contains a duplicate object key.")
        result[key] = value
    return result


def exact_keys(value: Any, expected: set[str], name: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        fail(f"{name} does not match the snapshot contract.")
    return value


def integer(value: Any, name: str, minimum: int = -SAFE_INTEGER, maximum: int = SAFE_INTEGER) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        fail(f"{name} must be a safe bounded integer.")
    return value


def short_string(value: Any, name: str, maximum: int, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or len(value) > maximum or (not allow_empty and not value):
        fail(f"{name} must be a bounded string.")
    return value


def iso_instant(value: Any, name: str) -> datetime:
    if not isinstance(value, str):
        fail(f"{name} must be a timezone-qualified timestamp.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail(f"{name} must be a valid timezone-qualified timestamp.")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        fail(f"{name} must include a timezone.")
    return parsed


def validate(payload: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    snapshot = exact_keys(payload, {
        "schemaVersion", "synthetic", "snapshotId", "checksum", "scopeId", "exportedAt",
        "snapshotAgeSeconds", "sourceId", "period", "storeId", "publicationId",
        "publishedAt", "timezone", "currency", "metrics", "warnings",
    }, "Snapshot")
    if snapshot["schemaVersion"] != "goodwill-superset/1.0.0" or snapshot["synthetic"] is not True:
        fail("Only version 1 synthetic Goodwill snapshots can be imported.")
    for key in ("snapshotId", "checksum", "scopeId"):
        if not isinstance(snapshot[key], str) or not HEX_64.fullmatch(snapshot[key]):
            fail(f"{key} must be a lowercase SHA-256 value.")
    if snapshot["snapshotId"] != snapshot["checksum"]:
        fail("Snapshot ID and checksum do not agree.")

    unsigned = {key: value for key, value in snapshot.items() if key not in {"snapshotId", "checksum"}}
    canonical = json.dumps(unsigned, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    actual = hashlib.sha256(canonical).hexdigest()
    if not hmac.compare_digest(actual, snapshot["checksum"]):
        fail("Snapshot checksum does not match its contents.")

    source_id = snapshot["sourceId"]
    if source_id not in SOURCES:
        fail("Unsupported source.")
    period_obj = exact_keys(snapshot["period"], {"startDate", "endDate"}, "Period")
    try:
        start = date.fromisoformat(period_obj["startDate"])
        end = date.fromisoformat(period_obj["endDate"])
    except (TypeError, ValueError):
        fail("Period dates must be real calendar dates.")
    if start.isoformat() != period_obj["startDate"] or end.isoformat() != period_obj["endDate"]:
        fail("Period dates must use YYYY-MM-DD.")
    if end < start or (end - start).days > 366:
        fail("Snapshot period must be chronological and no longer than 367 inclusive dates.")
    if snapshot["storeId"] is not None and (
        not isinstance(snapshot["storeId"], str) or not STORE_ID.fullmatch(snapshot["storeId"])
    ):
        fail("Unsupported store scope.")
    if short_string(snapshot["publicationId"], "publicationId", 120) == "":
        fail("Publication identity is required.")
    exported = iso_instant(snapshot["exportedAt"], "exportedAt")
    published = iso_instant(snapshot["publishedAt"], "publishedAt")
    if published > exported:
        fail("Publication time cannot be later than the export time.")
    integer(snapshot["snapshotAgeSeconds"], "snapshotAgeSeconds", 0)
    if snapshot["timezone"] != "America/New_York" or snapshot["currency"] != "USD":
        fail("Unsupported time zone or currency.")
    if not isinstance(snapshot["warnings"], list) or len(snapshot["warnings"]) > 30:
        fail("Snapshot warnings exceed the contract bounds.")
    for warning in snapshot["warnings"]:
        short_string(warning, "warning", 300, allow_empty=True)

    metrics = snapshot["metrics"]
    if not isinstance(metrics, list) or not 1 <= len(metrics) <= 4:
        fail("Snapshot must contain one to four supported aggregate metrics.")
    scope_identity = json.dumps({
        "sourceId": source_id,
        "period": {"startDate": start.isoformat(), "endDate": end.isoformat()},
        "storeId": snapshot["storeId"],
    }, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if not hmac.compare_digest(hashlib.sha256(scope_identity).hexdigest(), snapshot["scopeId"]):
        fail("Scope identity does not match the selected source/date/store scope.")
    full_month = start.day == 1 and start.year == end.year and start.month == end.month
    if full_month:
        next_day = date.fromordinal(end.toordinal() + 1)
        full_month = next_day.day == 1
    if source_id == "goodwill_books" and not full_month:
        books_metric = next(
            (metric for metric in metrics if isinstance(metric, dict) and metric.get("metricId") == "source_net"),
            None,
        )
        if books_metric is None or books_metric.get("status") != "unavailable" or books_metric.get("value") is not None or books_metric.get("points"):
            fail("Goodwill Books is statement-month grain and requires a complete month.")
    seen: set[str] = set()
    for metric in metrics:
        exact_keys(metric, {
            "metricId", "label", "unit", "definitionVersion", "formula", "grain",
            "timeBasis", "availabilityReason", "status", "value", "points",
            "coverage", "warnings",
        }, "Metric")
        metric_id = metric["metricId"]
        if metric_id not in SOURCES[source_id] or metric_id in seen:
            fail("Metric is duplicate or unsupported for the selected source.")
        seen.add(metric_id)
        if metric["unit"] != METRIC_UNITS[metric_id]:
            fail("Metric unit does not match its approved definition.")
        for key, limit in (("label", 100), ("definitionVersion", 80), ("formula", 500), ("grain", 200), ("timeBasis", 200)):
            short_string(metric[key], key, limit, allow_empty=key in {"formula", "grain", "timeBasis"})
        if metric["availabilityReason"] is not None:
            short_string(metric["availabilityReason"], "availabilityReason", 500, allow_empty=True)
        status = metric["status"]
        if status not in {"available", "partial", "unavailable"}:
            fail("Unknown metric status.")
        scalar = metric["value"]
        if scalar is not None:
            integer(scalar, "metric.value")
        if not isinstance(metric["points"], list) or len(metric["points"]) > 366:
            fail("Metric points exceed the supported period bound.")
        keys: set[str] = set()
        for point in metric["points"]:
            exact_keys(point, {"key", "value", "contributingRows", "missingBuyerRows"}, "Metric point")
            point_key = short_string(point["key"], "point.key", 80)
            if point_key in keys:
                fail("Metric contains a duplicate point.")
            keys.add(point_key)
            if point["value"] is not None:
                integer(point["value"], "point.value")
            integer(point["contributingRows"], "point.contributingRows", 0, 20_000)
            integer(point["missingBuyerRows"], "point.missingBuyerRows", 0, 20_000)
            if metric_id == "daily_customers":
                if not DAY.fullmatch(point_key):
                    fail("Customer points must retain their Eastern-day grain.")
                point_date = date.fromisoformat(point_key)
                if point_date < start or point_date > end:
                    fail("Customer point lies outside the exported period.")
        coverage = metric["coverage"]
        if not isinstance(coverage, list) or len(coverage) > 2:
            fail("Coverage exceeds the source-local contract bounds.")
        for item in coverage:
            exact_keys(item, {
                "datasetId", "status", "startDate", "endDate", "lastGoodAt",
                "latestAttemptAt", "missingRows", "reason",
            }, "Coverage item")
            short_string(item["datasetId"], "coverage.datasetId", 100)
            if item["status"] not in {"missing", "complete", "partial", "stale", "failed", "unsupported"}:
                fail("Unknown coverage status.")
            short_string(item["reason"], "coverage.reason", 500, allow_empty=True)
            for key in ("startDate", "endDate"):
                if item[key] is not None:
                    if not isinstance(item[key], str) or not DAY.fullmatch(item[key]):
                        fail(f"coverage.{key} must be a calendar date or null.")
                    try:
                        if date.fromisoformat(item[key]).isoformat() != item[key]:
                            fail(f"coverage.{key} must be a calendar date or null.")
                    except ValueError:
                        fail(f"coverage.{key} must be a calendar date or null.")
            for key in ("lastGoodAt", "latestAttemptAt"):
                if item[key] is not None:
                    iso_instant(item[key], f"coverage.{key}")
            if item["missingRows"] is not None:
                integer(item["missingRows"], "coverage.missingRows", 0)
        warnings = metric["warnings"]
        if not isinstance(warnings, list) or len(warnings) > 30:
            fail("Metric warnings exceed the contract bounds.")
        for warning in warnings:
            short_string(warning, "metric warning", 300, allow_empty=True)
        has_values = scalar is not None or any(point["value"] is not None for point in metric["points"])
        if status == "unavailable" and has_values:
            fail("Unavailable metrics cannot contain values.")
        if status == "available" and not has_values:
            fail("Available metrics must contain a value or a visible point.")
        if status == "partial" and not has_values:
            fail("Partial metrics must retain a visible value or point.")
        if status == "available" and any(item["status"] != "complete" for item in coverage):
            fail("Incomplete source coverage cannot be presented as fully available.")
        if metric_id == "daily_customers" and start != end and scalar is not None:
            fail("Daily customer counts cannot be represented as period-unique buyers.")

    # The exact source-specific metric set is intentionally not required: an
    # unavailable or newly unsupported measure must remain unavailable, not zero.
    return snapshot, metrics


def import_file(path: Path) -> str:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise InvalidSnapshot("Snapshot file could not be read.") from error
    if not raw or len(raw) > MAX_BYTES:
        fail("Snapshot must contain 1..256 KiB.")
    try:
        payload = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("Snapshot must be valid UTF-8 JSON.")
    snapshot, metrics = validate(payload)

    conn = psycopg2.connect(
        host=os.environ.get("REPORTING_HOST", "reporting-db"),
        port=int(os.environ.get("REPORTING_PORT", "5432")),
        dbname=os.environ.get("REPORTING_DATABASE", "goodwill_reporting"),
        user=os.environ.get("REPORTING_USER", "goodwill_importer"),
        password=os.environ["REPORTING_PASSWORD"],
        connect_timeout=8,
        sslmode="disable",
    )
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT checksum FROM reporting.snapshots WHERE snapshot_id = %s FOR UPDATE",
                    (snapshot["snapshotId"],),
                )
                existing = cursor.fetchone()
                if existing:
                    if existing[0].strip() != snapshot["checksum"]:
                        fail("Snapshot identity already exists with different contents.")
                    return "Already imported; exact replay made no changes."
                cursor.execute(
                    """INSERT INTO reporting.snapshots (
                         snapshot_id, checksum, scope_id, source_id, start_date, end_date,
                         store_id, publication_id, published_at, exported_at,
                         snapshot_age_seconds, timezone, currency, synthetic, warnings
                       ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        snapshot["snapshotId"], snapshot["checksum"], snapshot["scopeId"],
                        snapshot["sourceId"], snapshot["period"]["startDate"],
                        snapshot["period"]["endDate"], snapshot["storeId"],
                        snapshot["publicationId"], iso_instant(snapshot["publishedAt"], "publishedAt"),
                        iso_instant(snapshot["exportedAt"], "exportedAt"),
                        snapshot["snapshotAgeSeconds"], snapshot["timezone"], snapshot["currency"],
                        snapshot["synthetic"], snapshot["warnings"],
                    ),
                )
                for metric in metrics:
                    cursor.execute(
                        """INSERT INTO reporting.metric_definitions (
                             snapshot_id, metric_id, label, unit, definition_version, formula,
                             grain, time_basis, availability_reason, status, scalar_value,
                             coverage, warnings
                           ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s)""",
                        (
                            snapshot["snapshotId"], metric["metricId"], metric["label"],
                            metric["unit"], metric["definitionVersion"], metric["formula"],
                            metric["grain"], metric["timeBasis"], metric["availabilityReason"],
                            metric["status"], metric["value"],
                            json.dumps(metric["coverage"], ensure_ascii=False), metric["warnings"],
                        ),
                    )
                    for point in metric["points"]:
                        cursor.execute(
                            """INSERT INTO reporting.metric_points (
                                 snapshot_id, metric_id, point_key, value,
                                 contributing_rows, missing_buyer_rows
                               ) VALUES (%s,%s,%s,%s,%s,%s)""",
                            (
                                snapshot["snapshotId"], metric["metricId"], point["key"],
                                point["value"], point["contributingRows"], point["missingBuyerRows"],
                            ),
                        )
        return f"Imported {snapshot['snapshotId']} ({len(metrics)} metrics) atomically."
    finally:
        conn.close()


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: import_snapshot.py /input/<snapshot>.json", file=sys.stderr)
        return 2
    try:
        print(import_file(Path(sys.argv[1])))
        return 0
    except (InvalidSnapshot, KeyError, TypeError, ValueError, psycopg2.Error) as error:
        print(f"Snapshot import failed; prior dashboard data was left unchanged: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())