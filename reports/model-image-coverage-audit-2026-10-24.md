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


## Seven new Taiwanese-trawler image-source pages (candidate discovery only)

The following pages contain explicitly labeled model photographs and are suitable for **visual review of model identity**, but do not establish permission to copy images or long-term external availability. No image URL has been written into production registries.

| BoatModelID | Reference page | Published model years |
|---|---|---|
| PRES-41-DC | https://www.hmy.com/yachting/powerboat-guide/president/41-double-cabin-1982-87 | 1982–87 |
| PRES-42-TR | https://www.hmy.com/yachting/powerboat-guide/president/42-trawler-2002-06 | 2002–06 |
| OCAL-42-SE | https://www.hmy.com/yachting/powerboat-guide/ocean-alexander/42-sedan-1986-93 | 1986–93 |
| DEFE-44-OC | https://www.hmy.com/yachting/powerboat-guide/defever/44-offshore-cruiser-1981-2007 | 1981–2007 |
| MRTR-40-SU | https://www.hmy.com/yachting/powerboat-guide/marine-trader/40-sundeck-1983-2000 | 1983–2000 |
| CHBY-38-DC | https://www.hmy.com/yachting/powerboat-guide/chb/38-double-cabin-1978-85 | 1978–85 |
| KHAS-40-SU | https://www.hmy.com/yachting/powerboat-guide/kha-shing/40-sundeck-1980-88 | 1980–88 |

**Next integration boundary:** For each, inspect the page's specific image URL and verify that it genuinely depicts the named model, HTTP response/content type, availability/attribution and rights status. If B-Atlas's established external-reference policy permits linking rather than copying, register a model-specific external URL with its precise source page and transparent unverified status; retain a placeholder when no usable image can be established. Do not imply these are licensed photos.

**Image-health limitation:** GitHub connector analysis is read-only and does not execute Node in the repo. The existing checker must be run in the project checkout against all 775 external candidates, with timeout/rate limiting appropriate to remote hosts. Avoid automatically committing failures as definitive permanent broken links when bot protection or temporary failures are possible.
