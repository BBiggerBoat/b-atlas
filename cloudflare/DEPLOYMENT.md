# B-Atlas production deployment

## Current production architecture

B-Atlas uses two production deployment surfaces:

1. **Public site** — GitHub Pages built from the allowlisted `dist/` artifact by `.github/workflows/deploy-pages.yml`.
2. **API** — Cloudflare Worker `batlas-api` on `api.b-atlas.org`, backed by D1 and Workers KV.

The public site is proxied through Cloudflare so Access, WAF/rate limiting, and bot protections can operate at the edge.

## Cloudflare resources

Current production resources:

- Worker: `batlas-api`
- D1 database binding: `BSCOUT_DB` → `batlas`
- KV binding: `BSCOUT_FILES` → `batlas-files`
- Secret: `BSCOUT_ADMIN_TOKEN`
- Worker custom domain: `api.b-atlas.org`

The secret value must exist only in Cloudflare secret storage. Never commit it to GitHub.

## Worker deployment

The canonical Worker source is split across:

- `functions/_lib/bscout-store.js`
- `functions/api/[[path]].js`
- `cloudflare/worker.js`

Generate the standalone deployment artifact with:

`npm run build:worker`

This produces:

`cloudflare/batlas-api-standalone.js`

The generated file is the artifact used for the current manual Cloudflare Worker deployment. Do not hand-edit it.

After deploying, verify:

`https://api.b-atlas.org/api/health`

The response must report:

- `shared: true`
- `adminConfigured: true`
- `persistence: "D1+KV"`
- the expected current build marker

## Public-site deployment

GitHub Actions builds an allowlisted `dist/` directory and deploys that artifact to GitHub Pages.

The root and `www` DNS records must remain **Proxied** through Cloudflare. The GitHub Pages origin A records are:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

`www.b-atlas.org` points to `bbiggerboat.github.io`.

## Security configuration

Production also depends on these Cloudflare settings:

- Access application protecting `b-atlas.org/developer/*`
- moderator allow policy
- raw-data rate-limit rule covering `/boatmodels.json` and `/data/*`
- Bot Fight Mode enabled
- root and `www` DNS records proxied

## Production verification

A deployment is not complete until:

1. B-Atlas Deployment Guard passes.
2. B-Atlas External Security Test passes.
3. Public site loads through `https://b-atlas.org`.
4. Worker health reports the expected build.
5. Contribution Review is gated by Cloudflare Access.
6. Moderator connection succeeds.
7. **Check baseline ↔ D1** reports no structural conflicts.
8. A current full backup can be downloaded and validated.

## Recovery

See `cloudflare/DISASTER-RECOVERY.md` for D1, KV, Worker, GitHub Pages, DNS, and Access recovery procedures.
