# B-Atlas Controlled API Architecture — Phase 1H

## Production split

B-Atlas uses two production surfaces:

- `https://b-atlas.org` — static public site deployed from the allowlisted GitHub Pages `dist/` build.
- `https://api.b-atlas.org` — Cloudflare Worker API backed by D1 and Workers KV.

The static site never writes directly to D1 or KV. All live shared-state access goes through the Worker API.

## Public browser contract

The public site loads `communityapi.js`, which exposes only:

- `GET /api/health`
- `GET /api/public/overlays`
- `POST /api/contributions`

The public client contains no moderator-token handling and no `/api/admin/*` methods.

## Moderator browser contract

The moderation page additionally loads `developer/moderatorapi.js`.

That file augments the public client with authenticated moderator operations:

- `GET /api/admin/snapshot`
- `PUT /api/admin/snapshot`
- `POST /api/admin/publish`
- `POST /api/admin/promote`
- `GET /api/admin/backup`
- `GET /api/admin/canonical-history`
- `POST /api/admin/canonical-history/:id/revert`
- `GET /api/admin/attachments/:id`

Moderator credentials are session-scoped in the browser and sent only in the Authorization header to `/api/admin/*`.

## Canonical-data control

Canonical public data is:

**GitHub static baseline + published D1 overlay**

Browser code cannot directly mutate either source.

Canonical corrections, model/manufacturer promotion, publishing and reverts are performed by the Worker after moderator authentication.

## Deployment guard

The GitHub deployment guard verifies:

- the public build contains `communityapi.js`;
- public `communityapi.js` contains no `/api/admin/` routes or token-management method;
- public `index.html` does not load `moderatorapi.js`;
- the moderation page does load `moderatorapi.js`;
- the moderator client contains the authenticated admin routes.

## Deferred to Phase 1I

Phase 1H establishes API separation. Authentication hardening remains Phase 1I, including review of:

- bearer-token lifecycle and rotation;
- removal of any legacy token-in-query support;
- protection of the moderation interface itself;
- additional authorization/session controls.
