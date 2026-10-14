# Defect ledger

This ledger records reproduced product defects. Harness mistakes and unavailable environments are not counted as product defects. Status requires verification of the original reproduction and related behavior; a fix alone does not establish PASS.

No product defect has yet been reproduced by production browser execution. QA is awaiting the first build. Runtime-message validation review notes were sent to the web implementer before execution (detail cells and finite elapsed time); these are review findings, not a claimed exploit.

| ID | Priority | Environment / source | Reproduction | Expected / actual | Cause / fix | Regression evidence | Status |
|---|---|---|---|---|---|---|---|
| ENV-01 | Environment | Windows CUA startup | Initialize browser-control session | Expected browser control; launcher fails before opening browser with HRESULT 0x80070003 | Missing required Windows platform directory in tool launcher; app not implicated | Parent may retry after tool availability changes | BLOCKED |
