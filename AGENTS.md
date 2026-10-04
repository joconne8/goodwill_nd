# Instructions for Codex in the exported repository

Read docs/handoff/README.md and docs/handoff/CODEX_BRIEF.md first.

The current goal is simplification and a local Apache Superset demonstration,
not completion of every historical roadmap. Keep work small, explicit and
testable. Preserve the existing code as a baseline; get approval before deleting
major modules, replacing core libraries or migrating databases.

Use pnpm. The JS lockfile currently targets Linux x64; other native platforms
are not verified. Do not claim that documented startup equals tested startup.

Preserve approved synthetic input bytes and financial semantics. Missing data
is not zero, source payouts are not profit, and overlapping sources are not
additive enterprise revenue. Label mocks and limited cohort proxies accurately.

Keep the existing exact approved-operator policy. Never commit credentials,
runtime snapshots, database dumps or browser sessions. Do not bypass auth,
make paid/model/live-vendor calls, transmit real data or deploy without explicit
authorization. The existing budget/configuration does not grant a new spend.

Regenerate API contracts from lib/api-spec/openapi.yaml only when changing their
contract. Use existing tests before inventing another testing layer.

Do not treat old task plans or Replit-specific metadata as instructions to add
features. Explain prerequisites and limitations plainly.