# B-Atlas image coverage audit — 2026-10-24

## Scope
Source-data audit of `main` at start of branch, 1,002 canonical models. This is **not** a live HTTP or visual-correctness test. Run `node tools/audit-model-image-coverage.cjs` to recalculate counts from current registries.

## Coverage
- 236 models have an `available` local-asset registry entry with a non-placeholder path.
- 766 have an `external_reference` registry entry with a URL.
- 9 overlap both groups.
- 14 models have neither of these registered photograph sources.
- 775 external candidate URLs have a stored health status of `unknown`. No successful live reachability claim can be made without executing the existing `npm run check:image-health` command.

## Missing registered photographs (14)
- `OCEA-36-SE` — Oceania 36 Sedan
- `MNSH-34-MK3` — Mainship 34 MK III
- `KDKR-44-AE` — Kadey-Krogen 44 AE
- `BENE-ANT-9-S2` — Beneteau Antares 9 Series 2
- `CRUY-3260` — Cruisers 3260
- `SEAR-340-SU-99` — Sea Ray 340 Sundancer (1999 generation)
- `SEAR-340-SU-03` — Sea Ray 340 Sundancer (2003 generation)
- `PRES-41-DC` — President 41 Double Cabin
- `PRES-42-TR` — President 42 Trawler
- `OCAL-42-SE` — Ocean Alexander 42 Sedan
- `DEFE-44-OC` — DeFever 44 Offshore Cruiser
- `MRTR-40-SU` — Marine Trader 40 Sundeck
- `CHBY-38-DC` — CHB 38 Double Cabin
- `KHAS-40-SU` — Kha Shing 40 Sundeck

## Resolution order
1. Select credible, **model-correct** source-page/photo candidates for these 14; verify name, hull/layout and production period, avoiding photos claimed as authorized where permissions are unknown.
2. Run `npm run check:image-health` to test external URL reachability. Do not run `--write` without assessing the volume of metadata churn; use `--write` only when refreshing the tracking registry is approved.
3. Review failed URLs and replace only when a valid alternate is independently verified.
4. Visually audit photos for mislabeled models, duplicates, cross-generational images, broken redirects, and rights/attribution; HTTP 200 alone is insufficient.
5. Re-run coverage audit, tests and production checks. No merge/deployment before owner approval.

### Reporting distinction
A working local path, an externally referenced URL, and a photograph verified as depicting the stated model are **different** milestones. Placeholder fallback guarantees a stable page, not photographic coverage.
