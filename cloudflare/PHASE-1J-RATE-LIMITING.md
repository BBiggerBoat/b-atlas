# B-Atlas Phase 1J — Extraction / Rate-Limit Protection

## Purpose

Phase 1J reduces bulk extraction, abusive request patterns and accidental excessive API traffic without interfering with normal B-Atlas browsing.

This is defense-in-depth. Any data delivered to a public browser can ultimately be copied; the goal is to make automated extraction and API abuse materially harder and more expensive while preserving normal user access.

## API controls

The production Worker now applies IP-scoped, route-specific limits using hashed client IP values stored in the existing D1 rate-event table.

Current limits:

- `GET /api/health`: 120 requests per 10 minutes per IP
- `GET /api/public/overlays`: 60 requests per 10 minutes per IP
- `GET /api/public/attachments/*`: 30 requests per 10 minutes per IP
- `POST /api/contributions`: 5 requests per 10 minutes per IP
- `POST /api/contributions`: 20 requests per 24 hours per IP
- authenticated `/api/admin/*`: 240 requests per 10 minutes per IP
- authenticated admin write operations: 60 requests per 10 minutes per IP

Rate-limited responses return HTTP 429 and a `Retry-After` header.

## Contribution write protection

Contribution writes are accepted only when the browser Origin is:

- `https://b-atlas.org`
- `https://www.b-atlas.org`

This is not treated as authentication; it is an additional abuse barrier on top of route limits and moderation.

## Raw static data

The public browser still requires the static baseline. Because browser-delivered data cannot be made secret, Phase 1J does not pretend that `boatmodels.json` is confidential.

Instead, `robots.txt` now asks compliant crawlers not to crawl raw baseline files:

- `/boatmodels.json`
- `/routes.json`
- `/baseline-version.json`
- `/data/`

Search engines can continue indexing the permanent model, manufacturer, criteria and comparison pages.

## Cloudflare edge protection

API protection in code does not rate-limit GitHub Pages static assets. Cloudflare edge rate-limit/WAF rules should be used for high-volume requests to raw JSON/static data if available on the active Cloudflare plan.

Recommended edge targets:

- `/boatmodels.json`
- `/data/*`
- repeated high-rate requests across `/models/*`

Do not challenge or rate-limit normal search-engine crawling of rendered model pages unless abusive behavior is observed.

## Monitoring

Unexpected 429 rates, unusual request spikes, or repeated access to raw JSON should be reviewed before tightening thresholds. Legitimate unknown users should not be blocked solely because information is incomplete.
