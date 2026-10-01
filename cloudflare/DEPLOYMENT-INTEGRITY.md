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


## Phase 1L — secrets and deployment security

Production secrets must remain only in Cloudflare secret storage. In particular:

- `BSCOUT_ADMIN_TOKEN` must never be committed to GitHub, written to `wrangler.jsonc`, or stored in a public build artifact.
- Local `.env*`, `.dev.vars*`, Wrangler state, private keys, and local B-Atlas runtime data are ignored by Git.
- GitHub Actions runs `developer/check-secrets.js` and fails on obvious committed secret material.
- `cloudflare/batlas-api-standalone.js` is generated from canonical source files. It must not be hand-edited.
- `npm run build:worker` regenerates the standalone Worker. CI fails if the committed artifact differs from the generated result.
- The Worker health endpoint exposes a non-secret build marker so the live manual deployment can be matched to GitHub source.
- GitHub Pages and the Cloudflare Worker remain separate deployment surfaces. A Worker code change is not production-complete until the live health endpoint reports the expected build marker.

Current production security build marker after Phase 1N: `2026-10-01-phase1n`.
