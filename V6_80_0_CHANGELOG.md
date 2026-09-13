# B-Atlas v6.80.0 — Measurement & Production-Year Reconciliation

Date: 2026-09-12

## Data reconciliation
- Resolved 61 of 71 legacy/canonical measurement conflicts by synchronizing obsolete imperial compatibility mirrors to the researched canonical measurement.
- Preserved canonical-null behavior: no generic fallback was restored.
- 10 measurement conflicts remain intentionally unresolved because the underlying model identity, generation, configuration, or evidence remains ambiguous.
- Resolved 18 of 19 production-year conflicts by synchronizing `YearStart` / `YearEnd` compatibility fields to the active `FirstYear` / `LastYear` runtime identity fields.
- Preserved one Marine Trader 40 Double Cabin year conflict because existing evidence explicitly contradicts itself on the final production year.

## Remaining measurement review
The unresolved queue is limited to:
- CHB 34 Sedan — LOA, beam, draft
- CHB 34 Tri-Cabin — LOA, beam, draft
- Cutwater C-30 S — LOA
- Marine Trader 38 Sundeck — beam, draft
- Rosborough 246 Legacy Sedan — draft

These values remain unknown to the exclusion engine rather than being guessed.

## Data governance
- Superseded v6.79 conflict reports and plan-critical exception file were moved to `developer/archive/data-health-v6.80/`.
- Added `developer/reports/RECONCILIATION_V6_80.json` documenting every reconciliation action and policy.
- Added current v6.80 measurement/year conflict reports and plan-critical exception file.
