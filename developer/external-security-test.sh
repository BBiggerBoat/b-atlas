#!/usr/bin/env bash
set -euo pipefail

SITE="https://b-atlas.org"
API="https://api.b-atlas.org"
BUILD="2026-10-01-phase1l"
BROWSER_UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
FAIL=0

pass(){ printf 'PASS  %s\n' "$1"; }
fail(){ printf 'FAIL  %s\n' "$1"; FAIL=1; }

status(){
  curl -sS --max-time 20 -A "$BROWSER_UA" -o /tmp/batlas-body "$@" -w '%{http_code}'
}

header_value(){
  local name="$1"; shift
  curl -sS --max-time 20 -A "$BROWSER_UA" -D - -o /dev/null "$@" | awk -v IGNORECASE=1 -v key="$name:" '$1==key {sub(/^[^:]+:[[:space:]]*/,""); gsub(/\r/,""); print; exit}'
}

printf 'B-Atlas external production security test\n'
printf 'Target: %s / %s\n\n' "$SITE" "$API"

# 1. Public site remains available.
code=$(status "$SITE/")
[[ "$code" == "200" ]] && pass "Public site returns 200" || fail "Public site expected 200, got $code"

# 2. Production API health and exact deployed build marker.
code=$(status "$API/api/health")
if [[ "$code" == "200" ]] && grep -q '"shared":true' /tmp/batlas-body && grep -q '"adminConfigured":true' /tmp/batlas-body && grep -q '"persistence":"D1+KV"' /tmp/batlas-body && grep -q "\"build\":\"$BUILD\"" /tmp/batlas-body; then
  pass "API health reports expected Phase 1L build and bindings"
else
  fail "API health/build marker mismatch (HTTP $code)"
  cat /tmp/batlas-body || true
fi

# 3. Public overlay is reachable, but hostile origins receive no browser CORS grant.
code=$(status -H 'Origin: https://example.invalid' "$API/api/public/overlays")
acao=$(header_value 'Access-Control-Allow-Origin' -H 'Origin: https://example.invalid' "$API/api/public/overlays" || true)
[[ "$code" == "200" ]] && pass "Public overlay remains reachable" || fail "Public overlay expected 200, got $code"
[[ -z "$acao" ]] && pass "Hostile origin receives no CORS allow-origin header" || fail "Unexpected hostile-origin CORS grant: $acao"

# 4. Allowed B-Atlas preflight works; hostile preflight is rejected.
code=$(status -X OPTIONS -H 'Origin: https://b-atlas.org' -H 'Access-Control-Request-Method: GET' "$API/api/public/overlays")
[[ "$code" == "204" ]] && pass "B-Atlas CORS preflight accepted" || fail "Expected B-Atlas preflight 204, got $code"
code=$(status -X OPTIONS -H 'Origin: https://example.invalid' -H 'Access-Control-Request-Method: GET' "$API/api/public/overlays")
[[ "$code" == "403" ]] && pass "Hostile CORS preflight rejected" || fail "Expected hostile preflight 403, got $code"

# 5. Admin API cannot be used without both trusted origin and bearer authentication.
code=$(status -H 'Origin: https://b-atlas.org' "$API/api/admin/snapshot")
[[ "$code" == "401" ]] && pass "Admin endpoint rejects missing bearer token" || fail "Expected admin missing-token 401, got $code"
code=$(status "$API/api/admin/snapshot")
[[ "$code" == "403" ]] && pass "Admin endpoint rejects missing trusted origin" || fail "Expected admin missing-origin 403, got $code"
code=$(status -H 'Origin: https://b-atlas.org' "$API/api/admin/backup?token=legacy-query-token")
[[ "$code" == "401" ]] && pass "Legacy query-string admin token is not accepted" || fail "Expected legacy query token 401, got $code"

# 6. Contribution writes from another site are rejected before accepting data.
payload='{"record":{"ContributionID":"CONTRIB-SECURITYTEST-0001","ContributionType":"other","AttachmentRefs":[]},"attachments":[]}'
code=$(status -X POST -H 'Origin: https://example.invalid' -H 'Content-Type: application/json' --data "$payload" "$API/api/contributions")
[[ "$code" == "403" ]] && pass "Cross-site contribution write rejected" || fail "Expected cross-site contribution 403, got $code"

# 7. Internal source/deployment files are not served by the public site.
for path in /cloudflare/batlas-api-standalone.js /package.json /server.js /moderatoraccess.js /developer/check-secrets.js; do
  code=$(status "$SITE$path")
  [[ "$code" == "404" ]] && pass "Internal file is not public: $path" || fail "Internal file $path expected 404, got $code"
done

# 8. Moderator UI must be intercepted by Cloudflare Access on the custom domain.
code=$(status "$SITE/developer/contribution-review.html")
if [[ "$code" == "301" || "$code" == "302" || "$code" == "303" || "$code" == "307" || "$code" == "308" || "$code" == "401" || "$code" == "403" ]]; then
  pass "Moderator UI is gated before page delivery (HTTP $code)"
else
  fail "Moderator UI should be gated, got HTTP $code"
  echo "Moderator response headers:"
  curl -sS --max-time 20 -A "$BROWSER_UA" -I "$SITE/developer/contribution-review.html" || true
  echo "DNS:"
  getent ahosts b-atlas.org || true
fi

# 9. The GitHub Pages hostname must not provide a direct unprotected moderator bypass.
code=$(status "https://bbiggerboat.github.io/b-atlas/developer/contribution-review.html")
if [[ "$code" == "301" || "$code" == "302" || "$code" == "303" || "$code" == "307" || "$code" == "308" || "$code" == "404" ]]; then
  pass "GitHub Pages hostname does not directly expose moderator UI (HTTP $code)"
else
  fail "Potential GitHub Pages moderator bypass: HTTP $code"
fi

# 10. Non-browser automation should be challenged by Bot Fight Mode on the API edge.
bot_code=$(curl -sS --max-time 20 -o /tmp/batlas-bot-body -w '%{http_code}' "$API/api/health" || true)
if [[ "$bot_code" == "403" ]] && grep -qi 'Just a moment' /tmp/batlas-bot-body; then
  pass "Bot Fight Mode challenges obvious automated API client"
else
  echo "INFO  Bot Fight Mode automation probe returned HTTP $bot_code"
fi

# 11. Crawler instructions discourage raw-data extraction.
code=$(status "$SITE/robots.txt")
if [[ "$code" == "200" ]] && grep -q 'Disallow: /boatmodels.json' /tmp/batlas-body && grep -q 'Disallow: /data/' /tmp/batlas-body; then
  pass "robots.txt discourages raw-data crawling"
else
  fail "robots.txt extraction guidance missing"
fi

printf '\n'
if [[ "$FAIL" -ne 0 ]]; then
  echo "B-Atlas external security test FAILED."
  exit 1
fi

echo "B-Atlas external security test PASSED."
