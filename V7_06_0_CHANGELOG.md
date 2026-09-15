# B-Atlas v7.06.0 — Clean Primary Site Packaging

- No canonical boat specifications changed from v7.05.0.
- Confirmed `boatmodels.json` remains the sole active source for current model-wide specifications.
- Historical changelogs, superseded audits, migration scripts, tests, reports, and internal enrichment/audit tools moved to the separate Development Archive package.
- Retained only runtime moderator assets and the two generators required by the local moderation workflow under `developer/`.
- Simplified `data/data-manifest.json` to document current runtime ownership rather than historical migrations.
- Simplified `package.json` to operational/local deployment commands; research/test tooling is preserved in the Development Archive.
- Runtime Knowledge evidence/provenance remains active by design; it documents sources but does not compete with canonical specifications.
- Replaced 20 broken/missing model image references with the existing B-Atlas placeholder and regenerated all static model/search pages; no boat specifications were changed.
- Final validation: 259 unique canonical models, zero missing active image references, all active JSON parses, single-source model-data guard passes, canonical-field buyer-scenario guard passes, cross-database QC passes, and cruising-performance regression passes.
