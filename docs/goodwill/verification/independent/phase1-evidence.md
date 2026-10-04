# Goodwill independent QA — phase 1 evidence

Status: independent fixture oracle and isolated feature checks completed. This is
not human review, integrated-runtime acceptance, or accounting approval.

## Independent expected ledger

`oracle.py` reads the unchanged original fixture copies under
`docs/goodwill/evidence/github/goodwill/synthetic-data/`. It parses CSV record
ordinals with Python `csv`, computes amounts with `Decimal` and compares exact-byte
SHA-256 and record counts to the fixture manifest. It does not import the data
feature's metric code or `docs/goodwill/data/independent-controls.py`.

Reproduce:

```sh
python3 docs/goodwill/verification/independent/oracle.py \
  > docs/goodwill/verification/independent/oracle-output.json
python3 -m py_compile docs/goodwill/verification/independent/oracle.py
```

Result: PASS; 15/15 primary input hashes and data-record counts match the manifest.
All 41 named manifest financial field totals, the separate source-net and
net-item-sales formulas, both carrier expense formulas, and all 62 daily
ShopGoodwill/eBay manifest controls match. The complete independently calculated
daily ledgers (rows, gross, refunds, net, distinct buyers, and missing buyer/store
counts) are in `oracle-output.json`. Source/store/month and day listing counts
include June/July/August and store filters; unknown-store listing rows remain
separately filterable. Each of the three inventory instants is calculated as an
independent scope, checked against catalog-selected item identities and manifest
controls, and records its own item-set digest, workflow-state counts, platform
counts, missing stores, and unlisted backlog.

Source-local expected net-item cents: CashMonkey 1,032,846; Upright 3,615,710;
ShopGoodwill 11,126,218; Books 918,493; eBay 5,551,526; Amazon 1,306,005.
Source-net cents include Jewelry 1,799,730, and carrier expense cents are shipping
3,281,419 and FedEx 2,012,104. These are separate source controls, not an
additive cross-source revenue total.

Missing buyer/store source ordinals, separated by file and field, are enumerated
in `oracle-output.json`. Base-source buyer/store missing ordinals match the
declared exception ledger. The report explicitly marks the two September
incremental inputs (30 eBay, 60 ShopGoodwill rows), the 25-row eBay duplicate
replay, and five invalid-row fixture as opt-in exclusions; it independently
checks their replay/invalid/date/key properties and verifies they are not part of
August primary inputs.

## Disposable fixture-integrity regression

The upstream fixture test includes `test_reproducibility`, which invokes its
generator. It was run only against a disposable copy:

```sh
TMP=$(mktemp -d /tmp/goodwill-fixture-test.XXXXXX)
cp -a docs/goodwill/evidence/github/goodwill/synthetic-data "$TMP/synthetic-data"
(cd "$TMP/synthetic-data" && python3 -m unittest -v test_data)
rm -rf "$TMP"
```

Result: PASS, 10 tests; the reproducibility test regenerated only the disposable
copy. The original fixture pack was re-read by the independent oracle afterward
and all 15 original hashes/counts still passed.

## Independent feature-service comparison

```sh
node scripts/goodwill-verify-independent-service.mjs
```

Result: PASS. The test-only harness seeds the 15 unmodified inputs into injected
repository/archive doubles, checks batch hashes/counts, and compares the feature
service's source-net, net-item-sales, expense, daily customer/net-sales, listing
period/platform/store filter, and each snapshot/platform backlog outputs against
the independent JSON ledger. This is a test-injected service result only; it is
not a durable deployment or integrated runtime acceptance.

## Existing feature test inspection and runs

All browser tests used test-only environment overrides:

```sh
GOODWILL_PLAYWRIGHT_MODULE=/mnt/pid2/node_modules/playwright/index.mjs
GOODWILL_CHROMIUM=/repl/tools/bin/chromium
```

The reporting browser suite was run from a temporary QA sandbox, with test output
paths redirected into that sandbox so no builder evidence or shared project paths
were written:

```sh
GOODWILL_PLAYWRIGHT_MODULE=/mnt/pid2/node_modules/playwright/index.mjs \
GOODWILL_CHROMIUM=/repl/tools/bin/chromium \
REPLIT_DEV_DOMAIN="$REPLIT_DEV_DOMAIN" \
node "$QA/artifacts/goodwill/src/features/reporting-tests/run.mjs"
```

Result: PASS, 6 tests (reporting UI plus model tests). The UI suite exercises a
test-only Router, injected in-memory archive/repository, and run-history stub.

The acquisition suite was also isolated in a temporary QA sandbox:

```sh
GOODWILL_PLAYWRIGHT_MODULE=/mnt/pid2/node_modules/playwright/index.mjs \
GOODWILL_CHROMIUM=/repl/tools/bin/chromium \
GOODWILL_ESBUILD_MODULE="$QA/artifacts/api-server/node_modules/esbuild/lib/main.js" \
node "$QA/artifacts/api-server/tests/acquisition/run.mjs"
```

Result: PASS, 12 tests including the acquisition UI, core lifecycle, and a
connection-local Postgres adapter test. Browser acquisition uses its injected
test replay/archive/repository; manual-intake requests are transport spies.

Existing data tests were run from a temporary sandbox (fixture and output paths
kept in that sandbox):

```sh
node "$QA/artifacts/api-server/tests/data/run.mjs"
```

Result: PASS, 15 tests, including the test-only service/control suite and a
connection-local Postgres adapter test. The legacy report tests and acquisition
core tests were bundled to temporary output and separately run from the
disposable sandbox: PASS, 10 legacy report tests and 10 acquisition core tests.

These tests use fixtures, in-memory adapters, stubs, or temporary DB tables. Their
results do not certify managed object-storage/archive durability, cloud lifecycle,
process restart against a persistent deployed database, actual external-source
browser compatibility, final routing/auth wiring, or the integrated runtime.

## Original checksum/period defect reproduction (pre-fix; superseded)

```sh
node scripts/goodwill-verify-independent-wrong-period.mjs
```

Result: the reproduction test passes and confirms a product defect. Under
test-only service injection, the original August eBay bytes requested for
2026-08-02..2026-08-31 are quarantined as `RECONCILIATION_MISMATCH`. Submitting
the exact same bytes for their corrected 2026-08-01..2026-08-31 period returns
`duplicate`, points to the quarantined attempt, and has no publication ID. The
checksum replay lookup is suppressing a corrected-period attempt because it
includes the quarantined wrong-period attempt. Regression path:
`docs/goodwill/verification/independent/wrong-period-check.test.ts`; runner:
`scripts/goodwill-verify-independent-wrong-period.mjs`.

This was the initial independent finding. The owner later added exact period
identity to the replay shortcut; see “Correction review — period-scoped checksum
replay” below for the acceptance retest. This historical reproduction is not the
current verdict.

## Human acceptance gate

No human review is claimed. A human teammate/reviewer must inspect this evidence
and the eventual fix; the lead must run integrated routing/auth, persistence,
archive/restart, correction/replay-race, and whole-system checks. Production or
accounting acceptance also requires its own authorized human decision. No merge,
publishing, external GitHub write, or financial action was performed.

## Correction review — period-scoped checksum replay

The owner change was independently inspected in
`artifacts/api-server/src/goodwill/data/intake.ts` around the checksum replay
lookup. The scoped diff adds exact `period.startDate` and `period.endDate`
predicates to the existing source/report/checksum match; it leaves artifact
identity, parsing, quarantine, and publication logic untouched. The existing
same-period replay-state behavior remains unchanged.

The prior defect-reproduction case was converted to acceptance in
`wrong-period-check.test.ts`. Reproduce:

```sh
node scripts/goodwill-verify-independent-wrong-period.mjs
```

Result: PASS, one test. It confirms the wrong-period attempt remains unchanged
and quarantined as `RECONCILIATION_MISMATCH`; the identical bytes at full August
publish with 900 accepted rows and `net_item_sales` 5,551,526 cents ($55,515.26);
an exact full-August replay is duplicate of that accepted batch with the same
publication ID. It then submits identical malformed-header bytes under July and
full-August periods. Both are parsed/quarantined as `INVALID_HEADER`, the
different-period attempt is not shortcut to duplicate, and the accepted August
publication/value remain last-good.

After the correction, the independent actual-service comparison was rerun:

```sh
node scripts/goodwill-verify-independent-service.mjs
```

Result: PASS, one test. The full existing data test suite was rerun from the
disposable QA sandbox (using the current feature source):

```sh
node /tmp/goodwill-data-qa.ElJG8B/artifacts/api-server/tests/data/run.mjs
```

Result: PASS, 15 tests, including its connection-local Postgres adapter test.
This is technical correction acceptance for the tested service path only, not a
whole-delivery pass or human approval.

The lead owns integration/runtime verification. The v2 API currently denies all
operators pending a human-approved access policy; no authenticated UI or
browser-acquisition runtime was verified or is claimed here. Provisioning of a
private bucket and the lead's reported additive development-table application
are not independently certified by these tests.