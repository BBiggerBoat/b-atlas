# B-Atlas v6.85.0 — Canonical Normalization Pass

## Scope
Normalize existing descriptive data already present in `boatmodels.json` into registered canonical code fields. No external research was introduced in this pass.

## Results
- 883 canonical fields normalized from existing record data.
- `StyleCode`: 0 → 259 populated (complete).
- `FlybridgeCode`: 100 → 259 populated (complete).
- `CoolingCode`: 0 → 258 populated; Willard 40 remains unknown because no cooling source value exists.
- `SideDecksCode`: 50 → 257 populated; Nimble Nomad (`Limited`) and Nord Star 31+ (`Full`) remain normalization-review items rather than forced mappings.
- `ShowerTypeCode` was not bulk-normalized because the legacy `Shower` field is internally inconsistent with already-researched shower-type records.
- `KeelConfigurationCode` was not bulk-normalized beyond unanimous internal precedent; no additional safe promotions resulted.
- Completeness audit rerun and refined so shower/keel legacy text is treated as research evidence requiring reconciliation, not automatic normalization.

## Data integrity
- Canonical current model values remain solely in `boatmodels.json`.
- v6.84 audit outputs moved to developer archive; v6.85 audit outputs are the active status reports.
- Unknown data remains eligible and is not converted into an exclusion.
