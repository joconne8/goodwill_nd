#!/usr/bin/env python3
"""Export audited current bytes, not Replit history. No Git or runtime mutation."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = "docs/goodwill/evidence/github/goodwill/synthetic-data/"
ROOT_FILES = {
    ".gitignore", ".npmrc", "package.json", "pnpm-lock.yaml",
    "pnpm-workspace.yaml", "tsconfig.base.json", "tsconfig.json", "README.md",
    "pyproject.toml", "uv.lock",
}
DOC_FILES = {
    "docs/goodwill/CONTRACT_V2.md", "docs/goodwill/SOURCE_SEMANTICS.md",
    "docs/goodwill/data/INTEGRATION.md",
    "docs/goodwill/data/independent-controls.py",
    "docs/goodwill/evidence/target/tree.json",
}
PRIVATE_PARTS = {".git", ".agents", ".local", "node_modules", "dist", ".cache",
                 "__pycache__", "snapshots", "test-results", "playwright"}
EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
TOKENS = [
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("provider-secret", re.compile(r"\b(?:sk_live_|sk_test_|sk-ant-)[A-Za-z0-9_-]{30,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{25,}\b")),
    ("credential-url", re.compile(r"(?:postgres(?:ql)?|https?)://[^\s/:]+:([^@\s]+)@")),
    ("hardcoded-secret", re.compile(
        r"""(?i)(?:api[_-]?key|client[_-]?secret|access[_-]?token|secret[_-]?key)\s*[:=]\s*["']([^"'\n]{20,})["']""")),
    ("npm-auth", re.compile(r"(?mi)^.*(?:_authToken|_password|_auth)\s*=\s*([^\s]{12,})")),
]

def allowed(name):
    parts = Path(name).parts
    if any(p in PRIVATE_PARTS for p in parts):
        return False
    if any(p.startswith(".env") and p != ".env.example" for p in parts):
        return False
    if name.endswith((".sql", ".log", ".tsbuildinfo", ".map", ".pyc")):
        return False
    if name in ROOT_FILES or name in DOC_FILES or name.startswith(FIXTURES):
        return True
    if name.startswith(("lib/", "scripts/", "local-superset/", "docs/handoff/")):
        return True
    if name.startswith("artifacts/"):
        # A separate showcase/presentation isn't part of the application handoff.
        return parts[1] in {"api-server", "goodwill", "goodwill-analytics", "mockup-sandbox"}
    if name.startswith("docs/goodwill/contracts/examples/"):
        return True
    if name.startswith("docs/goodwill/verification/independent/"):
        return name.endswith((".py", ".test.ts", ".test.mjs", "oracle-output.json"))
    if name.startswith("docs/goodwill/verification/"):
        return name.endswith(".md")
    return False

def audit(name, data):
    """Emit rule/path/line only. Never print credential or address matches."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return [], ["binary file: content not credential/PII scanned"]
    findings = []
    for rule, pattern in TOKENS:
        if rule == "npm-auth" and not name.endswith(".npmrc"):
            continue
        for m in pattern.finditer(text):
            # Check placeholder markers in the value, not in a variable name or
            # registry hostname (an example host can still carry a real token).
            matched = m.group(1) if m.lastindex else m.group(0)
            if any(word in matched.lower() for word in
                   ("example", "placeholder", "your_", "test-only", "${", "<", "process.env")):
                continue
            # Credential URL examples with conventional dummy passwords aren't secrets.
            if rule == "credential-url" and m.group(1) in {"password", "pass", "secret", "test"}:
                continue
            findings.append({"path": name, "line": text.count("\n", 0, m.start()) + 1, "rule": rule})
    for m in EMAIL.finditer(text):
        domain = m.group(1).lower()
        if domain.endswith((".test", ".invalid", ".example", ".localhost")) or domain in {
            "example.com", "example.org", "example.net", "test.com", "localhost.localdomain",
        }:
            continue
        findings.append({"path": name, "line": text.count("\n", 0, m.start()) + 1,
                         "rule": "non-example-email-review"})
    return findings, []

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=".local/exports/goodwill-codex-handoff.zip")
    args = parser.parse_args()
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    names = {n for n in tracked if n}
    # Include only these intentional handoff additions, not arbitrary untracked files.
    names.update(p.relative_to(ROOT).as_posix() for p in (ROOT/"docs/handoff").glob("*.md"))
    names.add("scripts/prepare-github-handoff.py")
    selected = sorted(n for n in names if allowed(n) and (ROOT/n).is_file())
    payload, findings, unscanned = {}, [], []
    for name in selected:
        if (ROOT/name).is_symlink():
            raise SystemExit("Symlink requires manual review: "+name)
        data = (ROOT/name).read_bytes()
        found, notes = audit(name, data)
        findings.extend(found)
        unscanned.extend({"path": name, "reason": note} for note in notes)
        payload[name] = data
    # The exported instruction is deliberately not the Replit project's private memory.
    payload["AGENTS.md"] = payload["docs/handoff/AGENTS.md"]
    payload["README.md"] = b"""# Goodwill - clean source handoff

**Start with [the VS Code/Codex handoff](docs/handoff/README.md).**
This is a history-free current-source snapshot. The next priority is a smaller
local Superset demonstration, not implementation of every historical roadmap.
Read AGENTS.md before making changes.

---

The previous project README is preserved below for technical context. Its
historical setup and acceptance claims are not a turnkey local launch.

""" + payload["README.md"]
    payload[".gitignore"] += b"""

# Clean handoff: never re-add private workspace or runtime material.
/.agents/
/.local/
/attached_assets/
/.replit
/replit.md
/ProjectManagement/
/docs/goodwill/evidence/target/drive-*.md
/docs/goodwill/evidence/github/deck.md
*.sql
*.dump
*.log
"""
    if findings:
        print(json.dumps({"status": "BLOCKED_REVIEW_REQUIRED", "findings": findings}, indent=2))
        raise SystemExit(1)
    manifest = {
        "formatVersion": 1, "gitHistoryIncluded": False,
        "audit": {
            "scope": "Selected current-file bytes only; bounded token/credential and email patterns.",
            "result": "No unresolved pattern findings in selected text files.",
            "limitations": ["Not a full security audit.", "No checkpoint history scanned or exported.",
                           "No environment secret values read.", "Binary assets need separate visual review."],
            "unscannedBinaryFiles": unscanned,
        },
        # Excluded upload filenames can themselves identify people or private
        # documents. Record only a count/categories, not their names.
        "excludedTrackedFiles": len(names-set(selected)),
        "excludedCategories": ["Git/checkpoint history", "Uploaded reference material",
                               "Agent memory and workspace settings",
                               "Original source documents and operational evidence",
                               "Separate presentation material", "Runtime data and credentials"],
        "files": [{"path": n, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
                  for n, b in sorted(payload.items())],
    }
    payload["HANDOFF_MANIFEST.json"] = (json.dumps(manifest, indent=2)+"\n").encode()
    output = (ROOT/args.output).resolve()
    if not output.is_relative_to(ROOT):
        raise SystemExit("Output must stay inside the workspace.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(payload.items()):
            archive.writestr(name, data)
    # Verify the actual archived bytes, not just filenames or source hashes.
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        for entry in manifest["files"]:
            assert hashlib.sha256(archive.read(entry["path"])).hexdigest() == entry["sha256"]
        assert not any(n.startswith((".git/", ".agents/", "attached_assets/")) for n in archive.namelist())
    print(json.dumps({"status": "exported", "path": output.relative_to(ROOT).as_posix(),
                      "files": len(payload), "bytes": output.stat().st_size,
                      "excludedTrackedFiles": manifest["excludedTrackedFiles"],
                      "unscannedBinaryFiles": len(unscanned)}))

if __name__ == "__main__":
    main()