# Phase 3: shared model repository

Date: October 22, 2026. Review branch: `dev/shared-model-repository`.
Starting revision: `427c46db78244b33d44d6f238ffe89c3b98eef44` (Phase 2).
The final commit is recorded in the local delivery receipt and completion message.

## Outcome

Catalogue search, knowledge cards, the community guide, contribution model choices
and moderation baseline checks now use one shared repository. Browser model loads
use complete generated shards. There is no internal browser request for the
large `boatmodels.json` endpoint, no search/detail projection, and no new competing
model authority. The compatibility endpoint remains available for external users.

All 995 canonical models, their order and values, evidence/provenance, production
phases, registry decisions, field ownership and Phase 4 scoring policy are retained.
No canonical or supporting fact files were edited. The source digest remains
`b43b66efaf67710892d459c5d28520f925fd689a7ee634dc1c4ab219188a3f83`.

Main remained locally at `d082c427250cb0199039863335d4e82fbf483fe0`.
No push, PR, merge, deployment, production API write or database migration occurred.
The acknowledged backup was not changed. Phase 4 architecture optimization has
not begun; the existing Phase 4 scoring implementation was preserved and tested.

## Implementation

- `datarepository.js` now owns release loading, bounded concurrency, integrity
  checks, the effective catalogue, raw frozen baseline and optional live overlay.
  One transport function shares one in-flight or completed snapshot. Complete
  model lookups cannot overwrite published patches with later partial hydration.
- `developer/public-model-artifacts.cjs` emits a version 2 catalogue manifest.
  Model shards and 30 auxiliary datasets are pinned by content hashes, including
  phases, aliases, registries, evidence, annotations, resources and static community
  publications. A release digest includes all descriptors, routing and counts.
- Required files are validated before any rows are exposed. At most four shard
  requests run together. Each required request has a 30-second timeout. A failed
  release retries once from a fresh manifest and reloads immutable files; no rows
  from the failed attempt survive. Later calls can retry a rejected snapshot.
  Valid immutable files can use the browser cache between page loads.
- One overlay request per epoch has a five-second timeout. Missing optional
  overlays preserve the static catalogue. Existing patch normalization, original
  model IDs, additions and manufacturer deduplication semantics are retained.
  Resource merging clones nested collections, preventing repeated additions from
  modifying the baseline. Guide publications use that same overlay snapshot.
- Knowledge cards, contributions and moderation no longer independently fetch
  model arrays or overlays. Contribution load errors remain retryable and show a
  usable error message. Promotion cannot submit empty duplicate-check lists after
  a failed baseline load. Reconciliation requires its published overlay. Moderator
  refreshes and successful writes invalidate the repository epoch.
- The local admin server generates and serves the same pinned release, replacing
  its manifest only after immutable files are present. Served release freshness
  after canonical promotion is covered by the isolated server test.
- The builder retains verified immutable files for one preceding release. Repeated
  builds keep that same retained generation; the second-old generation is dropped.
  Missing older releases cause a whole-release retry. A damaged retention input
  fails the build rather than being copied into the next artifact.
- Runtime script cache keys, dependency inventory, public allowlist and pipeline
  documentation are updated. The existing registry PR workflow now runs the new
  shared-repository test with the Git history needed for its Phase 2 comparison.

## Quantified footprint

Sizes are uncompressed UTF-8 bytes, not measured CDN transfer sizes.

| Item | Count | Bytes | Largest file |
| --- | ---: | ---: | ---: |
| Canonical source partitions, unchanged | 128 | 6,879,326 | 125,183 |
| Complete public model shards | 29 | 5,512,638 | 199,705 |
| Pinned auxiliary shards | 34 across 30 datasets | 1,806,890 | 199,930 |
| Current catalogue manifest | 1 | 45,560 | 45,560 |
| Compatibility model endpoint | 1, generated only | 6,750,704 | 6,750,704 |

The complete initial catalogue request set is 7,365,088 raw bytes: one manifest
and 63 immutable arrays, followed by one optional overlay request. Concurrent
catalogue, card and contribution requests issue each required URL once per epoch.
The browser check confirms one overlay request and zero monolith requests on both
desktop and mobile. The current build needs no outgoing-only retained files because
its preceding release's referenced immutable files are still part of this release.

The whole public artifact contains 1,575 files, approximately 105.38 MB, dominated
by existing images and SEO. Pinned auxiliary copies add approximately 1.81 MB to
the artifact while original source-path endpoints remain available for compatibility.
Generated outputs and root model cache remain ignored. No new tracked monolith
was introduced; historical archives and other existing large sources remain for
the later cleanup phase.

## Validation

The release-gate components and final browser checks are recorded in the local
receipt. Coverage includes:

- Existing canonical migration/partition/integration, filter, correlated
  configuration, overlay, exclusion and scoring suites.
- Old Phase 2 loader versus new loader: exact dataset values for every existing
  application dataset and 14,925 full model/profile assessment comparisons across
  995 models and 15 profiles. Candidate IDs, ordering including ties, reasons,
  exclusions, scores, confidence, warnings and generated buyer actions agree.
- Concurrent catalogue/cards/contributions, immutable baseline, patches/additions,
  repeated resource projection, optional overlay timeout, explicit refresh and
  release pinning. Nine required-data failure scenarios cover missing/corrupt
  files, byte/hash mismatches, stale identity, counts, routing, unsupported schema,
  request timeout and duplicate IDs. A stale manifest can recover to a complete
  new release; a rejected snapshot can recover on a later call.
- Promotion failure sends no request. Successful mock promotion receives the raw
  baseline and invalidates the epoch. Authenticated localhost moderation, served
  shard freshness, restart persistence and source exclusion are tested in copies.
- Artifact reconstruction, descriptor hashes/counts/routing, deterministic builds,
  oversize rejection, bounded retention, corrupt retention rejection, fresh SEO,
  canonical URLs, source exclusion and restoration after failed publication.
- Production readiness across knowledge rendering, image fallback and comparisons;
  actual Worker handler against isolated SQLite, including authentication,
  duplicate protection, correction publication, overlays and backup integrity.
- Desktop and emulated mobile Edge workflows: filters, saved/reloaded searches,
  hidden legacy requirements, ranking, comparisons, guide/card agreement and
  contribution correction values. A synthetic overlay adds one model and patches
  another; all consumers agree, model IDs remain protected, resources appear once,
  and network monitoring confirms no monolith request or external write.
- Baseline/version guard, secret scan, source diff checks and Git whitespace check.

The initial combined gate exposed a cross-VM array-prototype assertion in the
readiness harness. Comparing its serialized IDs fixed the harness; no runtime
value discrepancy was involved. The remaining gate components were rerun after
that repair, and the final cache-recovery change received focused regression and
browser verification.

## Tradeoffs and limits

Phase 3 eagerly loads full records and supporting data. It removes repeated large
model loads within a page session and makes release boundaries explicit, but it
introduces more small requests and keeps both raw/effective objects in memory.
No Lighthouse, deployed CDN latency, memory benchmark or compression claim is made.
Search projections and on-demand detail remain Phase 4 work.

Catalogue integrity uses Web Crypto, requiring HTTPS or localhost. Images, form
schemas, localized labels and other UI assets retain their established loaders
and are outside the catalogue digest. The changing live overlay is sampled once
per epoch; public pages adopt newer snapshots on reload. This does not create a
transaction spanning a static deployment and the live API. Production CDN cache
behavior and real service outages were not exercised; all failure injection and
write tests used local mocks/copies. The existing live-overlay probe was adapted
but not run. Local administration retains historical ignored files; public build
retention is bounded.

## Migration and rollback

Review this branch and rerun `npm run verify:production` with full historical Git
objects available. In this restricted Windows workspace, set `PHASE4_OUTPUT_DIR`
to an absolute path under `.bscout-data/phase3/scoring`; local server/browser tests
need host execution permission. Browser evidence lives under `.bscout-data/phase3/`.
A separate authorization is required for any push, merge or deployment.

For a future authorized release, publish the complete generated artifact with its
matching runtime scripts and current/preceding immutable files. Keep the
compatibility endpoint until external consumers have been inventoried. Inspect a
preview for complete model counts, generated SEO and failed-request recovery;
do not combine individually copied scripts and manifests from different releases.

Rollback is to Phase 2 revision `427c46db78244b33d44d6f238ffe89c3b98eef44` and a
fresh complete build, or the saved complete Phase 2 artifact. Preserve subsequent
source edits before switching revisions. Both phases use the same canonical source
format and compatibility endpoint; no D1 rollback is needed. Restore a complete
matching artifact through the normal separately authorized deployment process.
