#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT/.env"
umask 077

if [ -e "$ENV_FILE" ]; then
  echo "Local Superset settings already exist at local-superset/.env; leaving them unchanged."
  exit 0
fi

python3 - "$ENV_FILE" <<'PY'
import secrets
import sys
from pathlib import Path

values = {
    "REPORTING_OWNER_PASSWORD": secrets.token_hex(32),
    "REPORTING_IMPORTER_PASSWORD": secrets.token_hex(32),
    "REPORTING_READER_PASSWORD": secrets.token_hex(32),
    "SUPERSET_METADATA_PASSWORD": secrets.token_hex(32),
    "SUPERSET_SECRET_KEY": secrets.token_hex(48),
}
path = Path(sys.argv[1])
path.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
path.chmod(0o600)
print("Created private local-superset/.env. Generated values were not printed.")
PY