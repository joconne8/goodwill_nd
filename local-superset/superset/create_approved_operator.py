"""Create exactly one operator account supplied through the interactive local setup."""
from __future__ import annotations

import json
import os
import re
import sys

from superset.app import create_app

EMAIL = re.compile(r"^[^@\s]{1,120}@[^@\s]{1,190}\.[^@\s]{2,60}$")
app = create_app()


def main() -> int:
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        print("Account request was invalid.", file=sys.stderr)
        return 2
    if not isinstance(value, dict) or set(value) != {"email", "firstName", "lastName", "password", "roleName"}:
        print("Account request did not match the local setup contract.", file=sys.stderr)
        return 2
    email = value["email"].strip().lower() if isinstance(value["email"], str) else ""
    primary = os.environ.get("GOODWILL_DEMO_OPERATOR_EMAIL", "").strip().lower()
    additional = os.environ.get("GOODWILL_DEMO_ADDITIONAL_OPERATOR_EMAIL", "").strip().lower()
    password = value["password"]
    if not EMAIL.fullmatch(email) or not isinstance(password, str) or len(password) < 12:
        print("Use an approved email and a password of at least 12 characters.", file=sys.stderr)
        return 2
    if not EMAIL.fullmatch(primary) or (additional and not EMAIL.fullmatch(additional)):
        print("The existing approved-operator allowlist is unavailable; no account was created.", file=sys.stderr)
        return 2
    expected_role = (
        "Admin" if email == primary else
        "Goodwill Dashboard Viewer" if additional and email == additional else
        None
    )
    if expected_role is None or value["roleName"] != expected_role:
        print("That email is not approved for the requested local Superset role.", file=sys.stderr)
        return 2
    for key in ("firstName", "lastName"):
        if not isinstance(value[key], str) or not value[key].strip() or len(value[key]) > 80:
            print("Account names must be bounded and non-empty.", file=sys.stderr)
            return 2

    with app.app_context():
        security_manager = app.appbuilder.sm
        if security_manager.find_user(email=email) or security_manager.find_user(username=email):
            print("That account already exists; no password or role was changed.", file=sys.stderr)
            return 1
        role = security_manager.find_role(value["roleName"])
        if role is None:
            print("The dashboard role has not been provisioned yet.", file=sys.stderr)
            return 1
        created = security_manager.add_user(
            username=email,
            first_name=value["firstName"].strip(),
            last_name=value["lastName"].strip(),
            email=email,
            role=role,
            password=password,
        )
        if not created:
            print("Superset did not create the requested account.", file=sys.stderr)
            return 1
        print(f"Created the approved local account with role {role.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())