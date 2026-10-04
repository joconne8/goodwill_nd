# Chronological working script and compact storyboard

**10 minutes is a rehearsal assumption, not an official presentation/video cap.**
Official format: recorded workflow inside Google Slides, then questions. Driver
actions below are for creating/rehearsing that recording; do not assume a live
browser is permitted in the room. Check [official rules](OFFICIAL_RULES.md) first.

Roles are placeholders, not personal assignments:
**P** = [Presenter]; **D** = [Demo driver]; **R** = [Separate human reviewer];
**E** = [Delivery evidence owner]. One person may narrate and drive, but independent
approval must not be implied unless actually supplied.

All fallback media must retain their mode/date/build label. A screenshot is not a
recording, a test JSON is not a live product, and a concept card is not a chatbot.
Do not pause to debug during the talk. Use the fallback within the same time budget.

## 10-minute working version

### S0 · 0:00–0:45 · Problem and mission · 45 seconds

**Purpose / readiness:** Explain why retrieval matters before showing software.
Sourced stakeholder account; outcome savings unmeasured.

**P says:**
> Amanda repeats Upright report selection, date entry, generation and download,
> then consolidates the results in spreadsheets. Finance also faces re-entry at
> close. Her interview describes roughly 30 to 45 minutes for a competent report
> pull, not a measured baseline. Debie needs timely management visibility.
> Goodwill funds education, job training and career navigation. Our proposed
> value is reliable repeatable reporting and less manual handling—not a promised
> increase in profit.

**D actions / evidence:** Show storyboard frame 1 with before workflow:
`portal clicks → download → spreadsheet consolidation → re-entry → delayed view`.
Show source footer: master synthesis §§1, 3, 7; corrected brief §§Problem/Why.
Do not put “30–45 minutes saved” on screen. The separate 30–60-minute daily
estimate in the brief is also unconfirmed, not an independent measured total.

**Transition:** “We start where Amanda's work starts: getting the right report.”
**Fallback:** Static workflow frame with citations; no numerical savings graphic.

### S1 · 0:45–1:25 · Three layers and scenario · 40 seconds

**Purpose / readiness:** Set the evidence boundary. BASELINE + CONDITIONAL layers.

**P says:**
> Following Wicks's three-layer framing, acquisition produces a file, trusted
> centralized data validates and computes it, and applications expose those facts.
> Our primary example is synthetic Upright paid-order items, August 1–7 in
> Eastern time. August 8–14 is a second parameter test, never an added total.
> This portal is simulated; a verified download is not yet a published metric.

**D actions / evidence:** Show frame 2, A/B date cards and execution-mode labels.
In a delivery-cleared app, set Start date `2026-08-01`, End date `2026-08-07`.
In v2 click **Apply reporting dates**; in foundation choose those inputs directly.
Keep source `upright`, report `paid_order_items`, USD, all stores.

**Transition:** “First we teach and review a bounded workflow; then we reuse it.”
**Fallback:** Show [readiness ledger](READINESS.md) and state which layers remain
test evidence or conditional; do not show reserved contract examples as live data.

### S2 · 1:25–3:10 · Supervised discovery and review · 105 seconds

**Purpose / readiness:** Central intended wow moment, CONDITIONAL / unavailable
in audited checkout. Exact executable recipe controls must come from accepted
acquisition handoff, not invented interface labels.

**P says if actual authorized discovery is cleared:**
> In this supervised synthetic run, Jev selects among observed allowed controls.
> Code supplies dates and validates report identity. The result is a proposed
> reusable recipe, not permission to run it. Our reviewer checks its parameters,
> expected states and downloaded evidence, then explicitly approves this version.
> AI does not compute the financial result or approve its own workflow.

**D/R actions / evidence:** Follow [discovery cue](CUE_CARDS.md#discovery-review-and-replay).
Show authorization/mode label, observed controls and constrained decisions for A.
Show actual browser download, byte hash and verified run. Open real proposed
recipe artifact; R checks allowed source/report/date parameters, controls, states
and safe-stops, and shows the recorded version approval. If pre-approved, say so;
do not stage a new approval as if it happened on camera. Match run/recipe IDs.

**Current fallback wording:**
> Actual Jev discovery and an approved reusable recipe are not available in this
> checkout. We can show real-browser deterministic baseline test evidence against
> the synthetic portal. This is not a discovered macro or a live Upright connector.

**D fallback actions / evidence:** Open saved [browser checks](../acquisition/evidence/browser-checks.json),
locate A's download case/verified run/steps and show A's actual saved CSV plus its
SHA256 from [readiness](READINESS.md). If baseline environment is cleared,
set A → **Generate report** → **Download CSV**, without importing yet.
Describe review as a future gate, not a performed approval. If scripted-provider
evidence later replaces this fallback, visibly label **scripted provider, no
actual Jev call**. No supplied video means no “play recorded discovery” cue.

**Transition:** “A reusable workflow earns trust by handling a different period
without new model decisions and without changing the report's meaning.”
**Fallback:** Stay on the labeled evidence file; no fabricated review badge.

### S3 · 3:10–4:15 · Approved replay on period B · 65 seconds

**Purpose / readiness:** Prove parameterization, not aggregate growth.
CONDITIONAL approved recipe; existing baseline browser download is TEST EVIDENCE.

**P says only with approved artifact and counters:**
> We reuse that approved recipe version with August 8–14. Replay makes zero model
> calls. The browser actually downloads 129 synthetic item rows; independent
> controls expect $5,972.74 net item sales. This is a different scope, not revenue
> added to the first week. Faster or cheaper than discovery is not established.

**D actions / evidence:** Select same approved recipe version; change only
start/end parameters to B; execute deterministic replay; show mode/call count,
terminal verified state, 20,454-byte download and exact hash. Do not claim zero
calls solely because a UI badge says so: use recorded execution/provider accounting.
If no approved recipe, show B's saved real-browser download case and state
“deterministic baseline test, not discovered approved replay.” Alternatively
baseline **Generate report → Download CSV** for B, visibly labeled manual.

**Transition:** “Now return to the first week and follow its file into the numbers.”
**D exit:** Return dates to A. With v2 click **Apply reporting dates**; do not
import B into A or leave B's metrics beside an A label.
**Fallback:** Saved B CSV and browser-check case; no fake counter or timing claim.

### S4 · 4:15–6:05 · Trusted data before dashboard · 110 seconds

**Purpose / readiness:** Show validation, reconciliation, provenance and duplicate
safety before giving business results. CONDITIONAL integrated path; BASELINE is
narrower; isolated data tests remain TEST EVIDENCE.

**P says:**
> Verification checks the downloaded bytes; intake separately checks schema,
> period and row validity. Accepted rows feed deterministic arithmetic:
> $8,041.79 gross items minus $450.58 item refunds equals $7,591.21.
> Shipping, tax and fees stay separate. Repeating the same accepted file must
> not add revenue. Missing or rejected data cannot certify complete coverage.

**D actions / evidence, delivery-cleared v2:**
1. **Operations**; A's verified run → **Download original** (compare hash) →
   **Import verified run**. Show intake attempt state/counts, not just toast.
2. **Inspect batch**; show artifact/run/batch IDs, exact filename/size/SHA256,
   accepted/rejected/duplicate dispositions and reconciliation expected/actual/
   difference. Check counts account for input; no blocking discrepancy.
3. In **Reporting**, A/upright/net item sales, all stores, **No grouping**.
   **Inspect contributing evidence**; show publication/definition version and
   one accepted data-record ordinal back to gross/refund source cells.
4. Return **Operations**; import the same verified run again. Show duplicate
   reference and no inflated records/totals. Return to same A query/revision.
5. **Evidence CSV** and **Summary CSV**; open exported metadata, source/period/
   publication/definition/coverage and expected metric. Export checksum identifies
   export bytes, not the original acquired-file checksum.

**BASELINE fallback:** A → **Generate report → Download CSV → Import CSV file**
(unchanged downloaded file). Show result/source/file/SHA256/import ID, 141 rows
and expected gross/refund/net. Import it again; show unchanged publication identity
and totals. No v2 private-archive, reconciliation page or export is claimed.
For richer controls show labeled [data controls](../data/evidence/controls.json)
and [handoff limitations](../data/INTEGRATION.md); these are not the A live UI.

**Transition:** “Trust also means a bad run cannot silently replace a good result.”
**Fallback:** Evidence ledger + narrower baseline. If no working baseline, show
historical evidence and acknowledge no fresh end-to-end proof; no synthetic UI fill.

### S5 · 6:05–6:50 · Visible safe failure · 45 seconds

**Purpose / readiness:** Demonstrate exception and last-good behavior.
CONDITIONAL integrated failure; BASELINE edited-file rejection alternative.

**P says:**
> Here a changed page stops acquisition instead of silently selecting a different
> report. The exception names the failed step and manual next action. The first
> week's last-good result remains identified; a failed attempt is not fresh data.

**D actions / evidence:** In v2 **Operations**, A unchanged; **Replica scenario**
→ `dom drift`; **Acquire simulated report**. Show failed state, failure code and
next action, no acquired artifact/no batch publication. Return **Reporting** to
the pinned A result; show same value/revision with freshness/exception context
if provided. Do not narrate warning UI not actually shown.

**BASELINE fallback:** In a separate labeled copy of A's downloaded CSV edit one
amount, leave original intact; use **Import CSV file** with edited copy. Show
rejection and the original A result still $7,591.21/same import ID. Use only a
delivery-approved negative file; never alter the fixture or “repair” amounts.
No recording owner may create a failure on real partner systems.

**Transition:** “Those controls are why the management view can be useful.”
**Fallback:** Existing browser drift-case evidence + before/after foundation
verification, labeled separate tests, not a continuous integrated run.

### S6 · 6:50–7:55 · Applications: dashboard and scope · 65 seconds

**Purpose / readiness:** Connect supported views to decisions. CONDITIONAL v2.

**P says:**
> The source-local sales view lets Debie see activity and investigate store
> attribution. Daily platform-local customers show missing IDs rather than invent
> buyers. Listings and one selected backlog snapshot help operations decide where
> to investigate listing capacity. Their supported scope is ShopGoodwill/eBay,
> not Upright or all Goodwill inventory. Margin, labor, sell-through, unsupported
> YTD, budget and prior-year comparisons remain unavailable.

**D actions / evidence:** A **Reporting**, source upright, all stores, No grouping,
net item sales; point to definition and coverage. Change **Breakdown** to Eastern
day, then Store; show **Unknown / unresolved attribution** bucket and restore all
stores/No grouping before primary evidence. Show daily customer partial/coverage
state without equating buyers with 141 rows.

Click **Listings** and **Backlog** while upright remains selected: show unsupported
platform state. Optional cleared supplemental operations clip: explicitly select
ShopGoodwill or eBay, keep A for listing events, and use one separately declared
snapshot from approved catalog coverage; display snapshot timestamp/universe.
Never add a full-month snapshot to weekly sales. Restore Upright/A before S7.
In 65 seconds, show availability boundaries rather than rush a second metric story.

**Transition:** “The same trusted facts could also answer a question, if the
assistant's connection and policy are verified.”
**Fallback:** Show storyboard frame with “conditional views; not registered at
audit.” Display foundation financial evidence only, not invented customer/listing
cards. Nine workflows are parser/coverage scope, never nine live connectors.

### S7 · 7:55–8:40 · Sazzle questions and limits · 45 seconds

**Purpose / readiness:** Show the third layer without claiming an absent integration.
Current CONCEPT; working/recorded inclusion requires [Sazzle gates](CUE_CARDS.md#sazzle-three-prepared-questions).

**P says now:**
> Sazzle is the user's existing chatbot, but we have not located or verified its
> connection in this checkout. These are prepared concept answer cards, not a
> working integrated chat. It should retrieve deterministic published facts,
> cite the file and scope, and say unavailable for unsupported KPIs.

**D actions / evidence:** Show three cards in order: supported Upright/A net
question, evidence/source explanation, unsupported margin/labor/sell-through.
Use exact prompts/expected boundaries in cue cards. Do not animate a fake chat.
If cleared working build is later supplied, ask the three actual questions, show
citations pinned to the same A publication, and visibly identify model/data mode.
If supplied recording only, title it RECORDING + build/date/mode and do not call live.

**Transition:** “The handoff is a controlled workflow and evidence, not just a chat.”
**Fallback:** Keep concept label; no external model call or invented citations.

### S8 · 8:40–10:00 · Handoff, before/after and protected pilot · 80 seconds

**Purpose / readiness:** Close on realistic adoption. Handoff outline exists;
approved reusable recipe distribution remains CONDITIONAL.

**P says:**
> Before: portal navigation, downloads, spreadsheet consolidation and manual
> re-entry. Proposed after: an approved parameterized workflow, visible failures,
> reconciled facts and familiar evidence exports. Our synthetic controls show
> file correctness and deterministic totals; we have not measured staff savings.
> The intended handoff includes a versioned skill and macro with parameters,
> prerequisites, expected states, approval and safe-stop instructions. Today we
> can share verified synthetic test artifacts and documentation, not an approved
> discovered recipe or credentials.
>
> A pilot starts with approved live access and Microsoft/Copilot policy, metric
> definitions and finance sign-off, a measured baseline, named support ownership,
> and a parallel run. Keep the existing close protected until workbook parity.
> CSV is spreadsheet-friendly, not a validated Business Central import or posting.
> Excel and Power BI compatibility are intentions to review with Goodwill.

**D actions / evidence:** Show [handoff manifest](CUE_CARDS.md#partner-handoff-manifest),
before/after frame and [pilot approval sequence](REHEARSAL.md#partner-pilot-close).
Highlight “maintenance owner TBD—partner must name before pilot.”
Read common disclosure from package README if not already covered; keep all
mode labels visible and identify borrowed fixtures/scaffold and AI-assisted code.

**Transition / final line:** “The next decision is whether Goodwill will approve
a one-source parallel pilot with explicit owners and finance controls.”
**Fallback:** Documentation-only handoff. No pilot commitment, universal recorder,
Monday-ready deployment, automatic financial posting or promised profit uplift.

## Compact storyboard — content and speaker cues, not created slides

| Frame | Title / minimal visible content | Speaker / driver cue | Proof / readiness |
|---|---|---|---|
| 1 | Amanda's repeated work; Debie's delayed view; mission; estimate ≠ measured savings | S0; show before chain | Stakeholder sources |
| 2 | Acquire → trusted data → applications; A/B; synthetic/simulated | S1; lock A | BASELINE + CONDITIONAL |
| 3 | Discover → review → approve version | S2; show real artifact if present | CONDITIONAL; current baseline evidence substitute explicitly labeled |
| 4 | Same recipe, different dates; verified bytes; zero calls only if logged | S3; B then restore A | CONDITIONAL recipe; TEST EVIDENCE baseline download |
| 5 | Exact file → batch → rows → reconciled facts → evidence/export | S4; show A controls and duplicate | CONDITIONAL integrated; narrower BASELINE |
| 6 | Failure identified; last-good retained | S5; safe synthetic fault | CONDITIONAL or labeled test/baseline |
| 7 | Source-local leadership/operations; unsupported metrics visible | S6; restore A | CONDITIONAL |
| 8 | Three Sazzle questions, including unavailable | S7; concept label unless verified | CONCEPT |
| 9 | Handoff; before/after; approved parallel pilot; built/borrowed/gated | S8; close and disclosure | Documentation + CONDITIONAL adoption |

## Five-minute cut — also an assumption

Use the same scenario, labels and fallback rules; never cut disclosure/trust to
make an absent feature look working. These are shortened speaker cues using the
same exact driver actions, evidence and transitions as S0–S8 above.

| Segment | Seconds | Short wording / action to retain |
|---|---:|---|
| S0 | 30 | “Amanda retrieves and consolidates; Debie waits. The interview estimate is not measured savings. Reliability supports Goodwill's mission.” Before chain |
| S1 | 20 | Three layers, synthetic Upright/A, B is separate |
| S2 | 45 | Actual authorized discovery + approval excerpt if verified; otherwise disclose absent recipe and show labeled real-browser baseline evidence |
| S3 | 40 | B parameters, actual bytes/hash, zero calls only if logged; restore A |
| S4 | 60 | A controls, source-to-publication proof, duplicate-safe replay, pinned evidence/export if cleared |
| S5 | 25 | One safe failure, explicit reason, unchanged last-good |
| S6 | 30 | Source-local sales/customer scope; listing/backlog availability; unsupported KPIs |
| S7 | 15 | Show all three concept/verified question cards; no fake chatbot |
| S8 | 35 | Skill handoff status, no measured savings, approved parallel pilot, protected close/CSV limitations and borrowed disclosure |

**Total: 300 seconds.** If actual actions cannot fit, obtain a longer allowance
or lower the evidence claim. A cut or screenshot cannot be narrated as an
uncut end-to-end run. Record an honest continuous shorter slice, not sped-up
numbers with hidden missing steps.

## Modular longer / Q&A version

No fixed official duration. Choose modules only within the confirmed allowance.
An illustrative 20-minute rehearsal is the 10-minute script + these 10 minutes:

| Module | Minutes | Driver / purpose / evidence / honest fallback |
|---|---:|---|
| M1 Reviewed recipe anatomy | 2 | D/R open actual version + approval, parameter binding and drift checks. If absent, show handoff outline marked CONCEPT |
| M2 Full lineage and edge cases | 3 | E uses delivery's recorded A lineage and rejected-row proof. Explain duplicates, overlap and reviewed corrections; no new demo-time supersession |
| M3 Leadership and operations | 2 | D uses accepted supplemental source/snapshot evidence, named coverage and unknown stores; otherwise supported-scope explanation, no figures |
| M4 Policy and accounting | 2 | P answers Microsoft/Copilot, private access, workbook parity and no BC posting using adoption gates |
| M5 Measurement and ownership | 1 | P shows baseline template and named support commitments only if confirmed; otherwise TBD and unmeasured |

Use the [Q&A answers](CUE_CARDS.md#concise-qa) independently of these modules.
An optional two-minute winner encore must be separately confirmed; it is
unscored in published instructions and must not be mistaken for the main demo.