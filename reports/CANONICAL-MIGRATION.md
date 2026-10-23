# Canonical JSON migration

Development branch: `dev/canonical-json-migration`. Base: `0712feabc5afdcc2c37d2ee3196239d847ad1de8`.

The migration preserves all 995 model IDs and every specification, guidance value, null, evidence object and identity decision. Five documented URL adjustments align the model identities with existing or uniquely generated pages. Production has not been deployed or merged.

## Architecture

`data/canonical/ownership.json` assigns 181 existing and schema-defined model fields to exactly one source dataset. `BoatModelID` is the shared join key:

| Dataset | Owns |
| --- | --- |
| `identities.json` | Names, model identity, active state and permanent URLs |
| `specifications.json` | Current model-wide measurements, controlled codes and configuration |
| `guidance.json` | Model character, suitability, strengths, concerns and buyer/owner guidance |
| `provenance.json` | Research state, confidence, evidence summaries, revision metadata and historical legacy representations |

`boatmodels.json` is a generated public compatibility view. It is deliberately retained for existing application, search, contribution, moderator and external consumers. It is not a second authority. A build rejects edits that differ from the source composition. Run `npm run generate:models` after editing owners, then `npm run check:canonical`.

Legacy labels and imperial measurements remain in provenance as source representations. Their unit uncertainties are preserved; they are not promoted to competing current specifications. Canonical SI/code fields retain precedence. Production phases own only scoped overrides; registry entries retain identity decisions; aliases, resources, taxonomies, evidence assertions and community proposals retain their existing scopes. Unknowns never become inferred facts.

The old knowledge-card database is removed from runtime. Cards are projected in memory from the public model view and the authoritative resource, listing, annotation and coverage datasets. Historical cards and the exact original model/registry files are preserved as exact bytes with SHA-256 checksums in the Phase 5 small-piece archive `archive/phase5-fixtures/` (formerly `archive/canonical-migration-baseline/`).

## Application and deployment changes

- The loader rejects missing and duplicate model IDs, prevents overlays changing a stable ID, and bounds optional live overlay requests to five seconds.
- Local administrative model writes split fields back into their owners, regenerate the compatibility view, and retain a recovery journal until completion. Reads fail closed if an incomplete journal exists. A saved administrative snapshot is restored through ownership validation at server startup. Corrections use schema types, units and enum codes. New promoted identities enter the registry as PendingReview. The local server enforces public source exclusions as well.
- Page generation reads canonical owners. All 995 model pages and their permalinks are generated; the original checkout had 276 model-page directories. Existing historical routes are retained. `canonical-url-migration.json` documents the five URL alignments, including four collisions; identities are not merged or verified by those changes.
- The public build removes historical Phase 2 model/alias shards, research batches, evidence batch working files, archives, canonical source datasets and other source-only files. Image candidates remain public because image fallback consumes them.
- Five obsolete one-time workflows that wrote the old model view are archived. A read-only CI workflow tests ownership, records, page generation and public deployment artifacts on the development branch and PRs. No production deployment workflow was invoked.

## Verification

The migration suite checks lossless reconstruction against the checksum-protected baseline, allowing only the five recorded URL corrections; one owner per field; duplicate/orphan rejection; unknown-field rejection; isolated administrative writes and journal recovery; and 995 in-memory knowledge cards.

Existing integration tests verify 995 records, 995 registry identities, 66 production phases, 298 search aliases and 6,965 filter evaluations. Filtering, correlated configurations and overlay regression tests pass. A read-only live overlay probe passed with three patches and no added models. Independent page-generation tests produce 995 unique model URLs. The public artifact checks model pages, loader scripts, image dependencies and all source exclusions. Baseline and secret guards pass. Browser smoke checks cover startup, catalogue count, search, a model guide and bounded overlay fallback.

`canonical-inventory.json` inventories JSON files, schemas, package dependencies, explicit field owners and static consumer references. Static string analysis identifies candidates and cannot prove every dynamic access; application and artifact tests supply behavioral checks.

## Unresolved information and approval boundary

- 726 identities remain `PendingReview`; all original identity decisions remain intact. The identity audit reports no broken references, but its evidence index does not independently verify these identities.
- Historical comparison finds 165 source-linked deadrise values outside the application field schema. They remain historical evidence; none were silently promoted. There are 2,080 comparisons with an alternate current field and 3,969 matching values; no direct conflicts in that audit's selected fields. This is not a claim that every historical assertion is resolved.
- Existing taxonomy and knowledge-layer validation warnings remain; the migration preserves the underlying values. Their correction requires separate evidence/ontology work.
- The frozen migration baseline test intentionally detects subsequent factual edits. Future approved data changes must update that release-specific expectation explicitly.
- Hosted CI/environment-specific deployment and authenticated production moderation are separate approval gates. The review artifact is built locally; production remains unchanged until the user approves promotion. GitHub push was attempted but the Git credential helper could not run in this environment. The local development branch and export bundle contain the completed changes; no remote branch or PR was created.

For an interrupted local administrative write, inspect `.bscout-data/canonical-write-journal.json`, then use `node developer/canonical-store.cjs --recover-before` or `--recover-after`. To abandon the migration, return to the base commit; no production data has been mutated.
