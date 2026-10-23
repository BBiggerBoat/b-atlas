# Taiwanese trawler integration — PR #18

The seven staged candidates are implemented as seven canonical models, expanding
the catalogue from 995 to 1,002. The original 995 records and their order remain
unchanged. The staging research and checksum-protected historical fixtures remain
unchanged.

| Canonical ID | Model | Identity decision |
| --- | --- | --- |
| PRES-41-DC | President 41 Double Cabin | Separate 1982–1987 model |
| PRES-42-TR | President 42 Trawler | Separate 2002–2006 model |
| OCAL-42-SE | Ocean Alexander 42 Sedan | Separate from 39 Sedan and later 420/422 names |
| DEFE-44-OC | DeFever 44 Offshore Cruiser | Separate from existing 40, 43 and 45 models |
| MRTR-40-SU | Marine Trader 40 Sundeck | Separate marketed layout from 40 Double Cabin |
| CHBY-38-DC | CHB 38 Double Cabin | Separate marketed model from Marine Trader 38s |
| KHAS-40-SU | Kha Shing 40 Sundeck | One identity for Spindrift, Vista and Southern Star marketing aliases |

## Evidence and uncertainty

Canonical additions retain the staged representative dimensions, production years,
mass and tankage. Feet convert to metres by 0.3048, pounds to kilograms by
0.45359237, and staged US gallons to litres by 3.785411784. Original source values,
conversion notes, confidence and model-specific source URLs live in provenance.
Tankage follows the staging register's US-gallon interpretation, with individual
hull verification explicitly required.

CHB 38 and Marine Trader 40 Sundeck have documented single/twin variations, so
EngineCount remains null. No power or speed is generalized across engine options.
Ocean Alexander's modified-V source description is preserved as historical hull
form evidence; HullBehaviourCode remains null. Kha Shing's disputed fuel capacity
and all other staged null specifications remain null. No new route suitability,
offshore capability, air-draft estimate or precise production-yard claim is inferred.
New models use the existing image placeholder. The image resolver now honors an
explicit placeholder instead of attempting a nonexistent model JPG first.

The CHB 38 reference specifies a 13 ft 6 in beam and 3 ft 6 in draft, versus
12 ft 10 in and 4 ft for the Marine Trader 38 Double Cabin. Separate brand/model
identities are retained; no unverified mold relationship is introduced. The
existing Marine Trader 38 IDs and all original identity decisions are preserved.

## Storage and validation

All four owner domains and index were authored with canonical-store.save using
the existing SHA-256 routing, size validation and recovery journal. Seven buckets
per domain changed; ownership and partition architecture are unchanged. Identity,
manufacturer and search-alias registries include the additions. The existing
registry size exception is adjusted to its new byte size; partition limits are
unchanged.

Historical migration assertions still compare all original fields and sequence
against checksum-verified fixtures. A separate explicit seven-ID allowlist and
integration test validate the expansion, conversions, nulls, registry linkage,
alias deduplication and variable-engine filtering. Live catalogue assertions use
the release's expected count. Search/detail hydration checks include the additions.

Generated compatibility JSON, search/detail shards, SEO pages, permalinks and sitemap
remain ignored build outputs. Rebuild with `npm run verify:production`; publish
only through the existing release process after separate approval. This PR does
not merge or deploy.

## Verification results

`npm run verify:production` passed on the implementation. It checked all 1,002
model pages, knowledge displays, comparison records and contribution identities,
25,050 production filter evaluations, 128 canonical partitions, lossless and
deterministic public artifacts, failed-build recovery, authenticated local
moderation, an isolated SQLite-backed worker, historical integrity, secrets and
repository budgets. The largest canonical partition is 128,407 bytes, below the
150,000-byte warning threshold. Runtime image resolution has no missing local
paths; all 1,002 image fallback checks pass. No production writes occurred.
