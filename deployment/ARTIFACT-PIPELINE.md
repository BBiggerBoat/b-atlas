# Public artifacts and shared runtime repository

Build with `npm run build:public` (Node and Python required). Outputs remain in
ignored `dist/`; canonical owners remain the only editable model authority.
The builder composes owners once and generates complete model records, supporting
catalogue datasets and SEO. It stages and validates the site before replacing
`dist/`, restoring the preceding artifact if replacement fails. Explicit allowlists
exclude canonical owners and research archives. Checked-in SEO and the ignored
root model cache are not model inputs.

## Generated contract

`data/generated/models/manifest.json` uses schema version 2,
`batlas-catalogue-release-v2`. Paths are relative to the public site root.

- `shards`: ordered, complete model arrays under `data/generated/models/`.
- `modelToShard`: exact model ID to zero-based shard index.
- `datasets`: source labels, counts and immutable descriptors for production
  phases, routes, aliases, registries, taxonomy, evidence, knowledge resources and
  published community datasets owned by the shared repository.
- `sourceDigest`: SHA-256 of serialized `{ownership,models}`.
- `release`: SHA-256 of serialized `{format,sourceDigest,baselineVersion,
  modelCount,shards,modelToShard,datasets}` in that property order. This identifies
  the whole catalogue, rather than only the models.
- `compatibility`: hash/bytes/count of generated `boatmodels.json`. Internal
  browser consumers no longer request it. Keep it for external compatibility
  until a separate consumer review authorizes removal.
- `retained`: verified immutable files needed by one preceding release. An
  unchanged current release preserves that same retained generation. These files
  do not change the current release identity. Corrupt previous files fail the
  build and preserve the previous artifact; investigate or build into a separate
  clean directory rather than trusting damaged retention inputs.

Each generated array and the manifest must fit 200,000 UTF-8 bytes. Descriptors
contain path, SHA-256, bytes and record count. Full records, evidence, confidence
and provenance survive unchanged. A single oversized row fails the build.
`data/generated/catalogue/` holds hashed auxiliary arrays. SEO, sitemap, permalinks
and the public-build inventory remain generated outputs.

## Runtime and refresh

`BScoutDataRepository.getRepository(fetchImpl)` shares one repository per transport
function. The default uses global fetch and captures the root script URL, including
when loaded from the moderator page beneath `/developer/`.

The reader verifies release identity, safe paths, hashes/bytes/counts, model
uniqueness and routing before exposing rows. At most four shard requests run
concurrently. Required requests time out after 30 seconds. A failed release load
retries once from a fresh manifest, carrying no partial rows into the retry.
Immutable shards use the browser cache; a whole-release retry reloads them to
recover from a damaged cache. Manifests bypass that cache. Rejected snapshots
are evicted so later requests can retry. HTTPS or localhost
is required for Web Crypto integrity verification.

One optional community overlay request follows static loading (five-second
timeout). Its absence preserves the complete static catalogue. Catalogue, guide,
cards, resources and contributions share effective rows, phase joins and
compatibility normalization within an epoch. Patches preserve original model IDs;
unique additions append once. Resource projection clones nested groups before
merging additions, preventing mutation and duplicates. No lazy detail hydration
or search-only projections are introduced in Phase 3.

`loadBaseline()` returns a deeply frozen raw snapshot for moderation duplicate
checks. `loadApplicationData()` returns the shared effective snapshot.
`getModel(id)` returns its complete effective row; `loadOverlay()` returns the same
epoch's optional overlay. `invalidate()` starts a new epoch on the next load.
Moderator queue refreshes and successful writes invalidate the repository.
Promotion fails before any write if a required baseline cannot be verified.
Reconciliation also fails if its published overlay is unavailable. Public pages
adopt a new release on reload. One prior manifest remains usable through retained
files; older missing shards trigger whole-release retry, never monolith fallback.

The local administration server generates the same pinned release into ignored
persistent storage at startup and after relevant canonical/dataset writes. It
publishes immutable files before atomically replacing its manifest. Old local
files remain in ignored storage; public build retention is bounded to one prior
release. Authentication and production API/D1 schemas are unchanged.

Images, localized labels, form schemas and other UI assets retain their established
loaders. They are outside the catalogue release identity. Phase 3 does not claim
an atomic version boundary for every static site asset or a changing live API.

## Validation and rollback

Run `npm run verify:production`. In restricted local workspaces set
`PHASE4_OUTPUT_DIR` to an absolute path inside `.bscout-data/phase3/scoring`.
Localhost moderation/browser checks may require host permission. Browser suites
are `tests/phase3-browser.cjs`, `tests/phase4-browser.cjs` and
`tests/shared-repository-browser.cjs`; point their public roots at `dist/` and
use the installed Playwright module. Browser fixtures block external writes.

The shared-repository regression compares the Phase 2 loader at `427c46d` with
995 models and 15 profiles, including full assessments, actions and result order.
It tests concurrent consumers, optional overlay timeouts, corrupt/missing shards,
invalid manifests/counts/routing, duplicate IDs, whole-release retry, recovery
after rejection and moderation write suppression. Artifact tests cover lossless
reconstruction, retention, determinism, SEO, source exclusion, oversize rejection
and failed-build restoration.

To roll back Phase 3, retain the current artifact/source edits and switch the
review branch to Phase 2 commit `427c46db78244b33d44d6f238ffe89c3b98eef44`, then
rebuild. Both versions retain the compatibility endpoint and canonical source
format. Deploy any previous complete artifact only through a separately authorized
release process; do not mix old scripts with new manifests. No database rollback
is needed. Main, deployment and production data remain untouched during local work.
