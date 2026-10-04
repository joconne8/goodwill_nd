"""Wait for both isolated PostgreSQL services before running migrations."""
from __future__ import annotations

import os
import time

from sqlalchemy import create_engine, text


def main() -> None:
    for variable in ("SUPERSET_METADATA_DB_URI", "GOODWILL_REPORTING_DB_URI"):
        uri = os.environ[variable]
        engine = create_engine(uri, pool_pre_ping=True, connect_args={"connect_timeout": 5})
        last_error: Exception | None = None
        for _ in range(30):
            try:
                with engine.connect() as connection:
                    connection.execute(text("SELECT 1"))
                last_error = None
                break
            except Exception as error:  # Retry connection during Postgres startup.
                last_error = error
                time.sleep(2)
        engine.dispose()
        if last_error is not None:
            raise RuntimeError(
                f"{variable} did not accept connections within 150 seconds "
                f"({type(last_error).__name__})."
            ) from None
    print("Both isolated PostgreSQL databases accept connections.")


if __name__ == "__main__":
    main()