# B-Atlas v6.81.0 — Identity & Canonical Storage Consolidation

Date: 2026-09-12

## Model identity
- Reviewed all 16 overlapping manufacturer/model designation families identified by the data-health audit.
- No destructive model merge was performed where layout, generation, propulsion, or historical naming could materially mislead a buyer.
- Added `data/model-families.json` with explicit family membership and identity disposition for all 16 groups.
- Added `ModelIdentityFamilyID` to affected canonical model and registry records.
- Removed or moved 37 ambiguous/cross-identity aliases from individual model records to family-level shared aliases.
- CHB 34 and Marine Trader 38 remain explicitly flagged for historical/phase-level identity research rather than being guessed or merged.

## Canonical storage
- Retired parallel legacy measurement/year fields from `boatmodels.json`: `LOA_ft`, `LengthFt`, `LWL_ft`, `Beam_ft`, `BeamFt`, `Draft_ft`, `DraftFt`, `AirDraft_ft`, `Headroom_ft`, `Displacement_lb`, `YearStart`, `YearEnd`.
- Archived all retired values in `developer/archive/legacy-parallel-fields-v6.80.json` for traceability.
- Runtime compatibility continues to synthesize imperial mirrors from canonical SI measurements.
- Updated model completeness auditing to score canonical measurement fields directly.
- Updated community new-model publishing to store canonical metres/kilograms rather than legacy imperial duplicates.

## Reconciliation completed in this pass
- CHB 34 Sedan and CHB 34 Tri-Cabin canonical dimensions standardized to the published 33 ft 6 in × 11 ft 9 in × 3 ft 6 in hull specification set.
- Cutwater C-30 S canonical LOA standardized to the factory rigged overall length of 35 ft 8 in; the factory 30 ft molded hull length is not used as the overall-envelope filter dimension.
- Remaining unresolved measurement issues reduced to 3: Marine Trader 38 Sundeck beam/draft and Rosborough RF-246 Legacy Sedan Cruiser Diesel draft.

## Repository hygiene
- Superseded identity/measurement reconciliation reports and the v6.80 version-lock test moved to `developer/archive/v6.80/`.
- Data manifest updated to v6.81.0 and now identifies the model-family dataset as authoritative identity metadata.
