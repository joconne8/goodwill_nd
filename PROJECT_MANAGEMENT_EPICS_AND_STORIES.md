# Project Management Epics and Stories

Goodwill Michiana E-commerce Reporting

This backlog turns the master problem summary into granular delivery work. It is written so the team can copy epics and stories into GitHub Issues, Jira, Linear, Replit tasks, or an agent work queue.

## Priority Legend

- **P0:** Needed for the hackathon vertical slice or core product truth.
- **P1:** Important next layer once P0 works.
- **P2:** Later roadmap, Sprint Lab, or production hardening.

## Status Legend

- **Backlog:** Not started.
- **Ready:** Requirements clear enough to assign.
- **Blocked:** Needs partner decision, credentials, source sample, or policy approval.
- **In Progress:** Actively being built.
- **Review:** Built and awaiting independent review.
- **Done:** Meets acceptance criteria with evidence.

## Epic 0: Scope, Governance, and Delivery Control

### Story 0.1: Freeze Weekend Scope

**Priority:** P0  
**User story:** As the team lead, I need one agreed weekend scope so the team does not build disconnected pieces.  
**Feature details:**

- Define the core demo as: simulated report acquisition, validation, duplicate-safe import, deterministic metrics, and dashboard traceability.
- State that real Goodwill credentials, real customer data, live Business Central posting, and nine live source integrations are out of scope.
- Record P0, P1, and P2 feature boundaries.

**Acceptance criteria:**

- A single scope statement exists in the repo.
- All team members can explain what is in and out.
- Pitch language matches the scope.
- No feature ticket claims production readiness without evidence.

**Dependencies:** None  
**Owner:** Team lead  
**Reviewer:** Full team

### Story 0.2: Create Requirements Register

**Priority:** P0  
**User story:** As a product owner, I need each requirement tied to a stakeholder and evidence source.  
**Feature details:**

- Create IDs such as `REQ-ING-01`, `REQ-DAT-01`, `REQ-DASH-01`.
- Include stakeholder, source document, business need, acceptance test, priority, and approval state.
- Mark assumptions and unconfirmed definitions.

**Acceptance criteria:**

- Every P0 story maps to at least one requirement ID.
- Requirements distinguish confirmed partner statements from team inference.
- Unconfirmed accounting and metric assumptions are visible.

**Dependencies:** Story 0.1  
**Owner:** Product lead  
**Reviewer:** Independent teammate

### Story 0.3: Create Disclosure Register

**Priority:** P0  
**User story:** As a presenter, I need a clear disclosure list so judges know what is real, synthetic, simulated, borrowed, and future-state.  
**Feature details:**

- List synthetic data files.
- List simulated Upright replica.
- List borrowed libraries, templates, AI-generated code, and open-source components.
- List deferred production requirements.

**Acceptance criteria:**

- Disclosure can be read in under 60 seconds.
- Demo and pitch both use the same disclosure language.
- No hidden fake or unlabeled simulation remains.

**Dependencies:** Story 0.1  
**Owner:** Pitch lead  
**Reviewer:** QA lead

### Story 0.4: Define File Ownership and Work Lanes

**Priority:** P0  
**User story:** As the integrator, I need file ownership so parallel work does not collide.  
**Feature details:**

- Assign owners for acquisition, data pipeline, dashboard, QA, and pitch.
- Assign single owners for shared contracts, migrations, app shell, and lockfiles.
- Define branch/worktree rules if using git.

**Acceptance criteria:**

- Each P0 ticket has one driver and one separate reviewer.
- Shared files have a single owner.
- Merge/review rules are documented.

**Dependencies:** Story 0.1  
**Owner:** Integrator  
**Reviewer:** Team lead

### Story 0.5: Create Demo Script

**Priority:** P0  
**User story:** As a presenter, I need the product demo to prove the exact workflow we built.  
**Feature details:**

- Write a timed demo script.
- Include happy path and one failure path.
- Include synthetic/simulated disclosure.
- Include backup recording plan.

**Acceptance criteria:**

- Script opens with Amanda's workflow and Debie's visibility need.
- Script shows acquisition, validation, duplicate prevention, dashboard, and traceability.
- Script avoids unsupported claims.

**Dependencies:** Story 0.1  
**Owner:** Pitch lead  
**Reviewer:** Full team

## Epic 1: Current-State Workflow and Source Mapping

### Story 1.1: Map Upright Daily Report Workflow

**Priority:** P0  
**User story:** As an operator, I need the Upright workflow documented so it can be automated or replicated safely.  
**Feature details:**

- Capture visible steps: open reports, select Paid Orders, set date range, generate report, download file.
- Record all inputs, outputs, waits, and possible errors.
- Distinguish actual Upright behavior from simulated replica behavior.

**Acceptance criteria:**

- Workflow map includes every click/input known from Amanda's materials.
- Date range is identified as the main variable.
- Unknown details are explicitly listed.

**Dependencies:** Existing Amanda notes/slides  
**Owner:** Acquisition owner  
**Reviewer:** Product lead

### Story 1.2: Map CashMonkey Report Workflow

**Priority:** P1  
**User story:** As an operator, I need CashMonkey documented even though it is less painful than Upright.  
**Feature details:**

- Capture steps: open CashMonkey reports, choose Orders Report, select dates, download.
- Record output format assumptions.
- Mark CashMonkey as lower priority than Upright.

**Acceptance criteria:**

- CashMonkey flow is documented separately from Upright.
- Story does not overstate CashMonkey pain.
- Known fields and unknown fields are listed.

**Dependencies:** Amanda process deck  
**Owner:** Acquisition owner  
**Reviewer:** Product lead

### Story 1.3: Build Source Register

**Priority:** P0  
**User story:** As a data owner, I need every source workflow listed so the system can avoid duplicate and missing data.  
**Feature details:**

- Include Upright, CashMonkey, ShopGoodwill, eBay, Amazon, Goodwill Books, Jewelry, FedEx, EasyPost/OSM/PB, Business Central, allocation workbook, email attachments.
- For each source: owner, purpose, frequency, acquisition method, file type, grain, metrics supported, and unknowns.

**Acceptance criteria:**

- Every source named in sponsor materials appears.
- Each source has a likely acquisition class.
- Sources are not treated as separate sales unless grain confirms it.

**Dependencies:** Master problem summary  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 1.4: Collapse Sources Into Adapter Types

**Priority:** P0  
**User story:** As an architect, I need source workflows grouped by type so we build reusable adapters.  
**Feature details:**

- Classify sources into portal download, CSV/XLSX export, email attachment, accounting lookup, spreadsheet workbook, API, browser automation, manual upload.
- Identify which adapter types are P0.

**Acceptance criteria:**

- Nine named workflows are mapped to fewer acquisition classes.
- P0 focuses on simulated browser download plus manual CSV upload.
- Roadmap sources are labeled P1/P2.

**Dependencies:** Story 1.3  
**Owner:** Architect  
**Reviewer:** Acquisition owner

### Story 1.5: Document Current Excel Daily Summary

**Priority:** P1  
**User story:** As a reporting user, I need the current Excel summary shape documented so the prototype feels familiar.  
**Feature details:**

- Capture rows/columns for channel revenue and customer count.
- Note how totals are computed.
- Identify where Sonia/admin handoff occurs.

**Acceptance criteria:**

- Daily summary layout is represented as a wireframe or table.
- Unknown formulas are marked.
- Dashboard/export story references this layout.

**Dependencies:** Partner sample or sponsor deck  
**Owner:** Dashboard owner  
**Reviewer:** Product lead

### Story 1.6: Document Month-End Allocation Workbook Role

**Priority:** P2  
**User story:** As a finance stakeholder, I need the allocation workbook role documented before any accounting automation is attempted.  
**Feature details:**

- Identify workbook tabs, orange input fields, journal tabs, invoice tab, and Business Central handoff.
- Mark this as roadmap until real workbook review.

**Acceptance criteria:**

- Month-end workflow is separated from daily dashboard workflow.
- No production posting story can proceed without this documentation.

**Dependencies:** Real workbook access  
**Owner:** Finance/data owner  
**Reviewer:** Accounting reviewer

## Epic 2: Synthetic Data and Demo Fixtures

### Story 2.1: Define Common Data Contracts

**Priority:** P0  
**User story:** As a developer, I need shared schemas so acquisition, import, metrics, and UI agree.  
**Feature details:**

- Define `SourceFile`, `ImportBatch`, `SaleRow`, `ListingEvent`, `InventorySnapshot`, `RejectedRow`, and `MetricResult`.
- Include source provenance fields.
- Include synthetic flag.

**Acceptance criteria:**

- Schemas have required fields and examples.
- All adapters and metrics use these schemas.
- Contract version is recorded.

**Dependencies:** Story 0.1  
**Owner:** Data owner  
**Reviewer:** Integrator

### Story 2.2: Generate Synthetic Upright Paid Orders CSV

**Priority:** P0  
**User story:** As a demo builder, I need realistic synthetic Upright-like data to prove the workflow without real data.  
**Feature details:**

- Include order IDs, paid dates, sale amount, refund amount, platform/channel, originating store, buyer ID where available, category where available.
- Include multiple dates.
- Include edge cases: refund, missing store, malformed amount, duplicate row, midnight boundary.

**Acceptance criteria:**

- File is labeled synthetic in filename and contents.
- Expected totals are known independently.
- Date range can filter rows.

**Dependencies:** Story 2.1  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 2.3: Generate Synthetic Second-Source Sales CSV

**Priority:** P1  
**User story:** As a judge, I want to see that the import pattern can support more than one source.  
**Feature details:**

- Create eBay or ShopGoodwill-like CSV with a different column layout.
- Normalize to the same `SaleRow` schema.
- Include platform-local buyer IDs.

**Acceptance criteria:**

- Source fields differ from Upright fixture.
- Adapter can normalize it without changing metrics.
- UI labels it as synthetic.

**Dependencies:** Story 2.1  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 2.4: Generate Synthetic Listing Events

**Priority:** P1  
**User story:** As an operations manager, I need listing activity data to measure throughput.  
**Feature details:**

- Include listing ID, item ID, listed timestamp, originating store, platform, category, employee ID optional.
- Include duplicate events and unknown-store cases.

**Acceptance criteria:**

- Listing event grain is distinct from sale row grain.
- Repeated event policy is documented.
- Expected listing counts are known.

**Dependencies:** Story 2.1  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 2.5: Generate Synthetic Inventory Snapshot

**Priority:** P1  
**User story:** As an operations manager, I need a point-in-time backlog snapshot to measure unlisted inventory.  
**Feature details:**

- Include item ID, state, originating store, snapshot timestamp, category.
- Use demo states such as `awaiting_listing` and `ready_to_list`.
- Include partial/missing snapshot examples.

**Acceptance criteria:**

- Snapshot is not inferred from sales.
- Complete and partial snapshots are distinguishable.
- Expected backlog counts are known.

**Dependencies:** Story 2.1  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 2.6: Create Independent Expected Results Ledger

**Priority:** P0  
**User story:** As QA, I need expected results calculated independently so implementation errors are caught.  
**Feature details:**

- Record expected revenue totals by date/platform/store.
- Record expected rejected rows.
- Record expected duplicate behavior.
- Record expected customer counts where buyer IDs are complete.

**Acceptance criteria:**

- Expected results are not generated by the same metric code.
- QA can manually explain each expected value.
- Tests reference this ledger.

**Dependencies:** Stories 2.2, 2.3, 2.4, 2.5  
**Owner:** QA lead  
**Reviewer:** Data owner

## Epic 3: Simulated Report Acquisition

### Story 3.1: Build Upright-Style Report Replica

**Priority:** P0  
**User story:** As a demo user, I need a safe simulated portal to demonstrate the report workflow without real credentials.  
**Feature details:**

- Build HTML UI with Reports section, Paid Orders option, date range fields, Generate button, report status, and Download button.
- Clearly label it as simulated.
- Use realistic labels from supplied materials.

**Acceptance criteria:**

- Page has real DOM controls, not just an image.
- Simulation label is visible.
- Date range changes output.
- No real Upright logo or credential implication is used unless permitted.

**Dependencies:** Story 1.1  
**Owner:** Acquisition owner  
**Reviewer:** Product lead

### Story 3.2: Implement Report Generation State

**Priority:** P0  
**User story:** As an operator, I need the simulated report to behave like a generated report, not a static file.  
**Feature details:**

- Pending state after Generate.
- Ready state when report is available.
- Empty/unavailable state for unsupported dates.
- Expired session or changed-label test mode.

**Acceptance criteria:**

- UI shows clear state transitions.
- Unsupported date fails visibly.
- Failure state does not download a misleading report.

**Dependencies:** Story 3.1  
**Owner:** Acquisition owner  
**Reviewer:** QA lead

### Story 3.3: Generate Downloadable Synthetic CSV From Replica

**Priority:** P0  
**User story:** As a system user, I need the simulated portal to produce a real downloadable file that feeds the pipeline.  
**Feature details:**

- Download CSV filtered by selected date range.
- Include source metadata and synthetic label.
- Preserve date coverage.

**Acceptance criteria:**

- Downloaded file imports through the same manual upload path.
- File has expected headers.
- File content matches selected dates.

**Dependencies:** Stories 2.2, 3.2  
**Owner:** Acquisition owner  
**Reviewer:** Data owner

### Story 3.4: Create Browser Replay Script

**Priority:** P0  
**User story:** As a judge, I want to see the repetitive report pull run automatically from a selected date.  
**Feature details:**

- Script opens replica, selects Paid Orders, enters date range, generates report, waits for ready state, downloads file.
- Parameterize start and end date.
- Validate file headers and date coverage after download.

**Acceptance criteria:**

- Reviewer can choose a supported date.
- Script downloads the expected CSV.
- Wrong page state causes visible failure.
- Timing is reported only as simulation timing.

**Dependencies:** Stories 3.1, 3.2, 3.3  
**Owner:** Acquisition owner  
**Reviewer:** QA lead

### Story 3.5: Connect Replay Output to Import Intake

**Priority:** P0  
**User story:** As a user, I need the acquired file to enter the same validation and metric pipeline as uploaded files.  
**Feature details:**

- Take downloaded CSV and submit to import flow.
- Preserve acquisition run ID.
- Show source path as simulated Upright acquisition.

**Acceptance criteria:**

- Replay file and manually uploaded file use the same parser.
- Re-running same date does not duplicate totals.
- Acquisition provenance appears in drilldown.

**Dependencies:** Story 3.4, Epic 4  
**Owner:** Integrator  
**Reviewer:** QA lead

### Story 3.6: Manual Upload Fallback

**Priority:** P0  
**User story:** As an operator, I need to upload a report manually when automation fails or is unavailable.  
**Feature details:**

- File picker for supported CSVs.
- Validation feedback.
- Retry without losing accepted prior data.

**Acceptance criteria:**

- Manual upload accepts synthetic P0 fixture.
- Bad file shows rejection reasons.
- Accepted file creates an import batch.

**Dependencies:** Story 2.1  
**Owner:** Integrator  
**Reviewer:** QA lead

## Epic 4: Import, Validation, and Provenance

### Story 4.1: Create Import Batch Model

**Priority:** P0  
**User story:** As a data reviewer, I need every imported file tracked as a batch.  
**Feature details:**

- Store source name, file name, synthetic flag, uploaded/acquired time, checksum, schema version, row counts, date coverage, status.

**Acceptance criteria:**

- Every import creates or references a batch.
- Batch metadata appears in API/UI.
- Batch status distinguishes accepted, partial, rejected, duplicate.

**Dependencies:** Story 2.1  
**Owner:** Backend/data owner  
**Reviewer:** QA lead

### Story 4.2: Validate Required Fields

**Priority:** P0  
**User story:** As a data owner, I need malformed rows rejected before metrics are calculated.  
**Feature details:**

- Validate required columns.
- Validate dates, numeric amounts, currency, platform, source row ID, synthetic flag.
- Validate date coverage where possible.

**Acceptance criteria:**

- Missing required columns reject the file or affected rows.
- Malformed rows have reason codes.
- Rejected rows never enter metric totals.

**Dependencies:** Story 4.1  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 4.3: Normalize Sale Rows

**Priority:** P0  
**User story:** As a metric developer, I need source-specific sale rows converted to a common schema.  
**Feature details:**

- Map source fields to common `SaleRow`.
- Preserve source file ID and source row ID.
- Normalize date/time, amounts, currency, platform, store, buyer ID, order ID.

**Acceptance criteria:**

- Upright synthetic fixture normalizes correctly.
- Unknown stores are retained in an unknown bucket.
- Missing buyer IDs are flagged.

**Dependencies:** Stories 4.1, 4.2  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 4.4: Duplicate File Detection

**Priority:** P0  
**User story:** As a finance reviewer, I need repeated imports to avoid double-counting.  
**Feature details:**

- Compute file checksum/fingerprint.
- Detect exact duplicate batch.
- Preserve run evidence without adding totals twice.

**Acceptance criteria:**

- Re-uploading same file leaves metrics unchanged.
- UI/API marks duplicate import.
- Duplicate event is visible in import history.

**Dependencies:** Story 4.1  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 4.5: Duplicate Row and Overlap Policy

**Priority:** P0  
**User story:** As a data owner, I need repeat rows handled consistently across overlapping files.  
**Feature details:**

- Define row key policy.
- Handle duplicate source rows within file.
- Handle overlapping date-range files.
- Avoid dropping legitimate corrected rows without a policy.

**Acceptance criteria:**

- Policy is documented.
- Tests cover same file, repeated row, and overlapping file.
- Displayed totals follow policy.

**Dependencies:** Stories 4.3, 4.4  
**Owner:** Data owner  
**Reviewer:** QA lead

### Story 4.6: Rejected Row Review

**Priority:** P0  
**User story:** As an operator, I need to see why rows were rejected so I can fix the source or escalate.  
**Feature details:**

- Show rejected row count.
- Show row number, field, value, reason.
- Allow export of rejected rows.

**Acceptance criteria:**

- Malformed fixture rows appear in rejection list.
- Rejection reasons are human-readable.
- Rejected rows link to import batch.

**Dependencies:** Story 4.2  
**Owner:** Backend/dashboard owner  
**Reviewer:** QA lead

### Story 4.7: Source Lineage API

**Priority:** P0  
**User story:** As a reviewer, I need to trace metric values back to source rows.  
**Feature details:**

- Endpoint or data function returns accepted rows contributing to a metric result.
- Include source file, row ID, source fields, normalized fields.

**Acceptance criteria:**

- Daily revenue metric can drill down to accepted rows.
- Drilldown excludes rejected rows.
- Unknown-store rows are visible.

**Dependencies:** Stories 4.3, 5.1  
**Owner:** Backend owner  
**Reviewer:** QA lead

## Epic 5: Deterministic Metrics

### Story 5.1: Daily Revenue Metric

**Priority:** P0  
**User story:** As a leader, I need daily revenue by platform and store so I can see e-commerce performance.  
**Feature details:**

- Sum accepted `sale_amount - refund_amount`.
- Exclude shipping and tax unless explicitly defined otherwise.
- Group by reporting day, platform, store, and currency.
- Use approved demo timezone.

**Acceptance criteria:**

- Revenue matches expected results ledger.
- Refund case is correct.
- Unknown-store revenue is retained.
- Metric definition appears in UI.

**Dependencies:** Epic 4, Story 2.6  
**Owner:** Metrics owner  
**Reviewer:** QA lead

### Story 5.2: Platform-Local Daily Customers

**Priority:** P1  
**User story:** As a leader, I need daily customer count by platform without fake cross-platform identity merging.  
**Feature details:**

- Count distinct buyer IDs within platform/day.
- Do not sum platform counts into a unique all-platform buyer number.
- Missing buyer IDs make affected metric unavailable or partial.

**Acceptance criteria:**

- Same buyer twice on one platform/day counts once.
- Same buyer ID on two platforms remains separate.
- Missing buyer fixture shows unavailable/partial state.

**Dependencies:** Epic 4, Story 2.6  
**Owner:** Metrics owner  
**Reviewer:** QA lead

### Story 5.3: Listings Per Store Per Day

**Priority:** P1  
**User story:** As an operations manager, I need listing throughput by store/day to understand production.  
**Feature details:**

- Count deduplicated new listing events.
- Group by listed day, platform, and originating store.
- Do not count identified/processed items as listings.

**Acceptance criteria:**

- Listing counts match expected ledger.
- Duplicate event test passes.
- Unknown-store listings remain visible.

**Dependencies:** Stories 2.4, 4.1  
**Owner:** Metrics owner  
**Reviewer:** QA lead

### Story 5.4: Unlisted Backlog Snapshot

**Priority:** P1  
**User story:** As an operations manager, I need backlog count at a point in time so I can see inventory waiting to be listed.  
**Feature details:**

- Count unique items in approved unlisted states at selected complete snapshot.
- Group by store/category where available.
- Label partial or missing snapshots.

**Acceptance criteria:**

- Backlog is not inferred from sales.
- Partial snapshot is not shown as complete.
- Counts match expected ledger.

**Dependencies:** Stories 2.5, 4.1  
**Owner:** Metrics owner  
**Reviewer:** QA lead

### Story 5.5: Metric Definition Registry

**Priority:** P0  
**User story:** As a user, I need to know exactly how each metric is calculated.  
**Feature details:**

- Store metric ID, name, formula, grain, exclusions, data sources, owner, version, approval state.
- Include demo warnings for unconfirmed definitions.

**Acceptance criteria:**

- Daily revenue definition is visible.
- Undefined metrics cannot appear as confirmed.
- UI references metric version.

**Dependencies:** Story 0.2  
**Owner:** Product/data owner  
**Reviewer:** QA lead

### Story 5.6: Revenue Reconciliation View

**Priority:** P0  
**User story:** As a finance reviewer, I need displayed revenue to reconcile exactly to source rows.  
**Feature details:**

- For selected date/platform/store, show metric total and contributing rows.
- Show accepted, rejected, unknown-store, and duplicate status.

**Acceptance criteria:**

- Source rows sum exactly to displayed total.
- Difference/discrepancy cannot be silently hidden.
- Reviewer can trace one demo number end to end.

**Dependencies:** Stories 5.1, 4.7  
**Owner:** Metrics/dashboard owner  
**Reviewer:** QA lead

### Story 5.7: Revenue Per Labor Hour Definition Gate

**Priority:** P2  
**User story:** As a product owner, I need labor-productivity metrics blocked until labor data and definitions are confirmed.  
**Feature details:**

- Document required inputs: labor hours, matching period, employee/store attribution, revenue scope.
- Provide placeholder unavailable state.

**Acceptance criteria:**

- No invented revenue-per-labor-hour metric appears as real.
- Roadmap explains data needed.

**Dependencies:** Partner labor data  
**Owner:** Product/data owner  
**Reviewer:** Finance reviewer

### Story 5.8: Sell-Through Definition Gate

**Priority:** P2  
**User story:** As a product owner, I need sell-through blocked until eligible cohort and relist logic are defined.  
**Feature details:**

- Define numerator, denominator, date window, relist handling, unsold handling, cross-platform treatment.
- Do not reuse store 50-55% target as e-commerce target.

**Acceptance criteria:**

- Dashboard does not show unsupported sell-through.
- Product roadmap lists required source fields.

**Dependencies:** Partner definition  
**Owner:** Product/data owner  
**Reviewer:** Finance/ops reviewer

### Story 5.9: Net Margin Definition Gate

**Priority:** P2  
**User story:** As a finance stakeholder, I need margin blocked until costs, fees, refunds, shipping, and labor allocations are confirmed.  
**Feature details:**

- Document required cost inputs.
- Mark gross/net margin as future state unless fields exist.

**Acceptance criteria:**

- No synthetic margin is presented as Goodwill margin.
- Margin roadmap separates demo assumptions from production requirements.

**Dependencies:** Finance definitions and data  
**Owner:** Finance/data owner  
**Reviewer:** Accounting reviewer

## Epic 6: Dashboard and User Experience

### Story 6.1: Build Common Dashboard Shell

**Priority:** P0  
**User story:** As a user, I need one clear interface to review imported e-commerce report data.  
**Feature details:**

- Header with synthetic/simulated banner.
- Navigation for import status, daily revenue, source drilldown, and settings/definitions.
- Common date/platform/store filters.

**Acceptance criteria:**

- App opens reliably.
- Synthetic status is visible.
- Filters are stable and reusable.

**Dependencies:** Story 0.1  
**Owner:** Dashboard owner  
**Reviewer:** UX reviewer

### Story 6.2: Import Status Page

**Priority:** P0  
**User story:** As an operator, I need to see whether reports were imported successfully.  
**Feature details:**

- List import batches.
- Show source, time, status, accepted rows, rejected rows, duplicate status, date coverage.
- Link to rejected rows and source rows.

**Acceptance criteria:**

- Successful, duplicate, partial, and failed imports display differently.
- User can find latest imported date.
- Rejected rows are accessible.

**Dependencies:** Epic 4  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

### Story 6.3: Daily Revenue View

**Priority:** P0  
**User story:** As a leader, I need daily revenue displayed with filters and traceability.  
**Feature details:**

- Revenue card.
- Platform/store breakdown.
- Date selector.
- Metric definition panel.
- Drilldown link.

**Acceptance criteria:**

- Values match API/expected ledger.
- Unknown store bucket appears.
- Definition and synthetic label are visible.

**Dependencies:** Story 5.1  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

### Story 6.4: Source Drilldown Table

**Priority:** P0  
**User story:** As a reviewer, I need to inspect the rows behind a metric.  
**Feature details:**

- Show source file, row ID, order ID, date, platform, store, buyer ID, sale amount, refund amount, normalized net amount.
- Include rejected row tab if relevant.

**Acceptance criteria:**

- Drilldown rows sum to selected metric.
- Source batch links work.
- Table handles unknown/missing values clearly.

**Dependencies:** Story 4.7  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

### Story 6.5: Customer Count View

**Priority:** P1  
**User story:** As a leader, I need customer counts by platform/day with limitations visible.  
**Feature details:**

- Separate platform cards.
- Missing buyer ID warning.
- Definition panel.

**Acceptance criteria:**

- Platform-local counts are not merged.
- Missing data shows partial/unavailable state.
- Values match expected ledger.

**Dependencies:** Story 5.2  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

### Story 6.6: Listings View

**Priority:** P1  
**User story:** As an operations manager, I need listing throughput by store/day.  
**Feature details:**

- Listing count chart/table.
- Store and platform filters.
- Definition panel.

**Acceptance criteria:**

- Counts match metric API.
- Duplicate events do not inflate count.
- Unknown store visible.

**Dependencies:** Story 5.3  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

### Story 6.7: Backlog Snapshot View

**Priority:** P1  
**User story:** As an operations manager, I need a snapshot selector for unlisted inventory backlog.  
**Feature details:**

- Snapshot timestamp selector.
- Backlog count by store/category.
- Completeness indicator.

**Acceptance criteria:**

- Complete and partial snapshots are labeled.
- Backlog count matches expected ledger.
- Definition says point-in-time snapshot.

**Dependencies:** Story 5.4  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

### Story 6.8: Familiar Excel-Style Summary Export

**Priority:** P1  
**User story:** As a Goodwill staff member, I need an export that fits the existing spreadsheet workflow.  
**Feature details:**

- Export CSV with daily revenue and customer count by platform.
- Include filters, metric version, synthetic flag, and source batch IDs.

**Acceptance criteria:**

- Export values match dashboard.
- Export does not include unsupported metrics.
- File is clearly labeled synthetic/demo when applicable.

**Dependencies:** Stories 5.1, 5.2  
**Owner:** Dashboard/data owner  
**Reviewer:** Product lead

### Story 6.9: Empty, Error, and Partial Data States

**Priority:** P0  
**User story:** As a user, I need the app to be honest when data is missing or incomplete.  
**Feature details:**

- Empty state for no imports.
- Error state for failed import.
- Partial state for missing source or incomplete fields.
- Duplicate state for repeated import.

**Acceptance criteria:**

- Missing data is never shown as zero without label.
- User sees next action.
- QA tests all states.

**Dependencies:** Epic 4  
**Owner:** Dashboard owner  
**Reviewer:** QA lead

## Epic 7: AI and Agent-Native Interaction

### Story 7.1: AI Usage Policy for Prototype

**Priority:** P0  
**User story:** As a team, we need to state where AI is and is not used.  
**Feature details:**

- AI may help build code and generate synthetic data.
- AI must not calculate financial metrics.
- Any chat feature must be read-only and evidence-backed.
- Production AI requires Goodwill approval, likely Copilot-aligned.

**Acceptance criteria:**

- Policy appears in disclosure/pitch materials.
- App does not imply unapproved production AI.
- Team can answer security questions.

**Dependencies:** Story 0.3  
**Owner:** Product lead  
**Reviewer:** Security-minded teammate

### Story 7.2: Grounded Metric Question Prototype

**Priority:** P2  
**User story:** As a leader, I want to ask a natural-language question about the displayed metric and get an evidence-backed answer.  
**Feature details:**

- Support one fixed question type, such as "Why is revenue different from yesterday?"
- Retrieve deterministic metric results.
- Include filters, source status, and definition in answer.
- Do not infer causality beyond records.

**Acceptance criteria:**

- Answer cites computed facts and source rows.
- Missing data triggers an unavailable response.
- Arithmetic matches metric API.

**Dependencies:** Stories 5.1, 6.3, 6.4  
**Owner:** AI/dashboard owner  
**Reviewer:** QA lead

### Story 7.3: Assistant Guardrails

**Priority:** P2  
**User story:** As an IT/security reviewer, I need the assistant constrained to safe read-only operations.  
**Feature details:**

- No write actions.
- No Business Central posting.
- No external sending.
- No credential access.
- Respect user permissions.
- Treat source text as data, not instructions.

**Acceptance criteria:**

- Prompt-injection test does not override behavior.
- Assistant refuses unsupported metrics.
- Assistant never invents missing data.

**Dependencies:** Story 7.2  
**Owner:** AI owner  
**Reviewer:** Security reviewer

## Epic 8: Business Central and Month-End Roadmap

### Story 8.1: Business Central Mapping Inventory

**Priority:** P2  
**User story:** As a finance stakeholder, I need source-to-BC mapping inventoried before any automated export.  
**Feature details:**

- Identify accounts, dimensions, departments, vendors/customers, journal lines, invoice fields.
- Mark all mappings unvalidated until finance confirms.

**Acceptance criteria:**

- No production mapping is claimed.
- Required finance review points are listed.

**Dependencies:** Finance samples  
**Owner:** Finance/data owner  
**Reviewer:** Accounting reviewer

### Story 8.2: Allocation Workbook Parity Plan

**Priority:** P2  
**User story:** As accounting, I need new logic compared against the existing workbook before trust is granted.  
**Feature details:**

- Inventory workbook formulas.
- Build expected output comparison.
- Define tolerance and sign-off process.

**Acceptance criteria:**

- Plan explains source -> workbook-equivalent -> BC output reconciliation.
- No cutover without workbook parity.

**Dependencies:** Real workbook access  
**Owner:** Finance/data owner  
**Reviewer:** Accounting reviewer

### Story 8.3: Unvalidated BC Export Preview

**Priority:** P2  
**User story:** As a judge, I may need to see the future accounting direction without implying live posting.  
**Feature details:**

- Generate a sample CSV preview labeled unvalidated/proposal only.
- Include synthetic source references.
- No upload/post button.

**Acceptance criteria:**

- Preview cannot be mistaken for production-ready posting.
- Values trace to synthetic batches.
- Pitch explains finance validation gate.

**Dependencies:** Story 8.1  
**Owner:** Finance/data owner  
**Reviewer:** Product lead

## Epic 9: Security, Privacy, and Authorization

### Story 9.1: Credential Handling Policy

**Priority:** P0  
**User story:** As a security reviewer, I need assurance that no credentials are stored in the repo or demo artifacts.  
**Feature details:**

- No real Goodwill credentials.
- No session cookies.
- No screenshots showing sensitive tokens.
- Environment variables or secrets only if needed for app infra.

**Acceptance criteria:**

- Repo scan finds no credentials.
- Demo uses only synthetic data.
- README/pitch states no sponsor credentials used.

**Dependencies:** None  
**Owner:** Integrator  
**Reviewer:** QA/security reviewer

### Story 9.2: Authorized Retrieval Gate

**Priority:** P1  
**User story:** As Goodwill IT, I need any live retrieval method approved before use.  
**Feature details:**

- Document provider terms check.
- Document Goodwill approval requirement.
- Add production gate before real portal automation.

**Acceptance criteria:**

- Live automation is blocked in roadmap until approval.
- Browser replica cannot be confused with authorization.

**Dependencies:** Goodwill IT/provider review  
**Owner:** Product lead  
**Reviewer:** Security reviewer

### Story 9.3: Sensitive Data Minimization

**Priority:** P1  
**User story:** As an IT reviewer, I need the system to collect only fields needed for reporting.  
**Feature details:**

- Classify fields as required, optional, or avoid.
- Avoid customer PII in demo and prototype.
- Mask or omit buyer names/emails.

**Acceptance criteria:**

- Synthetic fixture contains no real PII.
- UI does not expose unnecessary customer details.
- Data dictionary documents field purpose.

**Dependencies:** Story 2.1  
**Owner:** Data owner  
**Reviewer:** Security reviewer

## Epic 10: Testing and Quality Assurance

### Story 10.1: Unit Tests for Parsers

**Priority:** P0  
**User story:** As QA, I need parser tests so bad source files cannot silently corrupt metrics.  
**Feature details:**

- Test valid file.
- Test missing columns.
- Test malformed amounts.
- Test missing store.
- Test missing buyer.

**Acceptance criteria:**

- Tests pass for P0 fixture.
- Tests verify rejected row reasons.
- Parser cannot accept unsupported schema silently.

**Dependencies:** Epic 4  
**Owner:** QA/data owner  
**Reviewer:** Integrator

### Story 10.2: Unit Tests for Metrics

**Priority:** P0  
**User story:** As QA, I need metric tests so displayed financial numbers are deterministic.  
**Feature details:**

- Revenue totals.
- Refund handling.
- Date boundary.
- Store/platform grouping.
- Unknown-store retention.

**Acceptance criteria:**

- Tests compare against independent expected ledger.
- No LLM-generated expected values.

**Dependencies:** Story 5.1, Story 2.6  
**Owner:** QA lead  
**Reviewer:** Metrics owner

### Story 10.3: Import Idempotency Test

**Priority:** P0  
**User story:** As finance, I need repeated imports to leave totals unchanged.  
**Feature details:**

- Import same file twice.
- Import same replay date twice.
- Import overlapping file if available.

**Acceptance criteria:**

- Totals remain correct.
- Duplicate batch appears in history.
- Test evidence is saved.

**Dependencies:** Story 4.4  
**Owner:** QA lead  
**Reviewer:** Data owner

### Story 10.4: End-to-End Demo Regression

**Priority:** P0  
**User story:** As the presenter, I need one command/checklist that proves the whole demo works.  
**Feature details:**

- Start app.
- Run simulated acquisition.
- Import file.
- Show revenue view.
- Drill down to source rows.
- Reimport duplicate.
- Show failure path.

**Acceptance criteria:**

- Clean-start demo passes.
- Evidence captured with screenshots or logs.
- Independent teammate can run it.

**Dependencies:** Epics 3, 4, 5, 6  
**Owner:** QA lead  
**Reviewer:** Team lead

### Story 10.5: Second-Laptop Deployment Check

**Priority:** P0  
**User story:** As the team, we need confidence the demo works outside one developer's machine.  
**Feature details:**

- Open deployed/local preview from another laptop/browser.
- Run supported demo path.
- Verify no local-only files are required unless documented.

**Acceptance criteria:**

- Reviewer runs demo without developer intervention.
- URL/command is recorded.
- Data reset instructions exist.

**Dependencies:** Story 10.4  
**Owner:** Integrator  
**Reviewer:** Independent teammate

## Epic 11: Deployment and Operations

### Story 11.1: Reproducible Local Run Command

**Priority:** P0  
**User story:** As a teammate, I need a simple command to run the app.  
**Feature details:**

- Document install/run/test commands.
- Include seed/reset command if needed.

**Acceptance criteria:**

- Fresh teammate can run app.
- Commands are in README or demo doc.

**Dependencies:** App scaffold  
**Owner:** Integrator  
**Reviewer:** QA lead

### Story 11.2: Demo Deployment

**Priority:** P0  
**User story:** As a presenter, I need a stable demo URL or local fallback.  
**Feature details:**

- Deploy to approved hackathon environment or document local run.
- Seed synthetic data or allow upload.
- Avoid bundling secrets.

**Acceptance criteria:**

- Demo is accessible at presentation time.
- Backup path exists.
- Version is frozen before submission.

**Dependencies:** Story 10.4  
**Owner:** Integrator  
**Reviewer:** Team lead

### Story 11.3: Run History and Observability

**Priority:** P1  
**User story:** As an operator, I need to know what happened in each acquisition/import run.  
**Feature details:**

- Show run ID, source, start/end time, status, downloaded file, checksum, row counts, errors.

**Acceptance criteria:**

- User can distinguish latest good run from failed run.
- Error message has next action.

**Dependencies:** Epics 3 and 4  
**Owner:** Backend/dashboard owner  
**Reviewer:** QA lead

### Story 11.4: Production Runbook

**Priority:** P2  
**User story:** As Goodwill staff, I need support instructions for failures and future changes.  
**Feature details:**

- Who owns failed report.
- How to rerun.
- How to upload manually.
- How to update changed source mapping.
- Who approves metric changes.

**Acceptance criteria:**

- Runbook names roles even if names are TBD.
- Failure paths have manual fallback.

**Dependencies:** Production owner identification  
**Owner:** Product lead  
**Reviewer:** Goodwill stakeholder

## Epic 12: Pitch, Submission, and Handoff

### Story 12.1: Build Pitch Narrative

**Priority:** P0  
**User story:** As a presenter, I need a clear story that judges can repeat.  
**Feature details:**

- Problem: executive visibility blocked by manual report retrieval.
- Demo: controlled acquisition -> validation -> metrics -> dashboard.
- Constraints: synthetic, simulated, authorized future path.
- Roadmap: real source pilot, Microsoft alignment, accounting controls.

**Acceptance criteria:**

- First 30 seconds are clear.
- No unsupported technical jargon leads.
- Story matches built product.

**Dependencies:** Story 0.5  
**Owner:** Pitch lead  
**Reviewer:** Full team

### Story 12.2: Create Demo Recording

**Priority:** P0  
**User story:** As the team, we need a backup recording for submission and demo failure.  
**Feature details:**

- Record exact working workflow.
- Include disclosure.
- Keep within event time constraints.

**Acceptance criteria:**

- Recording link/file is accessible.
- Recording shows actual app workflow, not just slides.
- Recording is submitted before deadline if required.

**Dependencies:** Story 10.4  
**Owner:** Pitch/integrator  
**Reviewer:** Team lead

### Story 12.3: Submission Checklist

**Priority:** P0  
**User story:** As the team lead, I need all required artifacts submitted before code freeze.  
**Feature details:**

- GitHub/repo link.
- Demo video/slides link.
- App URL if available.
- Disclosure list.
- Team names.

**Acceptance criteria:**

- Checklist matches latest facilitator instructions.
- Submission receipt is saved.
- No post-freeze feature changes.

**Dependencies:** Event confirmation  
**Owner:** Team lead  
**Reviewer:** Independent teammate

### Story 12.4: Handoff Summary

**Priority:** P1  
**User story:** As a Sprint Lab continuation team, I need to know what was built and what remains.  
**Feature details:**

- Built features.
- Test status.
- Known gaps.
- Production gates.
- Open partner questions.
- Recommended next sprint.

**Acceptance criteria:**

- Handoff distinguishes prototype from production.
- Real-data next steps are clear.

**Dependencies:** Demo completion  
**Owner:** Product lead  
**Reviewer:** Full team

## Suggested Epic Order

1. Epic 0: Scope, Governance, and Delivery Control.
2. Epic 1: Current-State Workflow and Source Mapping.
3. Epic 2: Synthetic Data and Demo Fixtures.
4. Epic 4: Import, Validation, and Provenance.
5. Epic 5: Deterministic Metrics.
6. Epic 3: Simulated Report Acquisition.
7. Epic 6: Dashboard and User Experience.
8. Epic 10: Testing and Quality Assurance.
9. Epic 11: Deployment and Operations.
10. Epic 12: Pitch, Submission, and Handoff.
11. Epic 7: AI and Agent-Native Interaction.
12. Epic 8: Business Central and Month-End Roadmap.
13. Epic 9: Security, Privacy, and Authorization, running throughout.

## Hackathon P0 Minimum Ticket Set

If time is tight, complete these before anything else:

- Story 0.1: Freeze Weekend Scope.
- Story 0.3: Create Disclosure Register.
- Story 1.1: Map Upright Daily Report Workflow.
- Story 2.1: Define Common Data Contracts.
- Story 2.2: Generate Synthetic Upright Paid Orders CSV.
- Story 2.6: Create Independent Expected Results Ledger.
- Story 3.1: Build Upright-Style Report Replica.
- Story 3.2: Implement Report Generation State.
- Story 3.3: Generate Downloadable Synthetic CSV From Replica.
- Story 3.4: Create Browser Replay Script.
- Story 3.6: Manual Upload Fallback.
- Story 4.1: Create Import Batch Model.
- Story 4.2: Validate Required Fields.
- Story 4.3: Normalize Sale Rows.
- Story 4.4: Duplicate File Detection.
- Story 4.6: Rejected Row Review.
- Story 4.7: Source Lineage API.
- Story 5.1: Daily Revenue Metric.
- Story 5.5: Metric Definition Registry.
- Story 5.6: Revenue Reconciliation View.
- Story 6.1: Build Common Dashboard Shell.
- Story 6.2: Import Status Page.
- Story 6.3: Daily Revenue View.
- Story 6.4: Source Drilldown Table.
- Story 6.9: Empty, Error, and Partial Data States.
- Story 7.1: AI Usage Policy for Prototype.
- Story 9.1: Credential Handling Policy.
- Story 10.1: Unit Tests for Parsers.
- Story 10.2: Unit Tests for Metrics.
- Story 10.3: Import Idempotency Test.
- Story 10.4: End-to-End Demo Regression.
- Story 10.5: Second-Laptop Deployment Check.
- Story 11.1: Reproducible Local Run Command.
- Story 11.2: Demo Deployment.
- Story 12.1: Build Pitch Narrative.
- Story 12.2: Create Demo Recording.
- Story 12.3: Submission Checklist.

## Feature Completion Definition

A feature is done only when:

- It is implemented or documented in the repo.
- It has acceptance evidence.
- Synthetic/simulated status is labeled where applicable.
- A separate reviewer has checked it.
- It does not contradict partner constraints.
- It does not invent unconfirmed metrics, accounting mappings, or production access.
- It can be explained in the pitch without overclaiming.

