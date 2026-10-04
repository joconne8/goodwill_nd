"""Generate a story-level register from the unchanged authoritative backlog."""
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "docs/goodwill/evidence/target/PROJECT_MANAGEMENT_EPICS_AND_STORIES.md"
owners = {
    0: "Lead", 1: "Acquisition", 2: "Data", 3: "Acquisition", 4: "Data",
    5: "Data", 6: "Application", 7: "Lead", 8: "Lead/finance",
    9: "Lead", 10: "Independent QA", 11: "Lead", 12: "Lead/human presenter",
}
gates = {
    "5.7": "Implement definition gate; approved labor-hour input absent",
    "5.8": "Implement definition gate; approved cohort and sell-through definition absent",
    "5.9": "Implement definition gate; approved item cost/allocation inputs absent",
    "7.2": "Deferred: Goodwill-approved AI policy/model/data path required",
    "7.3": "Deferred with 7.2; approved assistant design and injection test plan required",
    "8.1": "Implement roadmap inventory; verified mapping blocked by approved BC samples/finance review",
    "8.2": "Implement parity plan; cutover blocked by real workbook and finance sign-off",
    "8.3": "Deferred: approved sample/schema and finance review required; no posting",
    "10.5": "Prepare reproducible setup now; independent second-human/device run is an external gate",
    "11.2": "Prepare demo/backup; publishing and final freeze require human approval",
    "12.2": "Prepare recording script; actual recording and release need human presenter approval",
    "12.3": "Prepare checklist; current facilitator instructions/submission/receipt are human gates",
}
out = [
    "# Story coverage and requirements register", "",
    "Generated from the current target backlog; this is an implementation allocation,",
    "not a claim that planned stories are already complete. Re-run with",
    "`python scripts/goodwill-story-coverage.py` after an approved backlog change.", "",
    "Evidence codes: B = target backlog (specific story below); M = directly reviewed",
    "master problem synthesis; P = directly reviewed corrected partner brief; F =",
    "unchanged synthetic fixture pack/manifest; V = previously reviewed process deck.",
    "Links and review limits are in SCOPE.md. Requirement IDs are stable story IDs.", "",
    "Partner need is confirmed at the problem level; technical formulas and synthetic",
    "interfaces are demo conventions, not finance/security approvals. Separate reviewers",
    "are roles until the proposed human allocations in PARALLEL_BUILD.md are confirmed.", "",
    "| Story / requirement | Driver / separate reviewer | Evidence / stakeholder | Disposition | Acceptance evidence required |",
    "|---|---|---|---|---|",
]
count = 0
for part in re.split(r"(?=### Story )", source.read_text())[1:]:
    match = re.match(r"### Story (\d+\.\d+): ([^\n]+)", part)
    if not match:
        continue
    sid, title = match.groups()
    epic = int(sid.split(".")[0])
    owner = owners[epic]
    reviewer = "Lead" if owner not in ("Lead", "Lead/human presenter", "Lead/finance") else "Human PR reviewer"
    evidence = "B+M+P / operator and leadership"
    if epic in (2, 4, 5, 10):
        evidence = "B+M+F / reporting and finance"
    if epic in (1, 3):
        evidence = "B+M+V / operator"
    tests = part.split("**Acceptance criteria:**", 1)[1].split("**Dependencies:**", 1)[0]
    tests = "; ".join(line.strip()[2:] for line in tests.splitlines() if line.strip().startswith("- "))
    disposition = gates.get(sid, "Implement now; acceptance evidence pending")
    row = [f"{sid} {title} / REQ-{sid}", f"{owner} / {reviewer}", evidence, disposition, tests]
    out.append("| " + " | ".join(s.replace("|", "\\|") for s in row) + " |")
    count += 1
assert count >= 65, f"Backlog unexpectedly incomplete: {count} stories"
(root / "docs/goodwill/STORY_COVERAGE.md").write_text("\n".join(out) + "\n")
print(f"Mapped {count} stories with evidence, driver, reviewer, acceptance and disposition")