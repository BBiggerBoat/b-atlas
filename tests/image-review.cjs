'use strict';
const assert = require('node:assert/strict');
const { isModelReference, restoreReviewedImageChanges } = require('../developer/image-review.cjs');
const ledger = require('../reports/model-image-remediation-2026-10-24.json').changes;
const candidates = require('../data/image-candidates.json');
const assets = require('../data/imageassets-external.json');

for (const url of [
  'https://www.hmy.com/yachting/powerboat-guide/mainship/34-iii-1983-88',
  'https://www.commanderclub.com/models-by-id/6dc4d762-f88b-4a6c-bd08-4459d32221a0',
  'https://www.formulaboats.com/boats/310-sun-sport/',
  'https://www.beneteau.com/antares/antares-9'
]) assert(isModelReference(url), url);
for (const url of [
  'https://www.hmy.com/yachts-for-sale/1983-mainship-34/',
  'https://www.boats.com/power-boats/2021-chaparral-307-ssx-9585330/',
  'https://www.hmy.com.example.org/yachting/powerboat-guide/mainship/34-iii-1983-88',
  'http://www.hmy.com/yachting/powerboat-guide/mainship/34-iii-1983-88',
  'invalid URL'
]) assert(!isModelReference(url), url);

for (const [registry, key] of [[candidates, 'models'], [assets, 'assets']]) {
  const original = JSON.stringify(registry);
  const restored = restoreReviewedImageChanges(registry, key, ledger);
  assert.equal(JSON.stringify(registry), original, 'Validation must not modify the registry');
  for (const change of ledger) {
    const model = restored[key].find(row => row.boatModelId === change.boatModelId);
    const row = key === 'models' ? model.candidates[change.candidateIndex] : model;
    assert.equal(row.externalThumbnailURL, change.candidateFields.externalThumbnailURL.before);
  }
  const altered = structuredClone(registry);
  const row = altered[key].find(row => row.boatModelId === ledger[0].boatModelId);
  (key === 'models' ? row.candidates[0] : row).externalThumbnailURL = 'https://example.org/unreviewed.jpg';
  assert.throws(() => restoreReviewedImageChanges(altered, key, ledger), /differs|reviewed/);
}
const invalid = structuredClone(ledger);
invalid[0].review.sourcePageURL = 'https://www.boats.com/power-boats/sold-vessel/';
assert.throws(() => restoreReviewedImageChanges(candidates, 'models', invalid), /listings/);
const unrelated = structuredClone(ledger);
unrelated[0].candidateFields['health.status'] = { before: 'unknown', after: 'healthy' };
assert.throws(() => restoreReviewedImageChanges(candidates, 'models', unrelated), /Unapproved image field/);
assert.throws(() => restoreReviewedImageChanges(candidates, 'models', [...ledger, ledger[0]]), /Duplicate reviewed model/);
console.log('PASS: model references accepted, listings rejected, reviewed edits isolated, unrelated fields protected.');
