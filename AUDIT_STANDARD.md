# SwapPulse Audit Standard

All SwapPulse security, privacy, Web3, AI/agent, infrastructure and feature audits must use the same findings format.

## Required findings table

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Example critical area | Describe the concrete vulnerability, broken trust boundary, data-loss risk or production-blocking failure. | State the exact remediation required. |
| 🟠 P1 | Example high-priority area | Describe an important security, privacy, reliability or major functional problem. | State the exact remediation required. |
| 🟡 P2 | Example medium-priority area | Describe a lower-impact bug, hardening gap, usability problem or technical debt item. | State the exact remediation required. |
| 🟢 P3 | Example low-priority area | Describe a minor polish, documentation or maintenance issue. | State the exact remediation required. |

## Priority definitions

- **🔴 P0 — Critical / release blocking:** exploitable trust-boundary failure, asset-loss risk, privilege escalation, severe privacy exposure, irreversible chain risk, broken production dependency, or another issue that should block release/use of the affected feature.
- **🟠 P1 — High:** significant security, privacy, integrity, reliability or user-impact problem that needs prompt remediation but is not immediately catastrophic.
- **🟡 P2 — Medium:** defence-in-depth, resilience, usability, observability, maintainability or correctness issue with limited immediate impact.
- **🟢 P3 — Low:** polish, documentation, consistency or low-risk maintenance work.

## Audit-writing rules

1. Lead with the findings table. Do not bury findings inside long narrative sections.
2. Use exactly these four columns: **Priority**, **Area**, **Finding**, **Required action**.
3. Put the highest-priority findings first: P0, then P1, P2 and P3.
4. Keep one problem per row. Split unrelated issues even if they affect the same feature.
5. Findings must describe what is actually wrong, not vague concerns.
6. Required actions must be specific enough to implement or test.
7. If an item has already been fixed, keep the row and begin the action with **Completed:** followed by what changed.
8. Do not silently downgrade a finding after remediation. Preserve its original priority for audit history.
9. Record exact dates, versions, endpoints, function/entity names and test evidence when they materially identify the issue.
10. Do not claim an audit is complete if required build, security, chain or deployment verification could not be run.

## Feature audit template

Use this for every new feature or substantial feature change:

```markdown
# <Feature name> Audit

**Audit date:** YYYY-MM-DD  
**Scope:** <short scope>  
**Status:** In progress / Complete with residual actions / Complete

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | ... | ... | ... |
| 🟠 P1 | ... | ... | ... |
| 🟡 P2 | ... | ... | ... |
| 🟢 P3 | ... | ... | ... |
```

If no findings exist at a priority, omit rows for that priority. Never add empty placeholder findings to a completed audit.
