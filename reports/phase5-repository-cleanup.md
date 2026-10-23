# Phase 5: retire redundant tracked outputs

Implemented locally on October 23, 2026, on `codex/phase5-repository-cleanup`,
starting at accepted Phase 4 commit `0b6d1c7`. Main remains
`d082c427250cb0199039863335d4e82fbf483fe0`. No push, pull request, merge,
deployment, history rewrite, database migration or production write was performed.
The delivery receipt records the final review commit.

## Status and review boundary

Implementation and the full production verification suite pass. The read-only
local release preview is prepared; owner preview approval remains open before
calling the Phase 5 acceptance gate complete. This is not deployment approval.
The preview blocks external API connections and accepts only GET/HEAD requests.
The earlier Phase 4 owner acceptance of the roughly 0.2-second first-guide delay
is retained; this cleanup introduces no public-content change.

## Retired current-tree outputs

The root `boatmodels.json` was already untracked in Phase 2. It remains an ignored
compatibility cache, and the public build still generates the same 6,750,704-byte
compatibility output for external consumers. Internal startup uses the accepted
search/detail shards. This phase does not remove that public compatibility URL.

This phase removes 1,215 tracked files totaling 25,741,464 bytes:

| Category | Files | Treatment |
| --- | ---: | --- |
| Generated SEO, sitemap and permalink outputs | 1,106 | Build-owned in ignored `dist/` |
| Obsolete Phase 2 model/alias aggregates | 102 | Exact historical bytes retained in verified small archive pieces |
| Original migration archive monoliths/manifest | 4 | Same original bytes retained in verified small archive pieces |
| Oversized generated inventory/image reports | 3 | Retired from current source tree; prior commit and acknowledged backup retain originals |

`reports/phase5-retired-files.json` inventories each retired path, original byte
length and checksum. The Phase 2/3 research batches and evidence assertions remain
in place. The research inventory tool still resolves archived aggregates and finds
all 726 pending identities linked to research or evidence (568 have evidence
assertions; 1,906 assertions across 81 evidence files). Moving historical storage
confers no new factual approval on those identities.

The canonical owner partitions, field ownership, facts, provenance, identity
registry, production phases, aliases, curated resources, images and scoring code
are unchanged. No small source owner has been replaced by a new model monolith.
The local Node server falls back to generated `dist/` pages so removal of root SEO
copies does not turn local preview URLs into missing pages. Build before preview.
Standalone SEO generation now defaults to `dist/`, with isolated tests selecting
their own output directories explicitly. The `generate:search-pages` command
delegates to the complete public build so its artifact inventory stays valid.
The Cloudflare local-development command also builds first and serves `dist/`;
the Wrangler development process itself was not started in this assessment.

## Durable independent reference data

`archive/phase5-fixtures/manifest.json` records 122 frozen historical inputs and
source commits. They use 240 deduplicated UTF-8 fragments, each at most 150,000
bytes, totaling 20,424,083 bytes; the manifest is 102,366 bytes. Uniform CRLF
originals share LF fragments, then restore CRLF before the full original checksum
is checked. Mixed line endings remain unchanged. `.gitattributes` preserves exact
fragment bytes. Each fragment and the reconstructed original must pass SHA-256
and length checks. Damaged, missing or unsafe parts fail rather than supplying a
partial reference. These pieces are immutable archives, not editable model data;
a fragment may begin or end inside a JSON structure.

The references preserve original migration models/registry/knowledge cards,
pre-storage models/ownership, original release models, pre-ranking scoring code,
pre-repository loader, Phase 3 benchmark runtime and retired aggregates. Standard
release tests no longer fetch these large snapshots from historical Git objects.
The readiness audit replaces a Git diff with a frozen original file-set and
LF-normalized checksum comparison, still detecting both changed records and
added/removed research files. Expectations were captured independently from old
commits and originals, never regenerated from current owners. Git remains needed
for the proposed-tree size guard, not for historical blob access.

The archive occupies space: this is bounded-file storage and redundant-output
cleanup, not a claim that historical evidence costs nothing. Retired bytes exceed
the new archive bytes by about 5.2 MB before small documentation/tool changes.
The proposed Git tree contains 1,088 files versus 2,053 before cleanup. Summed
Git blob sizes fall from 116,680,816 bytes to about 111.9 MB (roughly 4.1%); small
final documentation edits can change that total. Raster images and historical
Git blobs remain, so clone/history reduction is not claimed. No Git history was rewritten. Existing backup copies were not altered.
Short-lived CI artifacts are not the only historical reference copy.

## Repository and connector budgets

`npm run guard:repository`, included in production verification and CI, checks the
proposed tree including new non-ignored files and staged removals. Text files have
a 150,000-byte warning and 200,000-byte failure ceiling. Generated/retired source
paths cannot be reintroduced as tracked files. Raster images under `images/` are
excluded from this text budget; SVG and other files remain checked.

Seven named exceptions retain exact current byte ceilings and written reasons in
`deployment/repository-size-policy.json`:

| Auxiliary owner | Bytes |
| --- | ---: |
| `data/imageassets-external.json` | 671,944 |
| `data/marketplace-source-validation.json` | 649,667 |
| `data/image-candidates.json` | 491,804 |
| `data/registry/boat-registry.json` | 416,474 |
| `knowledge/data/curatedresources.json` | 341,836 |
| `knowledge/data/knowledge-coverage.json` | 255,434 |
| `knowledge/data/relationships.json` | 220,853 |

They are separate existing owners/evidence inputs, not generated model-wide
views. Partitioning them safely needs consumer migrations beyond redundant-output
retirement. The guard rejects growth above these ceilings; they are not blanket
JSON exceptions. The two ordinary warning files are `knowledge/data/evidence.json`
(157,307 bytes) and `script.js` (153,413 bytes). Model owner partitions remain at
most 125,183 bytes; generated public arrays remain at most 200,000 bytes.

Direct GitHub connector reads on `main` returned nonempty content for:

- `data/phase2-batches/phase2-batch-82-pursuit-35-39.json`: 8,145 characters,
  Git blob `341dfae888a09f2abbb0b740cddab3ef9bcc50c0`.
- `knowledge/data/evidence/phase2-batch-68-wellcraft-45-50.json`: 2,867 characters,
  Git blob `44036a4ce0b52ebf8f4488d32c378b29aa6eac79`.

A direct read of the local-only canonical partition path on remote `main` returned
404, as that branch has not received these local migration commits. New partition
and archive reads through GitHub remain a post-publication check, not a claimed
remote pass. No push was made to obtain that evidence. The 200 KB cap is our
repository policy, not a documented universal connector limit. These successful
small-file reads do not establish that every larger exception will be readable
through every connector surface.

## Verification and release artifact

`npm run verify:production` passed, including original migration/ownership checks,
128 partition checks, 995 model equivalence, scoring/membership/actions, lazy
hydration and failure recovery, authenticated local administrative write/restart
and generated SEO serving, 995 generated canonical pages, public artifact hash and
retention checks, readiness, actual Worker with isolated SQLite, baseline version,
secret guard and the new source-size guard. Readiness covers 24,875 filter
evaluations, 995 knowledge displays/comparisons/contribution identities and 995
image fallback checks. Fixture corruption is rejected. Historical research file
sets and contents match the frozen baseline. All production write counts are zero.
The first restricted run could not start a local admin server; rerunning with
localhost access passed. This was a local test-environment restriction.

The rebuilt public artifact has content digest
`490446a7717b45d60e3563ecb0efe4d41a13a2445cf3732e779d26d8c06c7cfc`, identical
to accepted Phase 4. The digest covers every public file except the time-bearing
`public-build.json` marker. Source digest remains
`b43b66efaf67710892d459c5d28520f925fd689a7ee634dc1c4ab219188a3f83`; catalogue release
remains `1055f336fdf120f7c34f6e935185764a69affef6797f2e2f9467de9630f75b29`.
Thus the cleanup changes repository storage and local serving, not published site
content. Phase 4 timing measurements were not rerun for a byte-identical public
artifact. No new physical-device or Safari claims are made.

Desktop/mobile shared-repository, Phase 3 and Phase 4 browser workflows passed
against `dist/`. Earlier Phase 4 browser attempts timed out selecting the offscreen Separate
Shower control. Screenshot/DOM diagnostics confirmed an expanded panel with the
control below the visible area. The test now explicitly scrolls that control
into view before the same selection and assertions; both desktop and mobile
then passed. The delivery receipt records the evidence paths. No product behavior was changed to bypass that test. Browser evidence,
full validation log, preview URL and a versioned, checksum-inventoried public ZIP
are retained under ignored `.bscout-data/phase5/`.

## Migration, review and rollback

1. Review this local branch and the read-only preview. Record explicit preview
   acceptance before closing Phase 5; neither acceptance nor this branch is a
   merge/deployment instruction.
2. When publication is separately authorized, run the complete release gate from
   a clean Git checkout. Verify representative canonical partition and archive
   reads through GitHub after the branch is available remotely. Deploy only the
   validated complete `dist/` artifact, never the source checkout.
3. Retain the complete preceding public artifact, its manifest and immutable
   shards through release/rollback verification. Existing pages pin a release;
   do not mix a new manifest with old/missing files. This phase does not change
   immutable-file retention behavior or database state.
4. For source rollback, stop local writers, preserve any subsequent owner edits,
   switch to accepted Phase 4 commit `0b6d1c7` (or revert the cleanup commit in a
   later shared branch), and build a complete artifact. No database rollback is
   needed. Do not cherry-pick individual removed HTML/model files into a live
   release as a substitute for a complete rebuild.
5. Keep the acknowledged backup and versioned references. If historical Git size
   becomes a demonstrated problem, assess history rewriting as a separate task
   with backup and collaborator coordination.
