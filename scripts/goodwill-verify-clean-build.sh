#!/usr/bin/env bash
# Verify current deliverable as a fresh checkout, without copying dependencies,
# generated build caches, ignored credentials or local database setup.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/goodwill-clean-build.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT
cd "$root"
git ls-files --cached --others --exclude-standard -z |
  tar --null -T - -cf - |
  tar -xf - -C "$scratch"
cd "$scratch"
pnpm install --frozen-lockfile

# Record generated contracts before regeneration; fresh dependencies must not
# change committed client output. No hand edits or weakened contract checks.
find lib/api-client-react/src/generated lib/api-zod/src/generated -type f -print0 |
  sort -z | xargs -0 sha256sum > "$scratch/contracts.before"
pnpm --filter @workspace/api-spec run codegen
sha256sum --check "$scratch/contracts.before" > /dev/null
pnpm run typecheck
pnpm --filter @workspace/api-server run build
NODE_ENV=production PORT=25979 BASE_PATH=/ pnpm --filter @workspace/goodwill run build
NODE_ENV=production PORT=8081 BASE_PATH=/__mockup pnpm --filter @workspace/mockup-sandbox run build
node --test scripts/goodwill-verify-dependencies.mjs
printf 'PASS: fresh checkout frozen install, deterministic codegen, typecheck, all builds and UUID compatibility\n'