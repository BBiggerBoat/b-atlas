'use strict';
const assert = require('node:assert/strict');

// A host alone is insufficient: a broker's model guide is acceptable, its vessel listings are not.
function isModelReference(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'hmy.com') return /^\/yachting\/powerboat-guide\/[^/]+\/[^/]+\/?$/.test(url.pathname);
  if (host === 'commanderclub.com') return /^\/models-by-id\/[a-f0-9-]+\/?$/.test(url.pathname);
  if (host === 'formulaboats.com') return /^\/boats\/[^/]+\/?$/.test(url.pathname);
  if (host === 'beneteau.com') return /^\/antares\/[^/]+\/?$/.test(url.pathname);
  return false;
}

// Restore only explicitly reviewed scalar edits before the original snapshot checksum comparison.
// Everything else (including health, rights, model identities and ordering) remains protected.
function restoreReviewedImageChanges(registry, key, changes) {
  assert(['models', 'assets'].includes(key));
  const restored = structuredClone(registry);
  const seen = new Set();
  for (const change of changes) {
    assert(!seen.has(change.boatModelId), 'Duplicate reviewed model');
    seen.add(change.boatModelId);
    const rows = restored[key].filter(row => row.boatModelId === change.boatModelId);
    assert.equal(rows.length, 1, 'Reviewed model missing or duplicated: ' + change.boatModelId);
    const review = change.review;
    assert(isModelReference(review.sourcePageURL), 'Individual listings are not approved replacement sources');
    assert.equal(review.imageHTTP, 200);
    assert(review.contentType.startsWith('image/'));
    assert(/^[a-f0-9]{64}$/.test(review.sha256));
    assert.equal(review.dimensions.length, 2); assert(review.dimensions.every(n => Number.isInteger(n) && n > 0));
    assert(Number.isInteger(change.candidateIndex) && change.candidateIndex >= 0);
    const row = key === 'models' ? rows[0].candidates[change.candidateIndex] : rows[0];
    assert(row, 'Reviewed candidate missing');
    assert.equal(row.externalThumbnailURL, review.imageURL);
    assert.equal(row.sourcePageURL, review.sourcePageURL);
    if (key === 'assets') { assert.equal(row.status, 'external_reference'); assert.equal(row.publicUseEligible, false); }
    const fields = key === 'models' ? change.candidateFields : change.assetFields;
    assert(Object.keys(fields).length > 0);
    for (const [field, values] of Object.entries(fields)) {
      const allowed = ['externalThumbnailURL', 'sourcePageURL', 'sourceDomain'];
      if (key === 'assets') allowed.push('provenance.sourceURL', 'provenance.sourceName');
      assert(allowed.includes(field), 'Unapproved image field: ' + field);
      assert.equal(typeof values.before, 'string'); assert.equal(typeof values.after, 'string');
      const parts = field.split('.'), name = parts.pop();
      const target = parts.reduce((object, part) => object[part], row);
      assert.equal(target[name], values.after, 'Image differs from reviewed replacement: ' + change.boatModelId);
      target[name] = values.before;
    }
  }
  return restored;
}

module.exports = { isModelReference, restoreReviewedImageChanges };
