# Phase 4: startup search projection and lazy detail

Finalized: October 23, 2026. Measurements collected October 22, 2026. Branch: `dev/search-detail-projections`.
Starting commit: `4990f6a994c6d600e4489b63c42eac8e7153c0da` (Phase 3).
The local delivery receipt records the final review commit.

## Status and acceptance boundary

Phase 4 is accepted as of October 23, 2026. Functional and data-safety validation
passed. The owner accepted the measured roughly 0.20–0.21-second additional
cold-guide completion time in response to the explicit acceptance question.
Startup data and local startup medians improve, and the guide shell appears at
least as quickly. The original "no material startup or guide regression" gate
is closed by owner acceptance of this specific measured tradeoff, not by claiming
that full cold-guide completion became faster. This acceptance authorizes neither
deployment nor Phase 5 work.

Main remains `d082c427250cb0199039863335d4e82fbf483fe0`. There was no push, PR,
merge, deployment, production API write or database migration. The acknowledged
backup was not changed. No Phase 5 cleanup or history rewriting was performed.

## Final architecture

The generated v3 manifest pins two representations to the same source digest:
complete records and a declared `batlas-search-v1` projection. Its release digest
includes both representations, routing, auxiliary datasets and counts.

`DETAIL_ONLY_FIELDS` in `datarepository.js` declares 17 audited detail fields.
Every other field is retained, including unknown future keys. All specifications,
legacy fallbacks, distinct `Propulsion`/`propulsion`, `SpecificationConfidence`,
configuration completeness/linkage, engine options, text-search inputs and
result-card knowledge inputs survive. In particular, `ResearchNotes`, `BestFor`,
`Strengths`, `Weaknesses`, `CommonProblems` and `AvoidIf` remain where existing
search/card consumers need them. Evidence summaries and long detail narratives
are preserved in complete records, not deleted from canonical sources.

Public bootstrap, the community guide and contribution model choices use
`loadSearchData()`. All 995 canonical models appear together after integrity
validation; no incremental loading temporarily narrows the candidate universe.
Search, scoring, action-generation and intelligence-layer policy files are unchanged.

`getModel(id)` loads only the complete shard containing the requested model,
verifies it, joins production phases and applies the same epoch's overlay and
compatibility rules. It returns a distinct complete row, never mutating a search
row or overwriting a patch with an unpatched raw record. Requests for the same
file/model share promises. Initial and lazy file requests share a four-slot bound.
Rejected lazy work is evicted and can retry without losing the catalogue. It stays
pinned to the existing release; missing old detail never mixes in a newer release.

The research guide requests complete model detail and annotations on opening.
Owner resource/listing collections are requested when Owner Resources is opened.
Loading and failure states are explicit; failure cannot masquerade as an empty
resource library. Selecting the tab again retries. Guide sequence checks prevent
late responses from a previously selected model repainting a newer selection.

`loadApplicationData()` remains an explicit complete-record compatibility API.
`loadBaseline()` still supplies the frozen, complete raw baseline to moderation;
failed baseline loading still blocks promotion. These explicit full APIs may load
both representations when called after search initialization. Public startup does
not call them. The local admin server publishes both forms atomically through the
manifest, and generated-file retention covers preceding search and detail shards.

## Sizes and request budget

All sizes below are raw UTF-8 JSON bytes, not CDN-compressed transfer estimates.

| Item | Count | Bytes | Largest file |
| --- | ---: | ---: | ---: |
| Complete model shards, unchanged | 29 | 5,512,638 | 199,705 |
| Search model shards | 20 | 3,767,507 | 199,714 |
| Auxiliary shards, unchanged | 34 | 1,806,890 | 199,930 |
| Current manifest | 1 | 77,097 | 77,097 |
| Generated compatibility endpoint | 1 | 6,750,704 | 6,750,704 |

Catalogue startup drops from **7,365,088 to 5,329,850 bytes (27.63% less)** and
from **64 to 51 static catalogue requests**, plus the same one optional overlay.
No complete model shard or deferred resource collection is fetched at startup.
The first Albin 25 research guide fetches a 191,210-byte complete-record shard and
48,197 bytes of annotations. First Owner Resources access loads the two curated
resource shards and listing-search shard (273,447 bytes combined). Collections
are deferred by feature, not separately partitioned for every model.

The public artifact has 1,595 files, about 109.19 MB. Keeping both representations
adds about 3.77 MB to deployment storage, while reducing startup bytes. This is a
runtime optimization, not a claim that the whole deployment becomes smaller.
Generated output and the root compatibility cache remain ignored. Canonical
owners, their 128 partitions, registry decisions, 66 phases, 298 aliases and all
995 current records are unchanged. The source digest remains
`b43b66efaf67710892d459c5d28520f925fd689a7ee634dc1c4ab219188a3f83`.

## Repeatable measurements

`reports/search-detail-performance.json` contains the compact final summary.
Bulky run evidence stays under `.bscout-data/phase4-architecture/performance/`.
The baseline is reconstructed from Phase 3 Git objects by
`developer/prepare-phase3-performance.cjs`; its exact old release digest is
verified. The comparison also requires identical canonical source digests.
The reconstructed folder is a benchmark overlay, not a deployable backup.

The final run used installed headless Edge, three alternating fresh contexts per
variant on each viewport, one localhost server, normalized LF, uncompressed and
unthrottled traffic, blocked external requests and writes, and no concurrent
build/regression jobs. This matches the supported Phase 0 measurement method.
It remains a local sample, not a production or physical-device benchmark.

| Median | Desktop Phase 3 | Desktop Phase 4 | Mobile viewport Phase 3 | Mobile viewport Phase 4 |
| --- | ---: | ---: | ---: | ---: |
| Catalogue ready | 1,152 ms | 1,050 ms | 1,344 ms | 1,215 ms |
| Guide shell visible | 56.5 ms | 39.0 ms | 68.7 ms | 66.5 ms |
| Complete cold research guide | 56.5 ms | 269.7 ms | 68.7 ms | 266.7 ms |
| Pure model JSON parse | 11.9 ms | 6.7 ms | 13.0 ms | 8.8 ms |
| Compatibility microbenchmark | 4.2 ms | 3.8 ms | 4.8 ms | 4.9 ms |

The largest observed Phase 4 cold-guide completion in these six runs was about
469 ms. The visible guide and startup improve; full cold completion regresses.
That is the owner-accepted tradeoff; the earlier shell paint does not remove it. Repeat guides can reuse verified file/model/resource promises, but no
repeat-guide timing claim is made here.

Overall image/fallback request totals vary and are not used to claim catalogue
transfer improvements. The resource timing buffer was enlarged and catalogue
bytes were sampled before opening a guide. Body completion timing includes I/O,
not pure parse CPU; the separate parse benchmark uses five samples per context.
Heap values are point samples affected by GC, not retained-memory measurements.
An additional one-run-per-variant diagnostic with valid synthetic external images
was kept separately under `performance-valid-images/`. It also showed slower
complete cold-guide loading and is not substituted for the primary three-run
comparison. Physical-device/Safari, real mobile networks and deployed CDN/cache behavior were
not available and remain unverified.

## Validation

All final functional/data-safety checks are recorded in the delivery receipt:

- Canonical ownership, migration, partition integrity, rejection/recovery,
  integration, filtering, correlated configurations, overlays and exclusion suites.
- Existing scoring safeguards and full compatibility-loader equivalence.
- New projection comparison: all 995 models across 15 profiles, 14,925 exact
  assessments and buyer-action comparisons, candidate membership and order,
  all model-knowledge scores and result-card knowledge explanations. Future
  configuration keys and nested false/zero/null values remain intact.
- Selective detail fetching, zero full-detail/resource requests at startup,
  shared overlay, immutable search rows, patch/addition preservation, complete
  hydration equality, unknown IDs and retry after lazy detail failure.
- Artifact reconstruction, full/projected routing and hashes, deterministic
  builds, shard size limits, fresh SEO/canonical URLs, source exclusion,
  bounded preceding-release retention and failed-build restoration.
- Local authenticated moderation, served-release freshness, promotion and restart
  persistence; page generation; production readiness for all 995 knowledge and
  comparison displays, contribution identities and image fallback.
- Actual Worker handler against isolated SQLite; version and secret guards.
- Desktop/mobile browser filters, saved/reloaded legacy searches, ranking,
  guide/comparison agreement, contribution correction values, root/privacy/saved
  entry points, lazy owner resources and published additions. A missing resource
  shard shows an error, preserves all candidates and recovers on tab reselection.
  Rapid guide changes cannot repaint the newer model with the earlier response.

Browser fixtures use the existing tour's normal dismiss button and reopen the
existing mobile Standard accordion when necessary; behavioral assertions remain.
No live-overlay probe, real submission, notification or production write ran.

## Review, migration and rollback

The owner accepted the measured roughly 0.2-second cold-guide completion penalty
in exchange for the startup reduction on October 23, 2026. Phase 4 acceptance is
complete. The local implementation and acceptance commits are not deployment
approval. Phase 5 requires a separate instruction.

Reproduce functional gates with `npm run verify:production`, with full historical
Git objects available. Set `PHASE4_OUTPUT_DIR` to a writable absolute directory
under `.bscout-data/phase4-architecture/scoring` in this restricted workspace.
Browser tests require the installed Playwright module and localhost permission.
Run `node developer/prepare-phase3-performance.cjs` before
`tests/startup-projection-browser.cjs` to reproduce the final comparison.

Any future authorized deployment must publish matching scripts and the complete
v3 manifest with both representations and retained prior immutable files. Keep
`boatmodels.json` for external compatibility until a separate consumer review.
Existing open pages retain their pinned snapshot; reload when adopting a new
catalogue. Never silently substitute detail from a different release.

Rollback: stop local writers, preserve subsequent source edits, switch to
`dev/shared-model-repository` at `4990f6a994c6d600e4489b63c42eac8e7153c0da`, and
rebuild the complete Phase 3 artifact. Do not deploy the benchmark overlay folder.
Both phases use the same canonical format and generated compatibility endpoint;
no D1 rollback or data migration is necessary. A production rollback would require
its own explicit authorization, which was not requested or exercised here.
