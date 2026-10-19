"use strict";
// Regenerate the identity registry from the authoritative canonical model records.
// Existing curated identity decisions are preserved verbatim.
const fs = require("node:fs");
const canonical = JSON.parse(fs.readFileSync("boatmodels.json", "utf8"));
const registryPath = "data/registry/boat-registry.json";
const existing = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const manufacturers = JSON.parse(fs.readFileSync("data/registry/manufacturers.json", "utf8"));
if (!Array.isArray(canonical) || !Array.isArray(existing) || !Array.isArray(manufacturers)) throw Error("Invalid registry inputs");
const normalize = x => String(x ?? "").trim().toLowerCase();
const byId = new Map();
for (const model of canonical) {
  const id = String(model?.BoatModelID ?? "").trim();
  if (!id || byId.has(id)) throw Error("Missing or duplicate canonical BoatModelID: " + id);
  byId.set(id, model);
}
const existingById = new Map();
for (const row of existing) {
  const id = String(row?.BoatModelID ?? "").trim();
  if (!id || existingById.has(id)) throw Error("Missing or duplicate registry BoatModelID: " + id);
  existingById.set(id, row);
}
const byManufacturer = new Map();
for (const m of manufacturers) {
  for (const key of [m.ManufacturerCode, m.CanonicalName, ...(m.LegacyManufacturerIDs || []), ...(m.Aliases || [])]) {
    if (!normalize(key)) continue;
    const k = normalize(key);
    if (byManufacturer.has(k) && byManufacturer.get(k) !== m.ManufacturerCode) {
      byManufacturer.set(k, null); // ambiguous: do not guess
    } else if (!byManufacturer.has(k)) byManufacturer.set(k, m.ManufacturerCode);
  }
}
const added = [];
const unresolved = [];
for (const [id, model] of byId) {
  if (existingById.has(id)) continue;
  const codeFromLegacy = byManufacturer.get(normalize(model.ManufacturerID));
  const codeFromName = byManufacturer.get(normalize(model.Manufacturer));
  const code = codeFromLegacy && codeFromName && codeFromLegacy !== codeFromName
    ? null : (codeFromLegacy || codeFromName || null);
  const row = {
    BoatModelID: id,
    IdentityStatus: "PendingReview",
    ManufacturerCode: code,
    CanonicalName: String(model.Nickname || [model.Manufacturer, model.Model, model.Variant].filter(Boolean).join(" ")).trim(),
    Model: String(model.Model ?? ""),
    Variant: String(model.Variant ?? ""),
    Aliases: [],
    Active: model.Active === true,
    RedirectTo: null,
    Notes: "Generated from canonical model; identity and manufacturer mapping require review."
  };
  added.push(row);
  if (!code) unresolved.push({ BoatModelID: id, ManufacturerID: model.ManufacturerID, Manufacturer: model.Manufacturer });
}
const result = [...existing, ...added].sort((a,b)=>String(a.BoatModelID).localeCompare(String(b.BoatModelID)));
const absent = existing.filter(row => !byId.has(row.BoatModelID)).map(row=>row.BoatModelID);
if (absent.length) throw Error("Registry contains IDs absent from canonical database; review before write: " + absent.slice(0,30).join(", "));
if (result.length !== canonical.length) throw Error("Reconciled registry count mismatch");
if (process.argv.includes("--check")) {
  const same = JSON.stringify(result) === JSON.stringify([...existing].sort((a,b)=>String(a.BoatModelID).localeCompare(String(b.BoatModelID)));
  console.log(JSON.stringify({ canonical: canonical.length, registered: existing.length, added: added.length, unresolvedManufacturer: unresolved.length, synchronized: same },null,2));
  if (!same) process.exitCode=1;
} else {
  fs.writeFileSync(registryPath, JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({ canonical: canonical.length, preserved: existing.length, added: added.length, unresolvedManufacturer: unresolved.length, unresolved },null,2));
}
