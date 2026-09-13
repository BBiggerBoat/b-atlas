# B-Atlas v6.83.0 — Canonical Field Usage & Filter Integrity

## Summary
This release completes the application-side canonical-field migration begun in v6.82.0. Current model specifications remain stored only in `boatmodels.json`, and active filtering, recommendation, display and moderation paths now consume/write those canonical fields directly rather than depending on retired imperial mirrors.

## Changes
- Converted hard filters, route checks, mission constraints and recommendation dimension evaluation to canonical LOA/Beam/Draft/AirDraft fields.
- Converted Boat Knowledge platform-size, hull-speed and completeness calculations to canonical dimensions/mass.
- Removed runtime synthesis of retired measurement/mass mirror fields from `datarepository.js`.
- Updated model cards, model-guide summaries, comparison/specification displays and Dream view to canonical measurement formatting.
- Corrected tallest-crew headroom matching to read canonical `Headroom` instead of nonexistent `Headroom_m`.
- Updated local and Cloudflare moderation publishers so approved legacy-form inputs are converted immediately into canonical metres/kilograms and never repopulate retired fields.
- Updated enrichment and correction fallbacks to canonical field IDs.
- Added canonical-field usage and buyer-scenario regression coverage.
- Resolved Rosborough RF-246 Legacy Sedan Cruiser Diesel draft at 2 ft / 0.6096 m from independent period/review evidence.
- Marine Trader 38 Sundeck beam/draft remain unknown pending reliable generation-specific evidence.
- Marine Trader 40 Double Cabin remains 1974–1985; external references still contain a title/text discrepancy around 1985/1986, so no unsupported extension was made.
