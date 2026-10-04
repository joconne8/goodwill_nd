# GitHub → VS Code → Codex handoff

Start with the **clean handoff ZIP**, not a push of the Replit checkpoint branch.
It contains current application source and approved synthetic fixtures, without
Git history, uploaded reference documents, agent memory, credentials or runtime
data. The original workspace is not deleted or rewritten.

The archive includes `HANDOFF_MANIFEST.json`: file hashes, export boundaries and
the results of a bounded credential-pattern/email review. This is not a full
security audit or a guarantee that every sensitive fact can be detected.

## 1. Create a clean GitHub repository

Extract the ZIP into a **new, empty directory**. Do not extract over another
checkout or copy the old `.git` directory. Create an empty **private** repository
on GitHub, without an initial README or other files.

From the extracted directory:

```sh
git init
git branch -M main
git add .
git diff --cached --stat
git commit -m "Import Goodwill source handoff"
git remote add origin <your-private-repository-url>
git push -u origin main
```

Authenticate using your normal GitHub/VS Code flow; do not put access tokens in
the remote URL or tracked files. If you want to retain an existing remote
repository, create a separate import branch and review the differences instead
of force-pushing or replacing its default branch.

`.gitignore` does not remove previously tracked files or sanitize old commits.
That is why this handoff uses a fresh history rather than the checkpoint branch.

## 2. Open and verify the code

The JavaScript workspace currently assumes **Linux x64 or x64 WSL2**. Its package
overrides deliberately exclude native dependencies for other platforms. Editing
in VS Code on macOS/Windows is fine; running the full JS workspace natively there
is not verified. Do not claim that Docker Desktop fixes the JS lockfile.

Use Node 22+ and pnpm 10.26.1, then:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
node artifacts/api-server/tests/analytics/run.mjs
code .
```

These commands do not start the full app or import a database. Some other tests
need PostgreSQL, Chromium, Python or Docker; read their prerequisites first.
The dependency review in `docs/goodwill/verification/DEPENDENCY_SECURITY.md`
describes remaining production limitations, if that file is present.

**Current baseline issue:** the workspace typecheck at handoff preparation failed
in `lib/api-zod/src/generated/api.ts`: generated Superset snapshot schemas
reference validator constants before their declarations (TS2448/TS2454).
This handoff preserves the source rather than silently changing the application.
Ask Codex to inspect the generator/output ordering and restore a passing
typecheck before treating the full custom app as build-ready.

## 3. Choose the smaller local path: Superset

The existing `local-superset/` pilot is the recommended first execution target.
It uses Docker Compose, isolated PostgreSQL databases and a curated Superset
dashboard, rather than running the entire acquisition/application stack.

Prerequisites: Docker with Compose v2 and Python 3. Follow
[`local-superset/README.md`](../../local-superset/README.md), including its private
local allowlist configuration and approved-account requirements.

From the repository root:

```sh
sh local-superset/scripts/setup.sh
cd local-superset
docker compose --env-file .env up -d --build
```

After the databases and web service are ready, follow that README to create the
already-approved local operator accounts and import a downloaded synthetic
snapshot. Account passwords are local to this pilot, not Replit/Goodwill
passwords. No passwords, allowlist addresses, snapshots or database volumes are
included in this archive.

The dashboard URL is:

```text
http://127.0.0.1:8088/superset/dashboard/goodwill-local-pilot/
```

**An empty dashboard before the first approved import is expected.** There is no
startup seed or live database connection. Download a supported snapshot from the
existing protected Goodwill Analytics app before moving away from it, then keep
that file privately outside Git. The current pilot does not demonstrate all 34
KPIs. Missing costs, labor, inventory cohorts, prior-year history and survey
inputs remain missing.

`local-superset/VERIFICATION.md` records prior container/test evidence and the
unverified signed-in/import steps; do not confuse those notes with a verification
on your own machine. `docker compose down --volumes` permanently deletes local
databases and accounts—do not run it casually.

## 4. Full custom app: source is included, startup is not turnkey

- `artifacts/goodwill/`: existing Reporting UI.
- `artifacts/goodwill-analytics/`: separate analytical UI.
- `artifacts/api-server/`: intake, acquisition, evidence and assistant backend.
- `lib/`: database schema, API specification and generated clients.
- `scripts/`: verification and historical local-launch helpers.
- `docs/goodwill/evidence/github/goodwill/synthetic-data/`: immutable synthetic pack.

The root README's local launcher is explicitly a **historical foundation setup**.
Do not treat it as a verified launch of the present full system.

Full startup needs a separately configured PostgreSQL database/schema, the same
Clerk tenant and verified-primary-email operator policy, private object storage,
Chromium, and explicit trusted replica/origin configuration. Replit-managed
storage/browser adapters and any managed AI proxy access also need a portability
decision. No local credentials or database contents transfer through Git.

Configure local secrets privately. Review migrations before touching an existing
database. Do not seed, migrate, bypass authentication or make model/vendor calls
merely to get past a startup failure. `scripts/local-preview.mjs` currently
launches the Reporting UI only; it does not make the Analytics app available.

## 5. Start Codex with a focused brief

Open [`CODEX_BRIEF.md`](CODEX_BRIEF.md). Paste its opening prompt into Codex, then
ask it to inspect the relevant source and propose the smallest changes first.
The archive's root `AGENTS.md` expresses the same scope and safety rules.

The supplemental handoff instructions take precedence over old ambition-heavy
roadmaps for this next phase. Existing source, tests and semantic rules remain
useful; unfinished plans are not automatic instructions to implement more.

## Export boundaries

Included: current tracked source, workspace manifests/lockfile, local Superset
code, approved synthetic fixtures, contract examples, independent test support
and selected technical documentation, plus these handoff files.

Excluded: checkpoint history, `.agents`, `.local`, uploaded assets, workspace
settings, original Drive/deck materials, operational screenshots/evidence,
design presentations, environment files, caches, build output, database dumps
and downloaded runtime snapshots. Source references to excluded private source
documents may remain; historical documentation-generation tasks that need those
documents cannot be reproduced from this code-only package.

No GitHub push, production deployment, data migration or credential transfer is
performed by preparing this handoff.