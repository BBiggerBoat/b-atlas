# Phase 4 — match scoring and candidate ranking

Development branch: `dev/phase4-match-ranking`, based on approved Phase 3 revision `5cd69e8f84c22c3e4448d1713b2a9995c71074bd`. No merge or deployment is authorized by this work.

## Implemented result

Phase 3 still decides which models remain candidates. Phase 4 orders those survivors; identical candidate membership is checked against the original Phase 3 engine across all 995 models and 15 search scenarios.

Search cards, comparisons and model guides now use one assessment. Match percentage describes known preferences; confidence describes the evidence and applicability behind them. General model guidance is explicitly labelled as knowledge, not buyer-match confidence. Missing preferences are neither matches nor compromises. No known preferences means “Not enough information”; no selected preferences means no manufactured percentage. Excluded comparison models show their exclusion instead of an overall score.

Important preferences receive three points, Preferred one. Hard requirements remain in the existing Requirements controls and do not earn suitability points. Saved High/Medium/Low preferences retain their soft meaning and 3/2/1 relative weights. Existing hidden requirements and preferences survive edits and reloads. Saved sorting is retained and applied for supported sort fields; unsupported saved keys are preserved without inventing their meaning.

The existing scorer was extended, not duplicated. Comparison placeholders and competing buyer-fit/confidence calculations were removed or redirected. Buyer verification actions remain connected to the shared assessment, with soft compromises distinguished from hard conflicts.

## Central policy and configuration treatment

`BScoutFilterEngine.SCORING_POLICY` centralizes the initial defaults. Match is matched known points divided by assessed known points. Confidence uses all selected preference points, including unknowns, with evidence support of 1 for explicitly verified applicable metadata, 0.5 for supported/normalized records, 0.25 for provisional records and 0 for unresolved or inapplicable evidence. Repeated source references do not add confidence. High begins at 80 and Medium at 50. These are policy weights, not statistical probabilities.

Unresolved must-haves, uncertainty recorded against required specifications, and material version applicability limit overall confidence to Low. Missing evidence cannot produce High confidence merely because other preferences match.

Default ordering is `50 + confidence × (match − 50)`, using confidence from 0 to 1. Unassessed candidates receive neutral ordering, without receiving a match percentage. Ties use confidence, search relevance and stable model identity. A buyer's explicit supported saved sort remains available as an ordering override; it never changes eligibility.

Each eligible production/configuration row is assessed independently. The default uses the most conservative confidence-adjusted result across applicable alternatives, with a score range and incomplete-information warning where needed. Unlinked phase and option facts remain unresolved. Engine-option warnings remain visible even when the model-wide count is absent. Evidence ratings for one value do not automatically certify a different option or phase. No missing package specifications were inferred from descriptive prose.

## Calibration using recorded models

Example buyer: diesel and under 40 feet are hard requirements. Single engine and wide side decks are Important; separate shower and aft cabin are Preferred. The following are actual calculations from existing records and metadata, not newly researched specifications:

| Default order | Model | Known-preference match | Evidence confidence | Reason |
|---|---|---:|---:|---|
| 1 | Grand Banks 32 Sedan | 75% | 25% / Low | Single engine and wide side decks match; recorded shower/cabin preferences do not. |
| 2 | Mainship 34T | 80% | 16% / Low | Wide decks and separate shower match, but model-wide engine count remains unknown because single and twin options exist. |
| 3 | Albin 25 Motor Cruiser | 50% | 28% / Low | Single engine and aft cabin match; recorded side decks and shower do not. |

Mainship's 80% does not earn first place: it describes fewer assessed preference points. Existing evidence is too limited for High confidence on these examples. This deliberately differs from the audit's illustrative confidence assumptions.

Other potentially surprising behavior is intentional: a completely unknown candidate can rank above a well-established poor soft match. It stays a research candidate, not a confirmed good match. Likewise, discovering reliable evidence of a compromise can lower its ranking even while increasing confidence. Barely satisfying a hard limit earns the same eligibility as comfortably satisfying it; additional preference rewards require an explicit buyer preference.

## Verification and safeguards

- Phase 3: 103 original audit cases plus 24 safeguards, 14,925 model/filter evaluations.
- Phase 4: 34 targeted scoring safeguards and 14,925 assessments across all 995 models and 15 search scenarios; identical Phase 3 candidate membership, deterministic ranking and unchanged input records.
- Coverage includes unknowns, known negatives with high confidence, thin-evidence 100% scores, conflicting preferences, option/year consistency, uncertain hard-field metadata, exact hard-limit boundaries, legacy searches, duplicate evidence, scoreless exclusions and next-action priorities.
- Full local release verification includes canonical ownership, all 995 pages and guide displays, 995 comparison checks, 24,875 additional filter evaluations, image fallbacks, isolated moderation/contribution submission, duplicate protection, authentication, publication, backup integrity and public-file exclusions.
- PASS: installed Edge desktop (1440x1000) and emulated mobile (390x844) workflows, including guide/comparison consistency, saved ordering, legacy profile edits, hidden requirements, unknown hard requirements and variable engine warnings. Browser acceptance results are recorded separately in `outputs/phase4-implementation/browser-results.json` and `phase3-browser/browser-results.json`. Physical phones and Safari are outside the tested browser coverage.

The browser tests found a legacy guide Back-button handler accessing a removed modal; it now safely checks for that element. Test setup failures caused by sandbox restrictions, an onboarding overlay, attempts to save an unchanged profile, and a stale build were corrected before final acceptance. They are not claims of application test passes.

## Remaining limits and production protection

Unknown and ambiguous canonical facts remain unchanged. The policy is calibrated through representative and edge-case tests, not through observed buyer purchase outcomes. Existing missing images and externally hosted image availability are not cured by ranking; image fallback behavior is verified. New scoring browser tests block external traffic and all writes; contribution tests use isolated local storage.

No canonical datasets, historical research, source evidence, live community contributions, worker/database schema, deployment workflow or production configuration were changed. Owner approval is required before any production release. The intended behavior has been verified in the built local application. There are no known deployment blockers. The update is ready for owner release approval, with physical-device/Safari coverage and initial policy calibration limits disclosed. No merge, push or deployment has been performed. Final browser outcomes and the exact development revision are recorded in the accompanying completion report and release receipt.
