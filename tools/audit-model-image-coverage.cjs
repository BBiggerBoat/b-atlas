#!/usr/bin/env node
"use strict";
// Offline registry-coverage audit. Network URL health is handled separately by check-image-health.js.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const ids = read("data/canonical/index.json").modelOrder;
const local = read("data/imageassets.json").assets || [];
const external = read("data/imageassets-external.json").assets || [];
const candidateModels = read("data/image-candidates.json").models || [];
const models = new Set(ids);
const localAvailable = new Set(local.filter(a => a.status === "available" && a.path && a.path !== "images/boat-placeholder.svg").map(a => a.boatModelId));
const externalRegistered = new Set(external.filter(a => a.status === "external_reference" && (a.externalThumbnailURL || a.externalImageURL)).map(a => a.boatModelId));
const externalCandidateIds = new Set(candidateModels.filter(a => (a.candidates || []).length > 0).map(a => a.boatModelId));
const uncovered = ids.filter(id => !localAvailable.has(id) && !externalRegistered.has(id));
const counts = {healthy:0,failed:0,unknown:0,other:0};
let candidateURLs = 0;
for (const item of candidateModels) for (const candidate of item.candidates || []) {
  candidateURLs++;
  const status = candidate.health?.status || "unknown";
  if (Object.hasOwn(counts,status)) counts[status]++;
  else counts.other++;
}
const orphans = {
  local:local.filter(a => !models.has(a.boatModelId)).map(a => a.boatModelId),
  external:external.filter(a => !models.has(a.boatModelId)).map(a => a.boatModelId),
  candidates:candidateModels.filter(a => !models.has(a.boatModelId)).map(a => a.boatModelId)
};
const result = {
  catalogueModels:ids.length,
  localAvailable:ids.filter(id => localAvailable.has(id)).length,
  externalRegistered:ids.filter(id => externalRegistered.has(id)).length,
  withBoth:ids.filter(id => localAvailable.has(id) && externalRegistered.has(id)).length,
  withoutRegisteredPhotograph:uncovered.length,
  missingModelIDs:uncovered,
  candidateURLs,
  candidateHealth:counts,
  externalWithoutCandidate:ids.filter(id => externalRegistered.has(id) && !externalCandidateIds.has(id)),
  registryOrphans:orphans,
  note:"HTTP health metadata is not proof that a photo correctly depicts the model or is licensed for reuse. Run npm run check:image-health separately for live URL reachability."
};
console.log(JSON.stringify(result,null,2));
if (process.argv.includes("--strict") && (uncovered.length || Object.values(orphans).some(a => a.length))) process.exitCode=1;
