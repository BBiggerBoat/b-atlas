# Frozen migration and regression references

These are immutable historical references, not editable model owners. The
manifest records each original path/commit, length and SHA-256. Deduplicated UTF-8
fragments in `parts/` are at most 150,000 bytes each. Each part has its own checksum.
Uniform CRLF originals share LF fragments with equivalent LF originals; the
`restoreLineEndings` descriptor reconstructs exact original bytes before checking
the complete checksum. Mixed line endings are stored unchanged. Git must preserve
part bytes (`.gitattributes` uses `-text`). Fragments may begin or end within a JSON
structure; use the verifying reader rather than interpreting a fragment alone.

Read with `require('./developer/historical-fixtures.cjs').read(name)` from the
repository root, or `.json(name)` for JSON. `node developer/historical-fixtures.cjs`
verifies all references. Tests check the original migration manifest's checksums.
Do not recreate expectations from current canonical data or edit fragments.

The entries preserve the original migration models/registry/knowledge cards,
pre-storage models/ownership, original release models, pre-ranking filter code,
pre-repository loader, Phase 3 benchmark code, 102 retired Phase 2 model/alias
aggregates, and the original protected-research file-set/checksum inventory.
Runtime public artifacts never include this archive. Existing evidence files,
production phases, aliases, resources and pending identity decisions remain in
their original authoritative locations.
