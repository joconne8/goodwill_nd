"""Idempotently register only the local curated reporting views and dashboard."""
from __future__ import annotations

import json
import os
from typing import Any

from superset.app import create_app

app = create_app()

CHARTS = [
    {
        "name": "Source-local financial trends",
        "dataset": "dashboard_metrics",
        "viz_type": "echarts_timeseries_line",
        "description": (
            "Daily source-local amounts in USD cents. Each line is a separate source, "
            "scope and metric; values are never summed across sources or snapshots."
        ),
        "params": {
            "x_axis": "point_date",
            "time_grain_sqla": "P1D",
            "time_range": "No filter",
            "metrics": ["max_value"],
            "groupby": ["source_id", "scope_id", "metric_id"],
            "adhoc_filters": [{
                "clause": "WHERE", "expressionType": "SIMPLE", "subject": "point_date",
                "operator": "IS NOT NULL", "comparator": None, "isExtra": False,
                "isNew": False, "filterOptionName": "pilot-daily-points",
            }],
            "row_limit": 10000,
            "show_legend": True,
            "show_markers": False,
            "rich_tooltip": True,
            "order_desc": False,
        },
        "height": 52,
        "width": 12,
    },
    {
        "name": "Daily distinct customers (not period-unique buyers)",
        "dataset": "dashboard_metrics",
        "viz_type": "echarts_timeseries_line",
        "description": (
            "Daily distinct platform-local customer counts only. Daily counts are "
            "non-additive; this chart does not estimate unique buyers for the period."
        ),
        "params": {
            "x_axis": "point_date",
            "time_grain_sqla": "P1D",
            "time_range": "No filter",
            "metrics": ["max_value"],
            "groupby": ["source_id", "scope_id"],
            "adhoc_filters": [
                {
                    "clause": "WHERE", "expressionType": "SIMPLE", "subject": "metric_id",
                    "operator": "==", "comparator": "daily_customers", "isExtra": False,
                    "isNew": False, "filterOptionName": "pilot-customer-metric",
                },
                {
                    "clause": "WHERE", "expressionType": "SIMPLE", "subject": "point_date",
                    "operator": "IS NOT NULL", "comparator": None, "isExtra": False,
                    "isNew": False, "filterOptionName": "pilot-customer-daily-points",
                },
            ],
            "row_limit": 10000,
            "show_legend": True,
            "show_markers": False,
            "rich_tooltip": True,
            "order_desc": False,
        },
        "height": 52,
        "width": 12,
    },
    {
        "name": "Coverage, availability and warnings",
        "dataset": "dashboard_metric_status",
        "viz_type": "table",
        "description": "Metric definition, source coverage, publication identity and warnings.",
        "params": {
            "query_mode": "raw",
            "all_columns": [
                "source_id", "metric_id", "label", "status", "unit", "start_date",
                "end_date", "availability_reason", "coverage", "warnings",
            ],
            "order_by_cols": [],
            "row_limit": 1000,
            "include_search": True,
        },
        "height": 58,
        "width": 12,
    },
    {
        "name": "Snapshot and publication details",
        "dataset": "dashboard_snapshots",
        "viz_type": "table",
        "description": "Export age is measured at download; import time is shown separately.",
        "params": {
            "query_mode": "raw",
            "all_columns": [
                "source_id", "scope_label", "start_date", "end_date", "store_id",
                "publication_id", "published_at", "exported_at", "snapshot_age_seconds",
                "imported_at", "timezone", "currency", "synthetic", "warnings",
            ],
            "order_by_cols": [],
            "row_limit": 1000,
            "include_search": True,
        },
        "height": 45,
        "width": 12,
    },
]


def ensure_dataset(database: Any, table_name: str, description: str, main_dttm_col: str | None,
                   db: Any, sqla_table_class: Any) -> Any:
    dataset = db.session.query(sqla_table_class).filter_by(
        database_id=database.id, schema="reporting", table_name=table_name
    ).one_or_none()
    if dataset is None:
        dataset = sqla_table_class(
            table_name=table_name,
            schema="reporting",
            database=database,
            description=description,
            main_dttm_col=main_dttm_col,
            normalize_columns=True,
            is_sqllab_view=False,
        )
        db.session.add(dataset)
        db.session.flush()
    dataset.description = description
    dataset.main_dttm_col = main_dttm_col
    dataset.fetch_metadata()
    for column in dataset.columns:
        column.filterable = column.column_name in {"scope_label", "metric_id", "point_date"}
        column.groupby = column.column_name in {
            "source_id", "scope_id", "scope_label", "metric_id", "point_date", "start_date", "end_date",
        }
        column.is_dttm = column.column_name in {"point_date", "published_at", "exported_at", "imported_at"}
    db.session.flush()
    return dataset


def ensure_max_metric(dataset: Any, db: Any, sql_metric_class: Any) -> None:
    metric = db.session.query(sql_metric_class).filter_by(
        table_id=dataset.id, metric_name="max_value"
    ).one_or_none()
    if metric is None:
        metric = sql_metric_class(
            table=dataset,
            metric_name="max_value",
            verbose_name="Maximum value within each source, scope, metric and day",
            expression="MAX(value)",
            d3format=",",
            description="Intentionally not additive; it cannot sum overlapping scopes or snapshots.",
        )
        db.session.add(metric)
    else:
        metric.expression = "MAX(value)"
        metric.verbose_name = "Maximum value within each source, scope, metric and day"
        metric.description = "Intentionally not additive; it cannot sum overlapping scopes or snapshots."


def ensure_viewer_role(app: Any, datasets: list[Any]) -> Any:
    security_manager = app.appbuilder.sm
    role = security_manager.find_role("Goodwill Dashboard Viewer")
    if role is None:
        role = security_manager.add_role("Goodwill Dashboard Viewer")
    # A deliberately small read-only Superset role: no SQL Lab, chart editing,
    # dashboard editing, uploads, or permission management.
    grants = {
        ("can_read", "Dashboard"),
        ("can_read", "Chart"),
        ("can_read", "Dataset"),
        ("can_read", "Database"),
        ("can_dashboard", "Superset"),
        ("can_get", "Datasource"),
        ("can_query", "Api"),
        ("can_query_form_data", "Api"),
        ("can_read", "DashboardFilterStateRestApi"),
        ("can_write", "DashboardFilterStateRestApi"),
        ("can_read", "DashboardPermalinkRestApi"),
        ("can_write", "DashboardPermalinkRestApi"),
        ("can_read", "Explore"),
        ("can_fetch_datasource_metadata", "Superset"),
    }
    for permission_name, view_name in grants:
        permission_view = security_manager.find_permission_view_menu(permission_name, view_name)
        if permission_view is not None:
            security_manager.add_permission_role(role, permission_view)
    for dataset in datasets:
        if dataset.perm:
            permission_view = security_manager.find_permission_view_menu("datasource_access", dataset.perm)
            if permission_view is None:
                permission_view = security_manager.add_permission_view_menu("datasource_access", dataset.perm)
            security_manager.add_permission_role(role, permission_view)
    return role


def positions(charts: list[Any]) -> str:
    chart_ids = [f"CHART-{index + 1}" for index in range(len(charts))]
    row_ids = [f"ROW-{index + 1}" for index in range(len(charts))]
    children: list[str] = []
    layout: dict[str, Any] = {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": row_ids, "parents": ["ROOT_ID"]},
    }
    for index, (chart, config) in enumerate(zip(charts, CHARTS, strict=True)):
        row_id = row_ids[index]
        chart_id = chart_ids[index]
        children.append(row_id)
        layout[row_id] = {
            "id": row_id,
            "type": "ROW",
            "children": [chart_id],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }
        layout[chart_id] = {
            "id": chart_id,
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", row_id],
            "meta": {
                "chartId": chart.id,
                "sliceName": config["name"],
                "width": config["width"],
                "height": config["height"],
            },
        }
    return json.dumps(layout, separators=(",", ":"))


def main() -> None:
    with app.app_context():
        from superset.connectors.sqla.models import SqlMetric, SqlaTable
        from superset.extensions import db
        from superset.models.core import Database
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        reporting_uri = os.environ["GOODWILL_REPORTING_DB_URI"]
        database = db.session.query(Database).filter_by(database_name="Goodwill curated reporting").one_or_none()
        if database is None:
            database = Database(
                database_name="Goodwill curated reporting",
                sqlalchemy_uri=reporting_uri,
                expose_in_sqllab=False,
                allow_run_async=False,
                allow_ctas=False,
                allow_cvas=False,
                allow_dml=False,
                allow_file_upload=False,
                extra="{}",
            )
            db.session.add(database)
        else:
            database.sqlalchemy_uri = reporting_uri
        database.expose_in_sqllab = False
        database.allow_run_async = False
        database.allow_ctas = False
        database.allow_cvas = False
        database.allow_dml = False
        database.allow_file_upload = False
        db.session.flush()

        metric_dataset = ensure_dataset(
            database, "dashboard_metrics",
            "Curated source-local values. Use MAX(value) grouped by scope and date; never sum scopes.",
            "point_date", db, SqlaTable,
        )
        status_dataset = ensure_dataset(
            database, "dashboard_metric_status",
            "Curated metric availability, coverage and warning metadata.", None, db, SqlaTable,
        )
        snapshot_dataset = ensure_dataset(
            database, "dashboard_snapshots",
            "One newest imported snapshot per exact source, date range and store scope.", None, db, SqlaTable,
        )
        ensure_max_metric(metric_dataset, db, SqlMetric)
        viewer_role = ensure_viewer_role(app, [metric_dataset, status_dataset, snapshot_dataset])
        db.session.flush()

        charts: list[Slice] = []
        for config in CHARTS:
            dataset = {
                "dashboard_metrics": metric_dataset,
                "dashboard_metric_status": status_dataset,
                "dashboard_snapshots": snapshot_dataset,
            }[config["dataset"]]
            chart = db.session.query(Slice).filter_by(slice_name=config["name"]).one_or_none()
            if chart is None:
                chart = Slice(
                    slice_name=config["name"],
                    datasource_type="table",
                    datasource_id=dataset.id,
                    datasource_name=dataset.table_name,
                    viz_type=config["viz_type"],
                )
                db.session.add(chart)
            chart.datasource_type = "table"
            chart.datasource_id = dataset.id
            chart.datasource_name = dataset.table_name
            chart.viz_type = config["viz_type"]
            chart.description = config["description"]
            params = dict(config["params"])
            params["datasource"] = f"{dataset.id}__table"
            params["viz_type"] = config["viz_type"]
            params["slice_id"] = chart.id
            chart.params = json.dumps(params, separators=(",", ":"))
            charts.append(chart)
        db.session.flush()

        dashboard = db.session.query(Dashboard).filter_by(slug="goodwill-local-pilot").one_or_none()
        if dashboard is None:
            dashboard = Dashboard(dashboard_title="Goodwill Local Reporting Pilot")
            db.session.add(dashboard)
        dashboard.dashboard_title = "Goodwill Local Reporting Pilot"
        dashboard.slug = "goodwill-local-pilot"
        dashboard.description = (
            "Private local dashboard for authenticated operators. Values come only from "
            "manually imported synthetic aggregate snapshots."
        )
        dashboard.position_json = positions(charts)
        dashboard.slices = charts
        dashboard.published = True
        dashboard.roles = [viewer_role]
        filter_targets = [
            {"datasetId": dataset.id, "column": {"name": "scope_label"}}
            for dataset in [metric_dataset, status_dataset, snapshot_dataset]
        ]
        dashboard.json_metadata = json.dumps({
            "native_filter_configuration": [{
                "id": "NATIVE_FILTER-goodwill-exported-scope",
                "name": "Exported source / period / store scope",
                "filterType": "filter_select",
                "targets": filter_targets,
                "cascadeParentIds": [],
                "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                "controlValues": {
                    "enableEmptyFilter": False,
                    "defaultToFirstItem": True,
                    "multiSelect": False,
                    "searchAllOptions": True,
                    "inverseSelection": False,
                },
            }],
            "timed_refresh_immune_slices": [],
        }, separators=(",", ":"))
        db.session.commit()
        print(
            "Provisioned Goodwill Local Reporting Pilot with 4 charts, one single-select "
            "exported-scope filter, and read-only curated-view access."
        )


if __name__ == "__main__":
    main()