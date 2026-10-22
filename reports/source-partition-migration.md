# Phase 0 and Phase 1: canonical source partitions

Starting revision: `d082c427250cb0199039863335d4e82fbf483fe0`.
Review branch: `dev/canonical-source-partitions`. Final commit SHA is recorded in
the local delivery receipt and completion message, avoiding a self-referential commit.
The owner confirmed backup complete; no backup identifier or location was supplied.
No remote push, main update, merge, deployment, live contribution request or production
database mutation was performed. Phase 2 has not begun.

## Baseline and dependency inventory

Remote main matched the assessment revision at clone and final verification. The
workspace was initially empty; no existing user changes were overwritten. Full Git
history is available for historical scoring and readiness comparisons. No applicable
AGENTS.md was present in the repository or inspected parent locations.

`source-partition-baseline.json` records versions, counts and checksums. It distinguishes
Windows checkout bytes (CRLF) from repository blob bytes. Counts remain 995 models,
995 registry identities, 66 production phases, 298 aliases, 181 owner fields and
726 pending identities. All canonical values, model order, case-sensitive keys,
null/absent/false/zero distinctions and nested arrays remain equal to the starting
revision. Registry decisions, phases, aliases, source evidence, permalinks and redirects
are unchanged.

| Dependency | Phase 1 treatment |
|---|---|
| Four field-owner datasets | Replaced by 128 partitions; same domains and field map |
| Canonical store API | Existing exports retained; set/map validation and partition-aware writes |
| Main loader and knowledge cards | Unchanged; still consume generated public model view |
| Contributions and browser moderation | Unchanged runtime baseline and overlay interfaces |
| Local admin corrections/promotion | Existing store API; tests expanded for import, promotion and restart |
| D1 overlays and Worker | Unchanged; tests use isolated SQLite and in-memory attachments |
| Production phases/configurations | Unchanged scoped inputs to Phase 3/4 |
| SEO generator and public builder | Unchanged; recursive canonical-directory copies used by isolated tests still work |
| Deployment manifest/workflows | Unchanged; canonical directory remains excluded and public monolith remains required |
| Data manifest/inventory tool | Owner locations now identify directories; inventory recognizes contained partitions |
| Existing tests | Source-path assertion updated without dropping behavior; optional Phase 4 output directory added |

The data manifest's owner-location metadata changes, but the browser's data loading,
compatibility processing, phase merge and optional live overlay behavior do not.

## Final storage and implementation

Each domain contains exactly `00.json` through `31.json`, using the unsigned first
eight hexadecimal digits of SHA-256 of the exact UTF-8 ID modulo 32. Records in a
bucket sort by ID. `data/canonical/index.json` preserves authoritative catalogue
sequence independently of bucket order. `ownership.json` retains its complete field
map and adds an explicit storage contract.

| Domain | Files | UTF-8 bytes | Largest file |
|---|---:|---:|---:|
| Identities | 32 | 492,658 | 21,447 |
| Specifications | 32 | 1,871,515 | 82,711 |
| Guidance | 32 | 1,952,874 | 100,294 |
| Provenance | 32 | 2,562,279 | 125,183 |
| Total partitions | 128 | 6,879,326 | 125,183 |

Figures are LF-serialized file bytes; future Windows checkouts can have CRLF overhead.
The four original Git blobs totaled 6,878,954 bytes; array/newline overhead adds only
372 bytes. No partition exceeds the 150,000-byte warning threshold. The enforced
failure threshold is 200,000 bytes. The source README documents a future versioned
subpartition strategy for an overflowing bucket, without global rehashing.

The generated `boatmodels.json` remains tracked and public as explicitly required
for Phase 1. It is still generated, never a competing editable owner. Removing it
or introducing generated public shards belongs to later phases.

Before any save, all prospective domains and sizes are validated. Unchanged files
retain bytes and modification times; existing Windows line endings are preserved.
The public view also remains untouched when semantically equal despite object-key
serialization order. Changed files use flushed temporary files and atomic rename.
The existing before/after journal remains until all partitions, index and generated
view are written. Reads fail closed on an incomplete journal. Recovery overwrites
damaged partial outputs, removes leftover expected temporary files, and supports
both old snapshot-shaped journals and legacy persisted monolithic admin snapshots.

This retains the existing single-writer operating model. It does not introduce
cross-process writer locking or claim filesystem-level multi-file transactions.

## Verification

Full `npm run verify:production` passed on both the frozen starting revision and
the final implementation, using Node 24.18.0 and Python 3.14.6 on Windows. Hosted CI
uses its existing Node 22/Python 3.12 setup; no hosted run was dispatched.

- Canonical migration: lossless baseline reconstruction, 181 owners, 995 knowledge
  cards and isolated write/recovery checks.
- New partition suite: complete independent comparison with the pre-partition Git
  model view and ownership map; routing, order, size thresholds, malformed/missing/
  duplicate/orphan/wrong-owner rejection; no-op and focused-write stability;
  preflight oversized-write rejection; injected multi-domain partial writes; before
  and after recovery with damaged index and generated view.
- Canonical integration: 995 identities, 66 phases, 298 aliases and 6,965 evaluations.
- Filter behavior: 15 assertions; correlated configurations: 14 cases; community
  overlay patch/add-model/add-manufacturer regression.
- Phase 3: 103 audit cases, 24 safeguards, 14,925 evaluations.
- Phase 4: 34 scoring safeguards and 14,925 assessments against historical Phase 3
  behavior, with unchanged candidate membership.
- Extended authenticated local admin tests: unit/code/boolean corrections, owner
  writes, legacy persisted snapshot import, new-model promotion, pending identity
  preservation, restart persistence, and source-only HTTP exclusions.
- All 995 generated SEO pages/permalinks, repeat generation, public build,
  deployment dependencies/exclusions, 995 guide/comparison checks and additional
  readiness evaluations.
- Actual Worker handler against isolated SQLite: submissions, duplicate protection,
  authentication, correction publication, public overlays, backup integrity and
  browser API client. Report records zero live writes.
- Baseline and secret guards.
- Existing Phase 4 browser acceptance passed on the frozen baseline and migrated
  built application in installed Edge desktop (1440x1000) and mobile emulation
  (390x844): catalogue/ranking, guide/comparison agreement, saved-order reload,
  legacy/hidden preferences, must-have uncertainty and variable engines.
- Existing Phase 3 browser acceptance passed on the migrated build in both viewports:
  live/saved/combined counts 691/63/716, saved reload and hidden requirements.

The build contains 1,511 files before and after. A complete artifact comparison
normalizing only CRLF/LF found changes only in `data/data-manifest.json` and
`public-build.json`. All other public content is equivalent, including browser code,
model records, images and SEO HTML. Exact tracked model-view bytes are unchanged.

Initial test attempts exposed environment/test-setup issues: sandbox restrictions
on existing outside-workspace output paths and local server startup; one baseline
run overlapped source edits and was discarded in favor of the frozen copy; a new
test consumed a response body twice; byte-identity tests exposed Windows newlines
and public JSON property ordering. These were corrected or isolated before the
final successful gates. They are not counted as application passes.

Raw logs, complete pre-migration composition, browser results/screenshots and timing
samples are kept under ignored `.bscout-data/phase01/` (the frozen baseline browser
suite's default results are under `.bscout-data/outputs/phase4-implementation/`).
They are local review evidence, not published assets or long-term backup substitutes.

## Performance and remaining limits

The storage migration does not reduce public JSON size, startup payload or image
bytes. Browser measurements use installed headless Edge, fresh desktop/mobile
contexts, local uncompressed transport, blocked external traffic and no production
writes. Physical devices, Safari, production network/CDN transfer and actual retained
heap are not measured. Point-in-time heap samples are not presented as retained heap.

Initial parallel timing runs were noisy and sampled image requests at different
completion points. Final controlled measurements alternate before/after on one
local server, normalize text line endings, record the catalogue-ready DOM mutation,
and wait for initial network settling before recording resource totals. Pure JSON
parse/compatibility microbenchmarks are separate from response-body completion time.
The raw timing receipt is `.bscout-data/phase01/browser-paired.json`; compact results
are tracked in `reports/source-partition-performance.json`. Five alternating runs
per side and viewport produced these medians:

| Metric | Desktop before / after | Mobile viewport before / after |
|---|---:|---:|
| Catalogue ready | 1,242 / 1,140 ms | 1,120 / 1,121 ms |
| Guide visible | 326 / 321 ms | 339 / 328 ms |
| JSON parse microbenchmark | 12.40 / 12.55 ms | 13.20 / 11.45 ms |
| Compatibility microbenchmark | 4.00 / 4.10 ms | 4.35 / 3.80 ms |
| Long-task duration total | 980 / 876 ms | 920 / 897 ms |
| Initial resource requests | 88 / 90 | 95 / 99 |
| Initial decoded resource bytes | 16,800,917 / 17,113,975 | 18,024,761 / 18,880,221 |

No material startup or guide regression was observed in these local samples; the
differences do not demonstrate a public performance improvement. Network-idle does
not force offscreen lazy images to load, so resource totals still vary with image
and rendering scheduling. Those totals are observed samples, not a changed payload
contract; complete artifact comparison establishes unchanged public content apart
from the two metadata files. Point heap medians remain approximately 25 MB.

Partition fanout adds local source-file I/O compared with four aggregate reads.
Ten alternating source loads measured medians of 103 ms before and 280 ms after
on this Windows/OneDrive checkout. This approximately 177 ms local read cost is a
tradeoff, not a public startup regression. The source-load benchmark is recorded
separately. No source caching was introduced that could conceal administrative
changes or interrupted journals. This tradeoff should be monitored for local admin
and build performance; public runtime delivery is unchanged.

## Local rollback and recovery

There has been no production migration to roll back. Stop local administrative
writers before either operation.

For an interrupted canonical write, inspect
`.bscout-data/canonical-write-journal.json`, then choose exactly one:

```
node developer/canonical-store.cjs --recover-before
node developer/canonical-store.cjs --recover-after
npm run check:canonical
```

Both paths were tested with deliberately partial multi-domain writes and damaged
index/view outputs. Preserve the journal until recovery succeeds; do not delete it
to bypass the read guard.

To return this checkout to the original source format when no later user changes
exist:

```
git status --short
git switch main
git rev-parse HEAD
```

HEAD should be `d082c427250cb0199039863335d4e82fbf483fe0`; main was not moved. The
development branch retains the completed implementation. If later local edits or
administrative facts exist, export/commit them and recover any journal before
switching; replay reviewed changes through the old store rather than discarding
them. Existing ignored persisted administrative snapshots are retained. Do not
restore D1 or erase later community submissions as part of a source-format rollback.
