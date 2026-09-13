# B-Atlas v6.86.0 — High-Impact Missing-Data Research Wave 1

## Scope
First evidence-based research wave following the v6.85 canonical normalization pass. Work focused on high-priority model records where missing facts materially affect Find Your Boat confidence, handling/fit assessment, or model knowledge.

## Changes
- Applied 36 supported canonical values or explicit configuration/production-variation classifications across 7 priority models.
- Sea Sport 27: added single-engine configuration, deck-plan configuration, external-drive rudder classification and exposed running-gear classification; variable power/shower fields are explicitly marked configuration-dependent.
- Nimbus 365 Coupé: added 1.94 m headroom and separate-stall shower; engine count and per-engine power are explicitly configuration-dependent because factory offerings include single and twin installations.
- Ranger Tug R-21 Classic: added single-engine, protective-keel and keel-protected running-gear classifications; engine power remains configuration/production dependent.
- Ranger Tug R-21 EC: added 6.4 m LWL, 1.88 m headroom, single-engine count and 22.37 kW per-engine power for the supported 30 hp diesel configuration.
- Ranger Tug R-25 Classic: added single-engine, full/long-keel, keel-protected running gear and wet-head shower classifications; headroom and power remain production/configuration dependent.
- Hunt Surfhunter 36: added single-engine count and layout configuration; keel, rudder, running gear and engine power are explicitly variable with propulsion package.
- Holiday Mansion 38 Coastal: added twin-engine count; keel, rudder, running gear and engine power are explicitly variable across inboard/V-drive/sterndrive configurations.

## Data policy
- No unsupported model-wide value was inferred where production or configuration evidence varies.
- Missing information remains eligible and lowers confidence rather than excluding a boat.
- `boatmodels.json` remains the sole active source of current model-wide specifications.
- Evidence/research reports remain developer-only and do not create a secondary specification store.

## Completeness impact
After this wave, genuine missing-research counts decreased to:
- Headroom: 221 (from 224)
- RudderTypeCode: 191 (from 194)
- RunningGearProtectionCode: 138 (from 143)
- LWL: 117 (from 118)
- EngineCount: 38 (from 45)

The next queue is regenerated in `data/canonical-missing-data-queue-v6.86.json`.
