# Phase 2: generated public artifacts and SEO

Date: October 22, 2026. Starting revision:
`fe194dac8e059710d383c6673b8fd9f58c1427f6`.
Local review branch: `dev/generated-public-artifacts`.
Final commit is recorded in the local completion receipt and delivery message.

## Outcome and scope

Public model shards, the temporary compatibility endpoint and SEO pages now build
from one validated canonical composition. The root model monolith is untracked and
ignored. The four canonical domains, 128 source partitions, all 995 models, field
ownership, provenance, identity decisions, production phases and scoring behavior
are unchanged. This implements Phase 2 only; browser consumer migration and lazy
detail loading have not begun.

Main remained `d082c427250cb0199039863335d4e82fbf483fe0`. No push, PR, merge,
deployment, production API write or database migration was performed. The completed
owner backup was acknowledged; its location was not supplied and no production
access was made to discover it.

## Files and behavior changed

- `developer/build-public-site.js`: validates/composes owners once, generates into
  unique staging storage, validates outputs, then replaces local `dist/`. A failed
  staging build retains the preceding artifact; a failed replacement restores it.
- `developer/public-model-artifacts.cjs`: deterministic lossless JSON packing,
  content hashes, byte/count metadata, model-to-shard routing and release digest.
- `developer/model-page-input.cjs`: accepts the already composed snapshot instead
  of independently reloading it during builds; standalone generation is preserved.
- `developer/generate-search-landing-pages.py`: separates source and output roots,
  accepts the build snapshot and fixed clock, and generates SEO into staging.
- `deployment/public-manifest.json`: explicit public data/knowledge file allowlist,
  separate generated outputs, and retained static/asset/moderator lists. Broad data
  and knowledge directory copying was removed. Existing source exclusions remain.
- `server.js`: local static allowlisting recognizes explicit and generated outputs
  without allowing arbitrary new data/knowledge source files.
- `developer/canonical-store.cjs`, `.gitignore`, `package.json`: the root view is an
  optional local cache; checks work without it, test preparation generates it, and
  public builds do not consume it. Generated root data paths are ignored.
- Data manifest, deployment/preview/registry/audit/configuration workflows: generated
  shard checks, canonical-source path triggers, required Python setup, local cache
  preparation where necessary, and Node 22 alignment in the deployment guard.
- `tests/public-artifacts.cjs` and deployment tests: artifact reconstruction and
  reproducibility/freshness/failure gates. Documentation describes the format and
  rollback procedure in `deployment/ARTIFACT-PIPELINE.md`.

The previous root view is removed from Git tracking, not from the runtime contract.
`dist/boatmodels.json` is generated solely for unchanged clients and external
compatibility. No new public client loader was introduced. Historical migration
archives, research batches and checked-in SEO outputs remain for the later cleanup
phase. Current builds do not copy those SEO outputs as current facts.

## Quantified output

| Output | Result |
|---|---:|
| Model records | 995 |
| Lossless model shards | 29 |
| Combined shard bytes | 5,512,638 |
| Largest shard | 199,705 bytes |
| Manifest | 31,516 bytes |
| Compatibility endpoint | 6,750,704 bytes |
| Public artifact | 1,541 files, 103,553,047 bytes |

Each shard and its manifest must fit 200,000 UTF-8 bytes. Full reconstruction
preserves record order, every nested value, missing/null/false/zero distinctions
and case-sensitive keys. No evidence fields were dropped or confidence inferred.

The manifest includes a schema/format version, source/release digest, shard paths,
SHA-256 hashes, byte sizes, record counts, exact-ID routing and compatibility-view
metadata. Paths are relative to the public root. The build marker additionally
hashes the sorted public artifact inventory, excluding itself.

This temporarily adds roughly 5.5 MB of generated deployment data while the
compatibility endpoint remains. It does not increase the browser's initial model
requests, because clients still fetch the compatibility view. No startup payload
reduction or production performance gain is claimed for this phase. Shards are
generated outputs rather than tracked monolith replacements. Greedy packing can
shift later shard boundaries when record lengths change; immutable names and a
versioned manifest make that safe, but it is a caching/churn tradeoff to revisit
when consumers migrate. Hosting cache headers were not changed or audited live.

## SEO findings and functional equivalence

All 995 model pages, permanent identities, canonical URLs, sitemap entries,
permalinks and retired redirects are checked against the canonical snapshot.
Manufacturer, criteria and selected comparison pages are regenerated as well.
Homepage/static source files are not rewritten by the build.

Two existing build shortcomings were corrected within this scope:

1. The old broad href rewrite also changed model `<link rel="canonical">` URLs
   into interactive query links. Rewriting now applies only to anchor tags.
   Human navigation still opens the interactive application; crawler metadata
   retains the permanent model URL.
2. Four checked-in Chris-Craft pages displayed propulsion as Unknown even though
   their canonical records already contained previously approved Outboard values:
   Calypso 30, Calypso 35, Catalina 30 and Catalina 34. Regeneration now displays
   those existing facts. These were the only model pages with changed visible
   text in comparison with the Phase 1 artifact. No new research or fact edits
   were made.

The existing robots `/data/` exclusion already covers the new generated paths;
the compatibility exclusion remains. Repository Cloudflare raw-data documentation
also covers `/data/*`. No live edge policy, routing or API deployment was changed.

## Verification

Full `npm run verify:production` passed locally using Node 24.18.0 and Python
3.14.6, with the historical Git revisions available. Hosted Node 22/Python 3.12
workflows were updated but not dispatched.

- Canonical migration/partition checks: all values and ownership preserved,
  deterministic routing, size guards, focused writes and recovery.
- Integration/filter/configuration/community-overlay suites unchanged and passing.
- Phase 3: 103 audit cases plus 24 safeguards; 14,925 evaluations.
- Phase 4: 34 scoring safeguards; 14,925 historical-comparison assessments with
  identical candidate membership.
- Authenticated local administration: corrections, promotion, legacy snapshot
  import, restart persistence, pending identities and source exclusions.
- All 995 page-generation/permalink checks and built-file deployment assertions.
- Release readiness: 995 knowledge displays, comparison checks, contribution
  catalogue records and image fallback checks; existing additional filter cases.
- Actual Worker handler against isolated SQLite/in-memory attachments: submission,
  duplicate protection, authentication, correction publication, overlays, backup
  integrity and public browser API client; zero live writes.
- Baseline and secret guards.
- New artifact suite: deep reconstruction, hashes/counts/routing/size limits,
  oversize-record and corruption rejection, unchanged source files, unlisted
  source exclusion, missing/stale local monolith independence, fixed-clock repeated
  builds, stale checked-in page independence, fresh SEO after a canonical edit,
  sitemap/permalink identities, and preservation of previous output on missing
  inputs, incomplete canonical writes and an injected publication-rename failure.
- Fresh-source `check:canonical` works without creating a local model cache.
- Installed Edge desktop (1440x1000) and mobile viewport (390x844) Phase 4 browser
  acceptance: ranking, guide/comparison agreement, saved-order reload, legacy and
  hidden preferences, unknown must-haves and variable engines.
- Phase 3 browser acceptance in both viewports: catalogue 995; live/saved/combined
  results 691/63/716; saved reload and hidden requirements.

Browser checks used a frozen copy of the generated artifact; external requests
and production writes were blocked. Physical phones, Safari, production CDN
performance/cache headers and hosted CI are outside this local verification.
Timing changes were not evaluated as performance improvements.

The first new canonical-link assertion exposed the old href-rewrite bug; it was
fixed before the successful artifact and browser acceptance runs. Raw logs,
frozen Phase 1/2 artifacts and screenshots live in ignored `.bscout-data/phase2/`.
They are review evidence, not a substitute for the owner's retained backup.

## Reproducibility, recovery and rollback

Set `SOURCE_DATE_EPOCH` to the same Unix timestamp to reproduce build and sitemap
dates with fixed source inputs. Tests compare every output file hash across two
such builds. Text is normalized to LF to avoid Windows checkout newline drift.
The failed staging and injected replacement tests verify the old artifact remains
intact. If both replacement and restoration fail, the implementation retains the
previous artifact under the reported temporary work path instead of deleting it.

For local source rollback, stop writers and preserve any later user/source edits
and the artifact you may need. With a clean tracked working tree:

```powershell
if (Test-Path -LiteralPath '.\boatmodels.json') {
  Move-Item -LiteralPath '.\boatmodels.json' -Destination '.\.bscout-data\phase2\compatibility-cache.before-rollback.json'
}
git switch --detach fe194dac8e059710d383c6673b8fd9f58c1427f6
npm run verify:production
```

The move protects the ignored cache before the older tracked file is restored;
do not overwrite a prior saved copy. The Phase 2 branch remains recoverable by
switching back to `dev/generated-public-artifacts`. Canonical write-journal recovery
remains `--recover-before` or `--recover-after` as documented in the source README.
No production rollback is necessary because nothing was released. Do not restore
D1 or erase later community submissions to roll back a static build.

Phase 3 should migrate all consumers to one release-aware repository while
preserving complete-record behavior first. The deployed compatibility endpoint
must remain until those consumers and any external compatibility requirements
have been explicitly addressed. No Phase 3 implementation is included here.
