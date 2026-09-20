# B-Atlas deployment integrity

## Production source of truth

B-Atlas production data is:

**versioned static baseline + published D1 overlay**

The static baseline is versioned in GitHub. Community moderation state and approved production changes remain in Cloudflare D1. Uploaded attachment binaries remain in Workers KV.

## Baseline version

The release identity is recorded in both:

- `package.json` → `version`
- `baseline-version.json` → `baselineVersion`

These values must match. The home page must also expose the same version.

## Deployment guard

Run:

`npm run guard:baseline`

The guard fails when the baseline version metadata is inconsistent. GitHub Actions runs the same check on pull requests to `main` and on pushes to `main`.

A failed guard means the release should not be treated as a valid B-Atlas baseline.

## Release rule

When creating a new baseline release:

1. Update `package.json` version.
2. Update `baseline-version.json` baselineVersion.
3. Update the visible/cache-busting version references for the release.
4. Run `npm run guard:baseline`.
5. Merge only after the guard passes.
6. After production deployment, download an authenticated B-Atlas backup and confirm its `baselineVersion` matches the deployed baseline.

## Current deployment split

As of Phase 1D, the public static site is deployed from GitHub, while `api.b-atlas.org` is a separate Cloudflare Worker using D1 and KV. These are separate deployment surfaces and can diverge.

Until they are unified, a backend Worker change is not considered complete merely because GitHub `main` changed. The Cloudflare Worker must be deployed and its live endpoint verified separately.

The Worker should report the same baseline version in authenticated backups. Phase 1D records and guards this requirement; future deployment work can automate the Worker deployment.
