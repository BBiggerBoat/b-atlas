# Phase 2 public artifact pipeline

Build with `npm run build:public`. Python 3 and Node are required; CI uses Node 22
and Python 3.12. No package or service dependency was added. The complete release
gate is `npm run verify:production`; historical Git test commits must be available.

The builder validates and composes canonical owners once. That snapshot feeds the
image resolver, generated model endpoints and SEO page generator. It ignores the
optional root `boatmodels.json`, existing model/manufacturer/criteria/comparison
pages, checked-in sitemap and checked-in permalink output as build inputs, except
the generator's legacy-slug fallback for identities without a canonical slug.
All current identities have canonical slugs, which always take precedence.

Data and knowledge files use the explicit `publicFiles` allowlist. Static shell
files and retained asset directories use their separate manifest lists. Newly
added research files under data/knowledge are not automatically published.
Source exclusions are an additional validation boundary, not a copy-then-delete
publishing mechanism. Images, fallback registries, schemas and temporary moderator
assets retain their existing public availability and server-side authentication.

Generated outputs include:

- `boatmodels.json`: output-only full compatibility array for unchanged Phase 2
  clients, contribution/moderator flows and external consumers.
- `data/generated/models/manifest.json`: version 1 full-record shard contract.
- `data/generated/models/NNN-SHA256.json`: compact full-record JSON arrays, each at
  most 200,000 UTF-8 bytes. Concatenate shards in manifest order to preserve model
  order. No projection or evidence omission is performed.
- Model/manufacturer/criteria/comparison HTML, retired-route redirects,
  `data/model-permalinks.json` and `sitemap.xml`, regenerated from the snapshot.
- `public-build.json`: clock metadata, canonical digest and artifact inventory digest.

Manifest paths are relative to the public site root, not to the manifest directory.
`modelToShard` maps each exact case-sensitive ID to a zero-based `shards` index.
Each shard entry carries its path, SHA-256, byte size and record count. `release`
and `sourceDigest` identify the serialized ownership contract and composed model
snapshot. The compatibility entry includes its own hash, bytes and count. The
manifest itself must also fit 200,000 bytes. A record too large for one shard fails
the build rather than truncating a record. Hash names support future caching;
this phase does not change hosting cache headers or migrate browser consumers.

Set `SOURCE_DATE_EPOCH` to a fixed Unix timestamp for reproducible builds. It
controls the build timestamp and SEO dates. Text output is normalized to LF before
the artifact digest is calculated. `artifactDigest` covers sorted path/hash pairs
for every output except `public-build.json` itself. Source code and input data
must be fixed as well; reproducibility does not mean different tool versions or
different approved inputs are interchangeable.

Generation occurs in a unique workspace under `.bscout-data/`. Source pages and
the root application shell are not rewritten by the build. Only a complete,
validated staged site replaces local `dist/`. Staging errors preserve the previous
artifact. If replacement fails, the builder attempts to restore it. If restoration
also fails, it retains the previous artifact under the printed work path instead
of deleting it. This local directory replacement is not a deployment operation.

`npm start` retains the existing source-based local administrative server and its
dynamic local model cache; use a static server over `dist/` or the isolated preview
server for the complete generated release, including shard endpoints. Local HTTP
allowlisting now recognizes explicit and generated outputs while denying unlisted
data/knowledge files and canonical owners. Production API, D1 overlays, database
schema and live moderation are unchanged.

The former root monolith is untracked and ignored. Generated shards stay in the
ignored build output. Historical migration fixtures/archives and checked-in SEO
outputs remain for the later cleanup phase; builds no longer rely on those SEO
outputs for current model facts. Do not remove the deployed compatibility endpoint
until Phase 3 migrates every consumer and an explicit compatibility review permits it.

`tests/public-artifacts.cjs` verifies full reconstruction, hashes/counts/routing,
fixed-clock determinism, source isolation, canonical metadata, fresh SEO after a
canonical edit, unchanged source files and preservation of the last artifact on
build failure. It uses isolated fixtures, not production data or services.

Rollback: stop local writers, retain the current artifact and any new source edits,
then switch to the Phase 1 revision `fe194dac8e059710d383c6673b8fd9f58c1427f6`
and rebuild. Before switching, move the ignored root compatibility cache into
`.bscout-data/` so the older tracked file can be restored without an untracked-file
collision. Do not roll back D1 merely to roll back the static build. Production
promotion and retaining prior release shards are separate later release steps.
