# B-Atlas v6.82.0 — Single-Source Model Data Consolidation

## Purpose
Make `boatmodels.json` the sole active JSON source for current model-wide specifications and remove remaining secondary specification mirrors.

## Changes
- Retired `knowledge/data/facts.json` from runtime. Its 8,671 model-value records are preserved only in `developer/archive/data-consolidation-v6.82/` for historical traceability.
- Regenerated `knowledge/data/knowledgecards.json` without embedded specification values. The Knowledge Card UI now derives displayed specifications directly from the current canonical boat record.
- Simplified the runtime knowledge repository so it loads evidence, contradictions, relationships and coverage metadata, not a second structured-facts database.
- Reworked the Evidence view to show canonical-data provenance statements from the model record rather than copied fact values.
- Renamed legacy `FactCount` coverage metadata to `ScoredFieldCount`.
- Archived 13 historical validation batches, the v6.61 headroom completion pass, the v6.45 specification-promotion file, the v6.81 plan-critical exception file, and superseded reconciliation/identity reports that contained historical model values.
- Added `developer/reports/plan-critical-unknowns-v6.82.json`, which records only which canonical fields remain unknown and does not carry alternate values.
- Added `developer/test-single-source-model-data-v682.js`. The build guard fails if an active secondary JSON file begins storing current model-wide specification fields or if a fact-style `AttributeID`/`Value` mirror is reintroduced.
- Updated the data manifest and release metadata to v6.82.0.

## Architectural rule
`boatmodels.json` is the one active source of truth for current model-wide values. Secondary data may contain evidence/provenance metadata, relationships, resources, derived counts, production-phase-specific overrides, or proposed community corrections. Historical alternate values remain developer archives only and are not loaded at runtime.

## Validation
- 259 canonical models.
- 259 generated Knowledge Cards; 0 contain a `specifications` block.
- Active `knowledge/data/facts.json`: absent.
- Single-source model-data guard: passed.
- Cross-database QC: passed.
- Measurement normalization: passed.
- Plan-critical closeout: passed.
- Model Knowledge Score: passed.
- Permanent URL generation: passed for all 259 models.
- Resource coverage/review tests: passed.
- Marketplace and broker adapter tests: passed.
- All JSON files parse successfully.
