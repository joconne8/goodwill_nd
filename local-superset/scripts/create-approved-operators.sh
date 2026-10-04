#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo "Run local-superset/scripts/setup.sh first." >&2; exit 1; }
cd "$ROOT"

approved_primary=${GOODWILL_DEMO_OPERATOR_EMAIL:-}
approved_additional=${GOODWILL_DEMO_ADDITIONAL_OPERATOR_EMAIL:-}
[ -n "$approved_primary" ] || {
  echo "The existing approved primary operator must be supplied through GOODWILL_DEMO_OPERATOR_EMAIL." >&2
  exit 1
}
echo "Enter only the currently approved Goodwill operator emails already authorized by the Goodwill app."
echo "At most two accounts can be created. The first is the local Superset administrator; the second is read-only."
restore_echo() { stty echo 2>/dev/null || true; }
trap restore_echo EXIT HUP INT TERM
index=0
while [ "$index" -lt 2 ]; do
  index=$((index + 1))
  if [ "$index" -eq 1 ]; then
    prompt="Approved operator email (first account): "
  else
    prompt="Approved operator email (second account, blank to stop): "
  fi
  printf "%s" "$prompt"
  IFS= read -r email || true
  [ -n "$email" ] || {
    [ "$index" -eq 1 ] && { echo "At least one approved operator is required." >&2; exit 1; }
    break
  }
  normalized_email=$(printf "%s" "$email" | tr '[:upper:]' '[:lower:]')
  if [ "$index" -eq 1 ]; then
    expected_email=$(printf "%s" "$approved_primary" | tr '[:upper:]' '[:lower:]')
  else
    expected_email=$(printf "%s" "$approved_additional" | tr '[:upper:]' '[:lower:]')
  fi
  [ -n "$expected_email" ] && [ "$normalized_email" = "$expected_email" ] || {
    echo "That email is not approved for this account position." >&2
    exit 1
  }
  printf "First name: "
  IFS= read -r first_name
  printf "Last name: "
  IFS= read -r last_name
  printf "Set a local Superset password (not the Goodwill app password): "
  stty -echo
  IFS= read -r password
  stty echo
  printf "\nConfirm local Superset password: "
  stty -echo
  IFS= read -r password_again
  stty echo
  printf "\n"
  [ "$password" = "$password_again" ] || { echo "Passwords did not match." >&2; exit 1; }
  if [ "$index" -eq 1 ]; then role="Admin"; else role="Goodwill Dashboard Viewer"; fi
  EMAIL_VALUE="$email" FIRST_VALUE="$first_name" LAST_VALUE="$last_name" \
    PASSWORD_VALUE="$password" ROLE_VALUE="$role" python3 -c '
import json, os
print(json.dumps({
    "email": os.environ["EMAIL_VALUE"],
    "firstName": os.environ["FIRST_VALUE"],
    "lastName": os.environ["LAST_VALUE"],
    "password": os.environ["PASSWORD_VALUE"],
    "roleName": os.environ["ROLE_VALUE"],
}, separators=(",", ":")), end="")
' | docker compose --env-file .env run --rm --no-deps -T \
      --entrypoint python superset /app/pythonpath/goodwill_create_approved_operator.py
  unset password password_again
done