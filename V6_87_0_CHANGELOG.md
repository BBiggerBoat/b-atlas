# B-Atlas v6.87.0 — High-Impact Missing-Data Research Wave 2

## Scope
Second evidence-based research wave, focused primarily on headroom, rudder arrangement, and running-gear protection where reliable model-specific documentation was available.

## Changes
- Added or explicitly classified high-impact facts across 10 priority records.
- Camano 31 Troll: added 6 ft 2 in representative headroom and full-keel-supported barn-door rudder classification.
- Nordic Tug 26: added 6 ft 4 in representative salon headroom and full-keel/rudder-shoe rudder classification.
- Willard Vega 30 Voyager: added 6 ft headroom, skeg-hung rudder and skeg-protected running gear from the original owners manual.
- Ranger Tug R-25 SC: added 6 ft 4 in headroom and wet-head shower classification.
- Ranger Tug R-29 Classic: added 6 ft 6 in salon/general headroom, 6 ft 2 in head/forward-cabin headroom and wet-head shower classification.
- Nimbus 3003: added 1.90 m headroom and 8.87 m LWL.
- Meridian 381 Sedan: added 6 ft 4 in cabin headroom.
- Albin 27 Family Cruiser: added 6 ft standing headroom for primary living/helm spaces.
- Marine Trader 34 Europa: added 6 ft 3 in documented cabin headroom.
- Grand Banks 36 Classic: headroom and engine count are now explicitly production/configuration-variable rather than treated as missing research.

## Completeness impact
After Wave 2, genuine missing-research counts are:
- Headroom: 211 (from 221)
- RudderTypeCode: 188 (from 191)
- RunningGearProtectionCode: 138
- LWL: 116 (from 117)
- EngineCount: 37 (from 38)

## Data policy
- No rudder or protection classification was inferred merely from shaft-drive propulsion.
- Conflicting or generation-dependent facts remain unknown or explicitly variable.
- `boatmodels.json` remains the sole active source of current model-wide specifications.
