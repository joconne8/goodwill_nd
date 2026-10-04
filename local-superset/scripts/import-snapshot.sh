#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$#" -ne 1 ]; then
  echo "Usage: sh local-superset/scripts/import-snapshot.sh local-superset/snapshots/<snapshot>.json" >&2
  exit 2
fi
[ -d "$ROOT/snapshots" ] || mkdir -p "$ROOT/snapshots"
SNAPSHOT=$(realpath "$1")
case "$SNAPSHOT" in
  "$ROOT"/snapshots/*) ;;
  *) echo "For safety, copy the downloaded file into local-superset/snapshots/ first." >&2; exit 2 ;;
esac
[ -f "$SNAPSHOT" ] || { echo "Snapshot file not found." >&2; exit 2; }
cd "$ROOT"
docker compose --env-file .env --profile tools run --build --rm importer "/input/$(basename "$SNAPSHOT")"