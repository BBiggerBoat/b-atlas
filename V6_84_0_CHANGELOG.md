# B-Atlas v6.84.0 — Canonical Completeness & Missing-Data Audit

## Purpose
Establish a field-by-field view of what B-Atlas knows, what is intentionally unknown, what varies by configuration, what is not applicable, what already exists but still needs normalization, and what genuinely requires research.

## Changes
- Audited all 259 canonical boat-model records against all 80 registered canonical fields.
- Added `data/canonical-completeness-audit-v6.84.json`; it stores classifications only, not duplicate specification values.
- Added `data/canonical-missing-data-queue-v6.84.json` with separate model research, normalization, and systemic field-program queues.
- Explicitly distinguishes `researched_unknown` and `variable_by_configuration` from missing research so unknown information remains eligible rather than being treated as a negative.
- Treats schema applicability as Not Applicable (for example sail-rig fields on powerboats).
- Treats blank LastYear on current/active production models as open-ended rather than missing research.
- Identified normalization gaps where equivalent source-backed values already exist inside the canonical record (including StyleCode, CoolingCode, FlybridgeCode, SideDecksCode, ShowerTypeCode and KeelConfigurationCode).
- Separates fleet-wide unadopted schema fields from model-level research failures.
- Added a regression test ensuring every field/model receives one classification and audit reports never duplicate model specification values.

## Key completeness findings
- LOA: 252 present / 7 researched unknown / 0 missing research.
- Beam: 252 present / 7 researched unknown / 0 missing research.
- Draft: 250 present / 9 researched unknown / 0 missing research.
- Air draft: 144 present / 115 researched unknown / 0 missing research.
- Fuel, propulsion, hull behaviour, hull configuration, boat family, aft-cabin and trailerability canonical classifications: 100% populated.
- Headroom: 35 present / 224 genuine research gaps.
- Rudder type: 65 present / 194 genuine research gaps.
- Engine count: 214 present / 45 genuine research gaps.
- Model-wide tankage is strong but incomplete: fuel 249/259, water 243/259, holding 222/259.

## Principle
Known absence can exclude; missing information remains unknown and must not exclude a candidate.
