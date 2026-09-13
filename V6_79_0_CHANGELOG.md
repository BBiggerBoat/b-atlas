# B-Atlas v6.79.0 — Canonical Data Health Consolidation

## Purpose
Consolidate active JSON data ownership, repair safe canonical measurement omissions, and expose ambiguous duplicate/conflicting records for controlled review without inventing facts or merging legitimate variants.

## Changes
- Promoted 21 evidence-supported legacy measurements into canonical SI fields used by filtering.
- Preserved canonical `null` for phase-specific, conflicting, configuration-specific, or weakly supported measurements.
- Added `data/plan-critical-exceptions-v6.79.json`, rebuilt from current canonical state.
- Added data-health reports for identity overlaps, measurement conflicts, and production-year conflicts.
- Archived 41 historical specification workflow snapshots and retired duplicate JSON files under `developer/archive/data-health-v6.79/`.
- Retired the separate runtime `knowledge/data/boatintelligence.json`; Knowledge UI now reads `SupplementalIntelligence` directly from authoritative `boatmodels.json`.
- Refreshed `data/data-manifest.json` to v6.79.0 and corrected the model count to 259.
- Updated community moderation publication so corrections to imperial measurement compatibility fields also update canonical metric fields.
- Updated new-model publication so entered length/beam/draft values populate both compatibility and canonical fields.
- Added `developer/test-data-health-v679.js` regression coverage.

## Intentionally Not Auto-Merged
Potentially overlapping identities remain separate pending manual evidence review. This includes CHB 34 family records and other same-name generation/layout groups. The review queue is `developer/reports/data-health-identity-review-v6.79.json`.

## Important unresolved examples
- CHB 34 Sedan / Tri-Cabin: legacy dimensions conflict and evidence is currently low; dimensions remain canonical unknown pending lineage/specification reconciliation.
- Grand Banks 36 Classic / 42 Classic: model-wide LOA/beam remain null because dimensions change by production phase; phase-specific values remain authoritative.
- Marine Trader 38 Sundeck: conflicting generation/dimension evidence remains unresolved.
- Jeanneau Merry Fisher 795: LOA/draft vary by Series 1 vs Series 2; model-wide values remain null.

## Validation
- All JSON files parse successfully.
- New v6.79.0 data-health test passes.
- Measurement normalization, plan-critical closeout, cross-database QC, permalink, resource coverage/review, broker adapter, marketplace signal, and model-knowledge tests pass.
- `developer/test-share-buy-v669.js` still reports its pre-existing strict `<base href=\"/\">` string expectation because the site uses the equivalent self-closing `<base href=\"/\"/>`; this was already present in v6.78.0 and was not changed by this release.
