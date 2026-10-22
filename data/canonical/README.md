# Canonical source storage, version 1

`ownership.json` still assigns each field to one of identities, specifications,
guidance or provenance. `BoatModelID` is the shared join key. The domain paths now
name directories containing exactly 32 JSON arrays, `00.json` through `31.json`.
The four former domain-wide JSON files are retired. `index.json` records the
original, authoritative model sequence; bucket sorting never defines catalogue order.

Routing is the unsigned integer represented by the first eight hexadecimal digits
of SHA-256 of the exact UTF-8 BoatModelID, modulo 32. IDs and keys are case-sensitive.
Records within each bucket sort by ascending JavaScript string comparison of ID.
Do not normalize IDs, units, missing fields, nulls, booleans, arrays or source values.

Edit the registered field in its owner bucket, then run `npm run generate:models`
and `npm run check:canonical`. For additions or bulk edits, use the existing store
API: `load`, `split`, `compose`, `save`, `materialize`, `recover`, `contract`.
`save` routes every domain, updates model order, validates all prospective sizes
before writing, and leaves byte-identical files untouched. Do not add a model to
only one domain. In Phase 2, root `boatmodels.json` is an ignored, disposable local
compatibility cache. `npm test` generates it automatically; `npm start` materializes
it through the store. `check:canonical` validates owners and checks the local view
when present. `npm run build:public` does not read that cache: it composes owners
once and generates the public compatibility endpoint, small lossless shards and
SEO pages in staging. Public browser clients still use the compatibility endpoint
until Phase 3. See `deployment/ARTIFACT-PIPELINE.md` for the output contract.

Partitions warn above 150,000 UTF-8 bytes and fail above 200,000. Future overflow
requires an explicitly versioned routing contract: keep existing top-level buckets
and subdivide only the overflowing bucket using additional digest bits, with an
explicit subpartition manifest. The current loader deliberately does not accept
that future format. Never silently increase the modulus and rehash every record.

Before administrative writes, the store flushes a journal containing complete
before/after snapshots to `.bscout-data/canonical-write-journal.json`. Reads fail
closed while it exists. Atomic per-file replacement is not a multi-file transaction;
the journal is the recovery boundary. After inspecting the journal and stopping
writers, run either:

```
node developer/canonical-store.cjs --recover-before
node developer/canonical-store.cjs --recover-after
```

Both regenerate all affected partitions, model order and the compatibility view.
Existing monolithic persisted administrative snapshots and legacy before/after
journals remain accepted through the same model API. This synchronous store does
not add support for concurrent independent writer processes; serialize local
administration and maintenance operations.

Run `npm run verify:production` in a checkout with historical test commits available.
`tests/canonical-partitions.cjs` independently compares the complete composition
with the pre-partition Git revision, verifies routing and size limits, exercises
corruption rejection, checks focused-write stability, and injects partial-write
failures before recovering both sides. Public builds exclude this entire directory.
