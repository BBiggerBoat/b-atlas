# B-Atlas image coverage audit — 2026-10-24

## Scope and refreshed baseline

Executed against PR #19 on `audit/model-image-coverage-20261024`, starting at `c840b5d6a97797bf08dc45b92cd8030c628c9420`. No merge or deployment. Counts refer to the 1,002 canonical model IDs, excluding orphaned registry entries.

The original report overstated coverage: the executable baseline returns **233 local**, **764 external**, **9 overlapping**, and **14 missing**, rather than 236/766. The earlier totals included noncanonical entries. The baseline's 775 candidate URLs included two orphaned model entries; these remain visible in the audit instead of being silently deleted.

## Remediation

Added **11 remote references** with precise source pages and candidate records. Temporary downloaded photographs were decoded and visually inspected alongside their source labels, production dates and layouts. The external-reference convention is preserved: photographs are not copied into the repository, reuse permission remains unverified, and `publicUseEligible` stays false. Source labels plus a visually consistent configuration do not independently identify a photographed hull.

| Model ID | Source and visual review |
|---|---|
| PRES-41-DC | HMY President 41 Double Cabin, 1982–87; traditional aft-cabin flybridge cruiser |
| PRES-42-TR | HMY President 42 Trawler, 2002–06; raised-pilothouse trawler, distinct from the 41 |
| OCAL-42-SE | HMY Ocean Alexander 42 Sedan, 1986–93; sedan flybridge configuration |
| DEFE-44-OC | HMY DeFever 44 Offshore Cruiser, 1981–2007; aft-cabin trawler configuration |
| MRTR-40-SU | HMY Marine Trader 40 Sundeck, 1983–2000; covered aft sundeck |
| CHBY-38-DC | HMY CHB 38 Double Cabin, 1978–85; double-cabin trawler configuration |
| KHAS-40-SU | HMY Kha Shing 40 Sundeck, 1980–88; covered aft sundeck |
| CRUY-3260 | HMY combined 3260/3270 Esprit guide, 1988–94; express photo, **Moderate** confidence because exact variant is unresolved |
| SEAR-340-SU-99 | HMY 1999–2002 guide; its own photo, distinct from the 2003–08 generation |
| SEAR-340-SU-03 | HMY 2003–08 guide; its own photo, distinct from the 1999–2002 generation |
| BENE-ANT-9-S2 | Current BENETEAU Antares 9 page, Series 2 profile/layout diagrams and exterior photo; avoid the earlier-generation heritage page |

[Source evidence](model-image-sources-2026-10-24.json) records exact page/image URLs, titles, decoded dimensions and SHA-256 hashes. The eleven downloaded files have distinct hashes. No licensing claim is made.

## Remaining coverage gaps

Final canonical counts: **233 local**, **775 external**, **9 overlapping**, **3 missing**. All registered canonical local files exist; the auditor now checks for missing files separately from registry status.

- `OCEA-36-SE`: the existing record's evidence links point to Ocean Alexander, while its corrected model character explicitly identifies a separate Oceania Yachts boat. Do not substitute an Ocean Alexander image.
- `MNSH-34-MK3`: the model-specific 1983 MarineSource page returns HTTP 200 but exposes a placeholder and recommendations for other models; these are unsuitable replacements. The HMY 1978–82 Mainship 34 guide covers an earlier generation.
- `KDKR-44-AE`: the recorded manufacturer history URL returns HTTP 410. No independently established AE-specific photograph was obtained; do not substitute a generic Krogen 44.

Retain placeholders for these three until model-correct imagery is established.

## Live URL health and existing review backlog

The checker now bounds each candidate to 15 seconds across HEAD and GET fallback, cancels unused response bodies, requires an image content type, and supports `--report PATH` for response details. Eight workers remain in use. A live success establishes reachability/content type, not model identity or licensing.

The baseline run tested all 775 candidates: **687 healthy, 88 failed**. The final run tested 786 candidates, including the eleven additions: **698 healthy, 88 failed**. See the checked summary and failures in [the live results](model-image-health-2026-10-24.json). No `--write` was used: existing health metadata remains `unknown`, avoiding wholesale tracking churn and permanent conclusions from one run.

The baseline failures comprise 85 HTTP 404s, one HTTP 403, and two transport errors. Failures by source: HMY 63, boats.com 11, Formula 3, Jeanneau 3, Fjord 3, boatsonline.com.au 2, Carver 2, Alexander Marine USA 1. Existing failed URLs remain unchanged: each replacement needs separate source/visual verification. HTTP 403 and transport errors can reflect access policy or temporary conditions.

Duplicate-URL screening found three cross-model groups requiring review:

- `FWIN-315-EX` / `FWIN-325-EX`: shared HMY combined-model guide photo.
- `PURS-OS375` / `PURS-OS385`: shared HMY combined-model guide photo.
- `COBA-A36` / `COBA-A36BR`: shared URL whose filename explicitly describes A36 BR; possible variant mismatch.

These are review flags, not proof of incorrect imagery. This session visually reviewed the eleven additions, not every existing photograph. A full catalogue visual/rights audit remains outstanding.

Existing orphan IDs remain reported: local `BENE-34-ST`, `CHBB-34-TC`, `GRNL-33-HY`, `JEAU-NC1095`, `JEAU-NC895`; external and candidates `CHCR-55-CO`, `CHCR-60-CO`. Identity reconciliation requires evidence before moving or deleting these records.

## Reproduction and validation

- `node tools/audit-model-image-coverage.cjs`: final counts above, no missing canonical local files. `--strict` intentionally exits 1 while the three gaps and orphan records remain.
- `NODE_USE_ENV_PROXY=1 npm run check:image-health -- --report /tmp/b-atlas-image-health.json`: on this Node 24 executor, explicitly honors the inherited proxy. Run with the supported per-command network permission. Other Node runtimes must use their supported proxy configuration.
- `npm run test:image-health`: passes deterministic coverage of image responses, missing/non-image types, HEAD-to-GET fallback, shared timeout signal, body cleanup and transport errors.
- `npm run verify:production`: passes the canonical checks, test suite, moderation/page checks, public build, deployment artifact validation, production readiness/worker checks, baseline/secret/repository guards. These are local production validation checks, not a deployment or live-site test.

## Corrected environment diagnosis

The default command sandbox denied network sockets (`Operation not permitted`), which surfaced in curl as failure to connect to `proxy:8080`. With supported per-command network permission, the unchanged proxy returned GitHub HTTP 200 and cloning succeeded. The proxy was not shown to be down; the earlier PR blocker comment's root-cause attribution was incorrect. No proxy bypass, TLS relaxation, credential exposure or security configuration changes were needed.

The historical research checksum guard explicitly permits only the eleven reviewed image additions and verifies their source URLs and external-reference status. After removing those additions in memory, both image registries must still match the original snapshot checksums; all existing records remain protected.
