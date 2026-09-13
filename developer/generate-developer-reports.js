#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const write = (relative, value) => fs.writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`);
const generatedAt = new Date().toISOString();

const boats = read("boatmodels.json");
const manufacturers = read("data/registry/manufacturers.json");
const registry = read("data/registry/boat-registry.json");
const evidence = read("knowledge/data/evidence.json");
const contradictions = read("knowledge/data/contradictions.json");
const relationships = read("knowledge/data/relationships.json");
const coverage = read("knowledge/data/knowledge-coverage.json");

const duplicates = values => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())]
    .filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
const boatIds = new Set(boats.map(x => x.BoatModelID));
const registryIds = new Set(registry.map(x => x.BoatModelID));
const orphanRegistryIds = [...registryIds].filter(id => !boatIds.has(id));
const unregisteredBoatIds = [...boatIds].filter(id => !registryIds.has(id));
const aliasCount = registry.reduce((sum, x) => sum + (Array.isArray(x.Aliases) ? x.Aliases.length : 0), 0);

write("developer/data/boat-registry-validation.json", {
    schemaVersion: 3, generatedAt,
    status: orphanRegistryIds.length || unregisteredBoatIds.length ? "ReviewRequired" : "Passed",
    summary: { manufacturerCount: manufacturers.length, boatIdentityCount: registry.length, aliasCount,
        duplicateBoatModelIDs: duplicates(registry.map(x => x.BoatModelID)).length,
        unregisteredBoatModelIDs: unregisteredBoatIds.length, orphanRegistryIDs: orphanRegistryIds.length },
    issues: { unregisteredBoatIds, orphanRegistryIds },
    releaseGate: { approved: !orphanRegistryIds.length && !unregisteredBoatIds.length,
        message: !orphanRegistryIds.length && !unregisteredBoatIds.length ? "Runtime registry matches the canonical model database." : "Registry alignment requires review." }
});

const codeCollisions = duplicates(manufacturers.map(x => x.ManufacturerCode));
const invalidIds = registry.filter(x => !/^[A-Z0-9]{4}-[A-Z0-9-]+$/.test(x.BoatModelID)).map(x => x.BoatModelID);
write("developer/data/identity-code-audit.json", {
    schemaVersion: 2, generatedAt,
    reviewStatus: codeCollisions.length || invalidIds.length ? "ReviewRequired" : "Complete",
    summary: { manufacturerCount: manufacturers.length, boatIdentityCount: registry.length,
        manufacturerCodeCollisions: codeCollisions.length, invalidBoatModelIDs: invalidIds.length },
    collisions: codeCollisions, invalidBoatModelIDs: invalidIds,
    note: "Historical migration decisions are archived in developer/archive/identity-migration-archive.json."
});

const fields = ["NormalizedFuel", "NormalizedPropulsion", "NormalizedHullForm", "NormalizedHullConfiguration", "NormalizedStyle"];
const normalizedCoverage = Object.fromEntries(fields.map(field => [field, boats.filter(x => x[field] && x[field] !== "Unknown").length]));
const canonicalValueCounts = Object.fromEntries(fields.map(field => [field, boats.reduce((counts, boat) => {
    const value = boat[field] || "Unknown"; counts[value] = (counts[value] || 0) + 1; return counts;
}, {})]));
write("developer/data/taxonomy-validation.json", { schemaVersion: 2, generatedAt, boatCount: boats.length, normalizedCoverage, canonicalValueCounts });

const scores = coverage.map(x => Number(x.CoverageScore ?? x.coverageScore ?? 0)).filter(Number.isFinite);
const average = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
write("developer/data/knowledge-layer-summary.json", {
    schemaVersion: 3, generatedAt, boatCount: boats.length, canonicalModelFieldSource: "boatmodels.json",
    evidenceCount: evidence.length, contradictionCount: contradictions.length, relationshipCount: relationships.length,
    coverage: { records: coverage.length, average },
    policy: "Known undesirable information may eliminate. Unknown information remains eligible and reduces confidence."
});

console.log(`Generated 4 developer reports for ${boats.length} models.`);
