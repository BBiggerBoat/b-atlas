# B-Atlas v7.06.1 — Baseline Reconciliation Repair

Date: 2026-09-15

## Purpose
Repair regressions in the v7.06.0 clean-site package without changing the v7.05 canonical boat research baseline.

## Repairs
- Updated public version identifiers to v7.06.1.
- Updated all primary CSS/JavaScript cache-busting query strings to v7.06.1 so browsers do not continue serving older application code.
- Updated runtime app version to v7.06.1.
- Corrected runtime image resolution so a verified image-registry path or explicit model ImageURL is respected before a BoatModelID-derived filename is attempted.
- Reconciled image-registry status against files physically present in the package; 88 stale `missing` statuses were corrected to `available` where the requested file exists.
- Recovered Meridian 381 Sedan from the orphaned `images/Meridian 381 Sedan.jpg` asset and normalized it to `images/meri-381-se.jpg`.
- Recovered PDQ 34 PowerCat / Passagemaker from the orphaned `images/dqb-34-pa.jpg` asset and normalized it to `images/pdqb-34-pa.jpg`.
- Updated permanent/static model pages to display canonical displacement-cruise and faster/planing-cruise speed, fuel burn and derived fuel economy.
- Removed the internal exclusion-engine philosophy sentence from generated public page footers.
- Regenerated 259 model pages, manufacturer pages, constraint pages, comparison pages and sitemap.

## Validation
- 259 unique canonical models.
- 61/259 displacement-cruise speed/fuel-burn pairs retained.
- 52/259 faster/planing speed/fuel-burn pairs retained.
- Grand Banks 36 Classic static page verified at 36 ft 10 in LOA / 11.23 m, 12 ft 8 in beam / 3.86 m, and 7 kn / 10.22 L/h displacement cruise.
- 71 active JSON files parse successfully.
- Primary local JavaScript/CSS references resolve.
- 240/259 models now have an effective image available in this package.
- 19 model images still require recovery from an earlier archive; see `MISSING_IMAGE_RECOVERY_v7.06.1.txt`.

## Data policy
No canonical boat specifications or researched performance values were removed or replaced by this repair.
