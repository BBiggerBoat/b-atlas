# B-Atlas Phase 1N — Disaster Recovery Runbook

## Recovery model

B-Atlas production consists of four independent layers:

1. **GitHub baseline** — static application and versioned boat dataset.
2. **Cloudflare D1** — moderation state, reviewed contributions, knowledge state, published overlay and canonical change history.
3. **Workers KV** — uploaded attachment binaries and metadata.
4. **Cloudflare edge configuration** — DNS proxying, Access protection, WAF/rate limiting and Bot Fight Mode.

A complete recovery requires restoring all four.

## Recovery priorities

### Priority 1 — public site

GitHub is the source of truth for the static baseline. Re-enable GitHub Pages from the `main` branch deployment workflow and verify:

- `https://b-atlas.org/`
- `https://b-atlas.org/models/`
- current baseline version

### Priority 2 — API Worker

Recreate/deploy `batlas-api` using the generated file:

`cloudflare/batlas-api-standalone.js`

Required bindings:

- D1 binding `BSCOUT_DB` → `batlas`
- KV binding `BSCOUT_FILES` → `batlas-files`
- secret `BSCOUT_ADMIN_TOKEN`

Required custom domain:

`api.b-atlas.org`

After deployment, verify:

`https://api.b-atlas.org/api/health`

The response must report `shared:true`, `adminConfigured:true`, `persistence:"D1+KV"`, and the expected build marker.

## D1 recovery

### Preferred path

Use Cloudflare D1 point-in-time recovery when available and when the target recovery time is known.

### Off-platform backup path

The moderator page's **Download full backup** produces `batlas-backup-v1` JSON containing:

- pending queue
- reviewed queue
- knowledge items/evidence
- resource review state
- published production overlay
- canonical change history
- attachment manifest
- SHA-256 integrity digest

Validate a downloaded backup with:

`node developer/validate-backup.js B-Atlas_Backup_<timestamp>.json`

Generate D1 restore SQL with:

`node developer/backup-to-d1-sql.js B-Atlas_Backup_<timestamp>.json B-Atlas_D1_Restore.sql`

Before executing restore SQL:

1. Create or identify the target D1 database.
2. Run `cloudflare/schema.sql`.
3. Confirm the target database is the intended recovery target.
4. Execute the generated SQL.
5. Do not restore `bscout_rate_events`; rate-limit history is disposable operational data.

After restore, run **Check baseline ↔ D1** in Contribution Review.

## KV attachment recovery

The JSON backup contains an attachment manifest but not attachment binary bytes.

For every manifest entry, attachment bytes can be retrieved while production is healthy through the authenticated admin endpoint:

`/api/admin/attachments/<attachmentRef>`

KV recovery therefore requires a separate copy of attachment binaries. If attachment volume becomes material, migrate attachment backup to R2 or an automated object-storage backup before relying on this prototype for irreplaceable files.

A missing attachment must not invalidate canonical model data. It should be treated as missing evidence/media.

## Edge recovery

The root GitHub Pages records must be **Proxied** through Cloudflare:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

`www.b-atlas.org` CNAME to `bbiggerboat.github.io` must also be proxied.

Recreate/verify:

- Cloudflare Access application protecting `b-atlas.org/developer/*`
- allow policy restricted to moderator email
- raw-data rate-limit rule for `/boatmodels.json` and `/data/*`
- Bot Fight Mode enabled
- `api.b-atlas.org` custom Worker domain

## Recovery verification checklist

A recovery is not complete until all of the following pass:

1. GitHub Deployment Guard — success.
2. B-Atlas External Security Test — success.
3. `/api/health` reports the expected Worker build.
4. Moderator Access login intercepts `/developer/*`.
5. Moderator token connects successfully.
6. **Check baseline ↔ D1** reports no structural conflicts.
7. Public model pages load.
8. An approved D1 overlay value appears in the interactive model guide.
9. At least one stored attachment can be retrieved if attachments exist.
10. Download a fresh full backup and validate it.

## Recovery objective

For the current prototype, the practical target is:

- **RPO:** most recent downloaded full backup or D1 point-in-time recovery point.
- **RTO:** same day, assuming GitHub and Cloudflare are available.

These are operational targets, not contractual guarantees.

## Routine backup schedule

Until automated off-platform backups are added:

- download a full authenticated backup after every material moderation/publishing session;
- keep at least one recent copy outside Cloudflare;
- validate important backups with `developer/validate-backup.js`;
- repeat the disaster-recovery verification after material architecture/security changes.
