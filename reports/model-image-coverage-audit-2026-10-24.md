# B-Atlas image audit — current branch status, 2026-10-24

## Current result

**62 failed image candidates repaired; 26 failures remain.** Added a model-specific Mainship 34 III photograph, reducing models with no registered photo from three to **two**: Oceania 36 Sedan and Krogen 44 AE.

All changes are on `audit/model-image-coverage-20261024`. PR #19 was merged before the follow-up work; these changes are not part of that merge. No new PR, merge or deployment was performed.

| Measure | Before this follow-up (`06a46786`) | Current |
|---|---:|---:|
| Canonical models | 1,002 | 1,002 |
| Canonical models with local photograph entries | 233 | 233 |
| Canonical models with external references | 775 | 776 |
| Overlap of local/external | 9 | 9 |
| Models without a registered photograph | 3 | 2 |
| External candidate URLs (includes orphan entries) | 786 | 787 |
| Live healthy candidates | 698 | 761 |
| Live failed candidates | 88 | 26 |
| Missing registered canonical local files | 0 | 0 |

Registered coverage, live reachability, correct model identity, and reuse permission are separate measures. A model can have a registered URL that currently fails. These counts do not claim that every model has a working, fully verified photo.

## Source policy

The owner clarified that **model guides are acceptable; individual vessel listings should be excluded where possible**. All 62 replacements and the new Mainship reference use model guides or manufacturer model pages. No new vessel-listing source was added.

HMY's model-guide URLs are not tied to a particular vessel sale. They remain external dependencies and can change. Temporary marketplace redirects to unrelated boats were rejected even when HTTP 200 was returned. Existing unresolved listing references remain flagged for migration; this batch does not silently delete the catalogue's other references.

The photographs remain remote. Downloaded files were temporary review artifacts only. `publicUseEligible` remains false and no reuse permission is claimed. Existing candidate health metadata was not rewritten with `--write`.

## Completed repairs

- **52 HMY references:** 22 Sea Ray, 12 Hatteras, 15 Bayliner and three Silverton candidates. Recovered actual photo URLs from their model-guide pages and checked names, generation dates, photographs and image responses. Silverton source-page slugs were corrected to the canonical production periods.
- **Three Formula references:** replaced obsolete URLs with photographs from the manufacturer's current 310 Sun Sport, 380 Super Sport Crossover and 387 Center Console Sport model pages.
- **Seven Chris-Craft references:** used the Commander Club's model-specific pages for 31 Express, 31 Sports Express/Sports Cruiser, 31 Sedan, 38 Express, 38 Sedan, 38 Sport Fisherman and 421 Commander. The source names, configurations and production spans agree with the canonical identities. The club's 31 Express year field has a visible `1666` typo; its serial-number table starts in 1966 and supports the canonical span. No canonical specifications were changed.
- **Mainship 34 MKIII:** added the HMY 34 III (1983–88) photo after visual review. The earlier Mainship 34 diesel cruiser is a different generation and was not substituted.

[The remediation ledger](model-image-remediation-2026-10-24.json) records exact before/after field edits, source titles, image URLs, decoded dimensions, SHA-256 hashes and review limits. [The additions evidence](model-image-sources-2026-10-24.json) covers the twelve added references across both follow-up sessions. All 62 repaired candidates and the new Mainship reference pass the latest live check.

The reviewed photographs are visually consistent with their source model labels and layouts; this is not independent hull identification. Combined-model guides remain representative family imagery rather than proof of an exact renamed variant.

## Remaining work

The [live health report](model-image-health-2026-10-24.json) records all **26 remaining failed candidates**: 23 HTTP 404s, one HTTP 403, and two transport errors.

| Source | Remaining failed candidates | Review outcome |
|---|---:|---|
| boats.com | 11 | Stale vessel listings or redirects to unrelated boats; no listing replacements added |
| BoatsOnline | 2 | Original vessel photos unavailable; no verified model-guide replacement |
| Alexander Marine USA | 1 | Vessel listing blocked with HTTP 403; model guide found but no model photo |
| HMY | 4 | Three model guides have no model photo; the Chris-Craft 36 Tournament Fisherman source is absent |
| Jeanneau | 3 | Incorrect numeric URLs redirect to other boats/ranges; archived pages lack usable verified exterior photos |
| Fjord | 3 | Old model pages absent; history page supplies no verified model-specific replacement |
| Carver | 2 | Manufacturer access fails; corresponding model guides have no model photo |

The remediation ledger includes a per-model outcome for all 26. Hero banners, nearby inventory recommendations, wrong generations and different drivetrain variants were rejected. HTTP 403/transport failures are observations, not definitive permanent-failure claims.

Two models still have no registered photo:

- **`OCEA-36-SE` — Oceania 36 Sedan:** existing evidence points to Ocean Alexander, but the canonical model character explicitly identifies a separate Oceania Yachts boat. Do not substitute an Ocean Alexander photograph.
- **`KDKR-44-AE` — Krogen 44 AE:** the recorded manufacturer site/history URL returns HTTP 410. No AE-specific photograph was independently established; do not substitute a generic Krogen 44.

Existing cross-model duplicate flags still need review: Four Winns 315/325 Express, Pursuit OS375/OS385, and Cobalt A36/A36BR. The repaired `SRAY-340-SD-G3` also shares the correct 2003–08 photo with `SEAR-340-SU-03`, reflecting overlapping canonical identities rather than evidence for two different hull generations. Identity reconciliation is separate from changing the photograph.

The bulk of existing healthy photographs has not received a complete visual/rights audit. Seventy-four image records have source/visual evidence across these two follow-up sessions (twelve additions and 62 repairs), including a shared Sea Ray photograph; this is not 74 independently identified vessels.

## Validation and safeguards

- `node tools/audit-model-image-coverage.cjs`: current counts above, no missing registered canonical local files.
- `node tools/audit-model-image-coverage.cjs --strict`: intentionally exits 1 while two photo gaps and existing orphan IDs remain.
- `NODE_USE_ENV_PROXY=1 npm run check:image-health -- --report /tmp/b-atlas-repair/health-after.json`: all 787 candidates tested, **761 healthy / 26 failed**. Eight workers, 15-second per-candidate budget, HEAD/GET fallback and image content-type checks.
- `npm run test:image-health`: request/fallback/error tests plus source-policy and reviewed-edit isolation tests pass. These reject individual vessel listings, lookalike hosts, unreviewed URL mutations and attempts to change health fields through the repair ledger.
- `npm run verify:production`: canonical checks, regression suite, moderation and generated pages, public build, deployment artifact checks, production readiness/worker checks, baseline, secret and repository guards pass. These are local validation checks; no site was deployed.

Production validation reverses only the 62 explicitly reviewed scalar URL/source edits and removes only the twelve reviewed additions in memory. Both image registries must then match the original snapshot checksums. Rights, health, identities, order and unrelated historical research remain protected. A later unreviewed registry edit still fails validation.

Existing orphan IDs remain visible: local `BENE-34-ST`, `CHBB-34-TC`, `GRNL-33-HY`, `JEAU-NC1095`, `JEAU-NC895`; external/candidates `CHCR-55-CO`, `CHCR-60-CO`. Do not delete or reassign these without identity evidence.

## Historical baseline and environment

At `c840b5d6`, the executable audit reported 233 canonical local, 764 canonical external, nine overlapping and fourteen missing. The first report's 236/766 totals overstated registered photograph coverage. The first follow-up added eleven references, leaving three gaps; this follow-up adds Mainship and repairs 62 failed URLs.

The original apparent proxy failure came from the default command sandbox denying network sockets. Supported per-command network permission restored access through the unchanged proxy. No proxy bypass, TLS relaxation or security configuration changes were required.
