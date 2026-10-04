from __future__ import annotations

import hashlib
import json
import os
import tempfile
import unittest
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2

from import_snapshot import InvalidSnapshot, import_file, validate


def scope_hash(source: str, period: dict[str, str], store: str | None) -> str:
    scope = {"sourceId": source, "period": period, "storeId": store}
    return hashlib.sha256(
        json.dumps(scope, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def metric(
    metric_id: str,
    value: int | None,
    status: str = "available",
    point_key: str = "1900-01-01",
) -> dict[str, Any]:
    return {
        "metricId": metric_id,
        "label": metric_id.replace("_", " ").title(),
        "unit": "count" if metric_id == "daily_customers" else "usd_cent",
        "definitionVersion": "test-definition-v1",
        "formula": "Test-only unit fixture; not reporting data.",
        "grain": "one source and one date",
        "timeBasis": "synthetic fixture date",
        "availabilityReason": "Fixture is explicitly unavailable." if status == "unavailable" else None,
        "status": status,
        "value": value,
        "points": [] if status == "unavailable" else [{
            "key": point_key, "value": value, "contributingRows": 1, "missingBuyerRows": 0,
        }],
        "coverage": [{
            "datasetId": "goodwill_books" if metric_id == "source_net" else "shopgoodwill",
            "status": "complete",
            "startDate": "1900-01-01",
            "endDate": "1900-01-01",
            "lastGoodAt": None,
            "latestAttemptAt": None,
            "missingRows": 0,
            "reason": "Complete test fixture scope.",
        }],
        "warnings": [],
    }


def make_snapshot(
    metrics: list[dict[str, Any]] | None = None,
    *,
    source: str = "shopgoodwill",
    start: str = "1900-01-01",
    end: str = "1900-01-01",
    store: str | None = "GW-999",
    publication: str | None = None,
) -> dict[str, Any]:
    period = {"startDate": start, "endDate": end}
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    selected_metrics = metrics if metrics is not None else [
        metric("net_item_sales", 0),
        metric("source_net", 0),
    ]
    for selected_metric in selected_metrics:
        for coverage_item in selected_metric["coverage"]:
            coverage_item["datasetId"] = source
            coverage_item["startDate"] = start
            coverage_item["endDate"] = end
    base: dict[str, Any] = {
        "schemaVersion": "goodwill-superset/1.0.0",
        "synthetic": True,
        "scopeId": scope_hash(source, period, store),
        "exportedAt": now,
        "snapshotAgeSeconds": 0,
        "sourceId": source,
        "period": period,
        "storeId": store,
        "publicationId": publication or f"PILOT_TEST/{uuid.uuid4()}",
        "publishedAt": now,
        "timezone": "America/New_York",
        "currency": "USD",
        "metrics": selected_metrics,
        "warnings": ["Importer test fixture only."],
    }
    checksum = hashlib.sha256(
        json.dumps(base, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    ).hexdigest()
    return {**base, "snapshotId": checksum, "checksum": checksum}


class SnapshotValidationTests(unittest.TestCase):
    def test_exact_zero_and_unavailable_null_are_distinct(self) -> None:
        zero = make_snapshot([metric("net_item_sales", 0)])
        unavailable = make_snapshot([metric("net_item_sales", None, "unavailable")])
        self.assertEqual(validate(zero)[0]["metrics"][0]["value"], 0)
        self.assertIsNone(validate(unavailable)[0]["metrics"][0]["value"])

    def test_checksum_and_scope_identity_reject_mutation(self) -> None:
        snapshot = make_snapshot()
        snapshot["metrics"][0]["value"] = 400
        with self.assertRaisesRegex(InvalidSnapshot, "checksum"):
            validate(snapshot)
        snapshot = make_snapshot()
        snapshot["scopeId"] = "0" * 64
        unsigned = {key: value for key, value in snapshot.items() if key not in {"snapshotId", "checksum"}}
        checksum = hashlib.sha256(
            json.dumps(unsigned, ensure_ascii=False, separators=(",", ":")).encode()
        ).hexdigest()
        snapshot["snapshotId"] = snapshot["checksum"] = checksum
        with self.assertRaisesRegex(InvalidSnapshot, "Scope identity"):
            validate(snapshot)

    def test_daily_customers_are_not_a_multi_day_total(self) -> None:
        customer_metric = metric("daily_customers", 2)
        snapshot = make_snapshot(
            [customer_metric], start="1900-01-01", end="1900-01-02",
        )
        snapshot["metrics"][0]["points"].append({
            "key": "1900-01-02", "value": 1, "contributingRows": 1, "missingBuyerRows": 0,
        })
        base = {key: value for key, value in snapshot.items() if key not in {"snapshotId", "checksum"}}
        checksum = hashlib.sha256(
            json.dumps(base, ensure_ascii=False, separators=(",", ":")).encode()
        ).hexdigest()
        snapshot["snapshotId"] = snapshot["checksum"] = checksum
        with self.assertRaisesRegex(InvalidSnapshot, "period-unique"):
            validate(snapshot)

    def test_books_requires_a_complete_statement_month(self) -> None:
        partial = metric("source_net", 1200)
        incomplete = make_snapshot(
            [partial], source="goodwill_books", start="2026-08-31", end="2026-08-31",
        )
        with self.assertRaisesRegex(InvalidSnapshot, "statement-month"):
            validate(incomplete)
        complete = make_snapshot(
            [metric("source_net", 1200)], source="goodwill_books",
            start="2026-08-01", end="2026-08-31",
        )
        self.assertEqual(validate(complete)[0]["period"]["startDate"], "2026-08-01")

    def test_available_values_cannot_hide_partial_coverage(self) -> None:
        metric_value = metric("net_item_sales", 250)
        metric_value["coverage"][0]["status"] = "partial"
        snapshot = make_snapshot([metric_value])
        with self.assertRaisesRegex(InvalidSnapshot, "Incomplete source coverage"):
            validate(snapshot)

    def test_duplicate_json_object_keys_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text('{"snapshotId":"first","snapshotId":"second"}', encoding="utf-8")
            with self.assertRaisesRegex(InvalidSnapshot, "duplicate object key"):
                import_file(path)


class DatabaseIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if os.environ.get("GOODWILL_PILOT_INTEGRATION_TEST") != "1":
            raise unittest.SkipTest("Database integration is run only by the local test-profile container.")
        cls.host = os.environ.get("REPORTING_HOST", "reporting-db")
        cls.database = os.environ.get("REPORTING_DATABASE", "goodwill_reporting")
        cls.owner = psycopg2.connect(
            host=cls.host, dbname=cls.database, user="reporting_owner",
            password=os.environ["REPORTING_OWNER_PASSWORD"], connect_timeout=8,
        )
        cls.owner.autocommit = True
        with cls.owner.cursor() as cursor:
            cursor.execute(
                """DELETE FROM reporting.metric_points WHERE snapshot_id IN
                   (SELECT snapshot_id FROM reporting.snapshots WHERE publication_id LIKE 'PILOT_TEST/%')"""
            )
            cursor.execute(
                """DELETE FROM reporting.metric_definitions WHERE snapshot_id IN
                   (SELECT snapshot_id FROM reporting.snapshots WHERE publication_id LIKE 'PILOT_TEST/%')"""
            )
            cursor.execute("DELETE FROM reporting.snapshots WHERE publication_id LIKE 'PILOT_TEST/%'")
            cursor.execute("DROP TRIGGER IF EXISTS pilot_test_reject_metric ON reporting.metric_definitions")
            cursor.execute("DROP FUNCTION IF EXISTS reporting.pilot_test_reject_metric()")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.owner.close()

    def test_permissions_replay_and_atomic_rollback(self) -> None:
        with self.owner.cursor() as cursor:
            cursor.execute(
                """SELECT
                     has_table_privilege('goodwill_superset_reader','reporting.dashboard_snapshots','SELECT'),
                     has_table_privilege('goodwill_superset_reader','reporting.dashboard_metrics','SELECT'),
                     has_table_privilege('goodwill_superset_reader','reporting.snapshots','SELECT'),
                     has_table_privilege('goodwill_superset_reader','reporting.metric_definitions','SELECT'),
                     has_table_privilege('goodwill_importer','reporting.snapshots','INSERT'),
                     has_table_privilege('goodwill_importer','reporting.snapshots','DELETE')"""
            )
            self.assertEqual(cursor.fetchone(), (True, True, False, False, True, False))

        reader = psycopg2.connect(
            host=self.host, dbname=self.database, user="goodwill_superset_reader",
            password=os.environ["REPORTING_READER_PASSWORD"], connect_timeout=8,
        )
        try:
            with reader.cursor() as cursor:
                cursor.execute("SELECT count(*) FROM reporting.dashboard_snapshots")
                self.assertGreaterEqual(cursor.fetchone()[0], 0)
                with self.assertRaises(psycopg2.errors.InsufficientPrivilege):
                    cursor.execute("SELECT count(*) FROM reporting.snapshots")
        finally:
            reader.close()

        first = make_snapshot()
        second = make_snapshot(publication="PILOT_TEST/rollback")
        imported_ids = [first["snapshotId"], second["snapshotId"]]
        try:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "snapshot.json"
                path.write_text(json.dumps(first, ensure_ascii=False), encoding="utf-8")
                self.assertIn("Imported ", import_file(path))
                self.assertIn("Already imported", import_file(path))

                with self.owner.cursor() as cursor:
                    cursor.execute(
                        """CREATE FUNCTION reporting.pilot_test_reject_metric() RETURNS trigger
                           LANGUAGE plpgsql AS $$
                           BEGIN
                             IF NEW.metric_id = 'source_net' THEN RAISE EXCEPTION 'pilot rollback check'; END IF;
                             RETURN NEW;
                           END $$"""
                    )
                    cursor.execute(
                        """CREATE TRIGGER pilot_test_reject_metric BEFORE INSERT
                           ON reporting.metric_definitions FOR EACH ROW
                           EXECUTE FUNCTION reporting.pilot_test_reject_metric()"""
                    )
                path.write_text(json.dumps(second, ensure_ascii=False), encoding="utf-8")
                with self.assertRaises(psycopg2.Error):
                    import_file(path)
                with self.owner.cursor() as cursor:
                    cursor.execute("SELECT count(*) FROM reporting.snapshots WHERE snapshot_id = %s", (second["snapshotId"],))
                    self.assertEqual(cursor.fetchone()[0], 0, "failed import must not expose a partial snapshot")
                    cursor.execute(
                        "SELECT publication_id FROM reporting.dashboard_snapshots WHERE snapshot_id = %s",
                        (first["snapshotId"],),
                    )
                    self.assertEqual(cursor.fetchone()[0], first["publicationId"])
        finally:
            with self.owner.cursor() as cursor:
                cursor.execute("DROP TRIGGER IF EXISTS pilot_test_reject_metric ON reporting.metric_definitions")
                cursor.execute("DROP FUNCTION IF EXISTS reporting.pilot_test_reject_metric()")
                cursor.execute("DELETE FROM reporting.metric_points WHERE snapshot_id = ANY(%s)", (imported_ids,))
                cursor.execute("DELETE FROM reporting.metric_definitions WHERE snapshot_id = ANY(%s)", (imported_ids,))
                cursor.execute("DELETE FROM reporting.snapshots WHERE snapshot_id = ANY(%s)", (imported_ids,))


if __name__ == "__main__":
    unittest.main(verbosity=2)