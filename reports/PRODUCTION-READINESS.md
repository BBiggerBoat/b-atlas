# Production-readiness verification — 20 October 2026

Scope: verify the completed architecture and correct deployment defects only. No model research, architecture redesign, production merge or production deployment.

## Verified locally

- Compared all 995 model records directly with the original Git commit, independently of the migration's archived copies. Every value is preserved except the five previously documented URL repairs. All IDs and active page addresses are unique; each model field has its declared owner.
- Confirmed historical research, identity decisions, resources, image records, production phases and search aliases remain unchanged.
- Ran 24,875 search/filter evaluations across 25 profiles, comparing results with the original records. All passed.
- Rendered knowledge displays, comparisons and image-failure fallbacks for all 995 models. Verified all 995 static pages, contribution-catalog entries, local dependencies and public-file exclusions.
- Ran the actual production contribution service against isolated SQLite tables using its production database schema: submission, duplicate protection, authentication, approval/publication, public overlays and backups passed. Local administration, recovery and restart tests passed.
- Browser-verified catalogue, comparison display, model guide and a synthetic contribution submission. Preview API calls were redirected to an isolated in-memory service. No contribution or notification was sent to production.
- Read-only production service health and public-overlay requests returned HTTP 200. Built and compared the generated API bundle; no unintended service-code change was needed.

## Failures corrected

1. Knowledge enrichment could overwrite stored strengths with empty legacy defaults. Adapted the existing flat model view correctly, preserving model character and owner guidance.
2. The guide overview treated an empty recommendation list as sufficient and hid documented strengths/cautions. Corrected the empty-list fallback.
3. Initial image failures in catalogue/comparison cards could remain broken. Corrected the first-error fallback and retained each model's identity while trying existing image candidates.
4. Static pages ignored the application's image choices and lacked reliable fallbacks. They now use the same image resolver and a real placeholder when an existing image fails.
5. Comparison cells exposed internal category codes. Converted those codes into readable labels.
6. One retired CHB model page still published obsolete specifications. Preserved its exact original page in `archive/retired-model-pages/` and replaced the public page with a redirect implementing the existing recorded consolidation decision. Generation now respects authoritative permanent URLs.
7. Added the full release test gate to development checks and the production build workflow, including the Git history needed for independent preservation checks.
8. Changed the versioned browser addresses for modified application scripts, so a fresh page does not reuse cached code expecting the removed knowledge-card file. Verified those addresses and all referenced files in the public build.

## Existing uncertainties retained

726 pending identities, 165 historical deadrise assertions outside the current schema, and existing classification/evidence warnings are unchanged. They are research limitations, not migration failures, and were not silently resolved.

The read-only image probe checked 752 unique external URLs used by 755 models: 658 returned image responses, 82 returned 404, four rejected/unsupported the probe, and eight timed out or failed at the network level. One existing local image path is missing. All 995 model fallbacks were tested; missing photos display a placeholder rather than a broken image. No replacement photographs or factual assumptions were introduced. Probe failures do not necessarily reproduce browser behavior.

## Release boundary

The complete local release gate passes. Publication of the development branch and hosted checks are being attempted through the connected GitHub API because the host's Git credential helper failed previously. Final hosted results and the release recommendation are recorded in the owner-facing report. Production remains untouched and requires the owner's explicit approval.
