"use strict";
/**
 * Read-only triage of provisional model identities.
 * No specifications are inferred, and no review status is changed.
 * Usage: node tools/audit-pending-identities.cjs
 */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const registry = JSON.parse(fs.readFileSync("data/registry/boat-registry.json", "utf8"));
const models = JSON.parse(fs.readFileSync("boatmodels.json", "utf8"));
const manufacturers = JSON.parse(fs.readFileSync("data/registry/manufacturers.json", "utf8"));
const evidence = JSON.parse(fs.readFileSync("knowledge/data/evidence.json", "utf8"));
const aliases = JSON.parse(fs.readFileSync("data/model-search-aliases.json", "utf8"));
const phases = JSON.parse(fs.readFileSync("data/production-phases.json", "utf8"));
const byId = new Map(models.map(row => [String(row.BoatModelID), row]));
const manufacturerCodes = new Set(manufacturers.map(row => String(row.ManufacturerCode)));
const pending = registry.filter(row => row.IdentityStatus === "PendingReview");
const evidenceById = new Map();
for (const entry of evidence) {
  const id = String(entry.BoatModelID || "");
  if (!id) continue;
  if (!evidenceById.has(id)) evidenceById.set(id, []);
  evidenceById.get(id).push(entry);
}
const aliasIds = new Set(aliases.map(row => String(row.BoatModelID)));
const phaseIds = new Set(phases.map(row => String(row.BoatModelID)));
const evidenceCoverage = {independentlySourced:0, legacyOnly:0, noIndexedEvidence:0, withAliases:0, withProductionPhases:0};
const issues = [];
const add = (row, kind, detail) => issues.push({BoatModelID:row.BoatModelID, kind, detail});
const clean = value => String(value ?? "").trim();
const byManufacturer = {};
for (const row of pending) {
  const id = clean(row.BoatModelID);
  const model = byId.get(id);
  const code = clean(row.ManufacturerCode);
  const sources = evidenceById.get(id) || [];
  // LegacyDataset bootstrap provenance explicitly says it does not verify facts.
  const independentSources = sources.filter(src => src.SourceType !== "LegacyDataset" && (clean(src.URL) || clean(src.Citation)));
  if (independentSources.length) evidenceCoverage.independentlySourced++;
  else if (sources.length) evidenceCoverage.legacyOnly++;
  else evidenceCoverage.noIndexedEvidence++;
  if (aliasIds.has(id)) evidenceCoverage.withAliases++;
  if (phaseIds.has(id)) evidenceCoverage.withProductionPhases++;
  byManufacturer[code || "(missing)"] = (byManufacturer[code || "(missing)"] || 0) + 1;
  if (!model) add(row, "missing_canonical_model", "Registry identity lacks a canonical model");
  if (!code) add(row, "missing_manufacturer_code", "Manufacturer code is absent");
  else if (!manufacturerCodes.has(code)) add(row, "unregistered_manufacturer_code", code);
  if (!clean(row.CanonicalName)) add(row, "missing_canonical_name", "Identity lacks a name");
  if (!clean(row.Model)) add(row, "missing_model_label", "Identity lacks a model label");
  if (model) {
    if (clean(model.CanonicalName) && clean(row.CanonicalName) && clean(model.CanonicalName) !== clean(row.CanonicalName))
      add(row, "name_difference", "Registry and canonical model names differ; review, do not auto-replace");
    if (clean(model.ManufacturerCode) && code && clean(model.ManufacturerCode) !== code)
      add(row, "manufacturer_code_difference", "Registry and canonical model codes differ; review, do not auto-replace");
  }
}
assert.equal(models.length, 995, "Canonical model baseline changed: re-evaluate audit assumptions");
assert.equal(pending.length + registry.filter(row => row.IdentityStatus !== "PendingReview").length, registry.length);
const issueCounts = {};
for (const issue of issues) issueCounts[issue.kind] = (issueCounts[issue.kind] || 0) + 1;
const report = {
  schema:"batlas-identity-review-triage-v2",
  canonicalModels:models.length,
  registryIdentities:registry.length,
  pendingReview:pending.length,
  pendingMeaning:"Administrative reconciliation only; does not invalidate existing research.",
  evidenceCoverage,
  evidenceNote:"Counts linked evidence entries, not verified specifications. LegacyDataset provenance alone is not independent verification.",
  pendingByManufacturer:Object.fromEntries(Object.entries(byManufacturer).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))),
  issueCounts,
  issues
};
console.log(JSON.stringify(report, null, 2));
