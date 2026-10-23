"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const baseBoats = [{
  BoatModelID: "BASE-1",
  ManufacturerID: "BASE",
  Manufacturer: "Base Marine",
  Model: "One",
  FuelCode: "Diesel"
}];
const baseManufacturers = [{
  ManufacturerCode: "BASE",
  CanonicalName: "Base Marine"
}];
const overlay = {
  modelPatches: {
    "BASE-1": { FuelCode: "Gasoline" }
  },
  addedModels: [
    {
      BoatModelID: "COMM-1",
      ManufacturerID: "COMM",
      Manufacturer: "Community Marine",
      Model: "One",
      FuelCode: "Diesel"
    },
    {
      BoatModelID: "BASE-1",
      ManufacturerID: "DUP",
      Manufacturer: "Duplicate",
      Model: "Should Not Append",
      FuelCode: "Diesel"
    }
  ],
  addedManufacturers: [
    { ManufacturerCode: "COMM", CanonicalName: "Community Marine" },
    { ManufacturerCode: "BASE-DUP", CanonicalName: "Base Marine" }
  ],
  reviewedContributions: [],
  knowledgeItems: [],
  knowledgeEvidence: [],
  resourceAdditions: [],
  updatedAt: "2026-10-19T00:00:00.000Z"
};

const fetch = async url => {
  if (url === "https://api.b-atlas.org/api/public/overlays") {
    return { ok: true, json: async () => overlay };
  }
  if (url === "boatmodels.json") {
    return { ok: true, json: async () => baseBoats };
  }
  if (url === "data/registry/manufacturers.json") {
    return { ok: true, json: async () => baseManufacturers };
  }
  return { ok: true, json: async () => [] };
};

const context = { ...require('./catalogue-fixture.cjs').contextGlobals, fetch, console };
context.window = context;
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("datarepository.js", "utf8"), context, { filename: "datarepository.js" });

(async () => {
  const fetchImpl=await require('./catalogue-fixture.cjs').releaseFetch(fetch);
  const data = await context.BScoutDataRepository.loadApplicationData({ fetchImpl });

  assert.equal(data.boats.length, 2, "duplicate overlay BoatModelID must not append");
  assert.equal(data.manufacturers.length, 2, "duplicate manufacturer canonical name must not append");

  const patched = data.boats.find(x => x.BoatModelID === "BASE-1");
  assert(patched, "patched canonical model missing");
  assert.equal(patched.FuelCode, "Gasoline", "community patch not applied");
  assert.equal(patched.NormalizedFuel, "Gasoline", "patched model did not receive compatibility normalization");

  const added = data.boats.find(x => x.BoatModelID === "COMM-1");
  assert(added, "community-added model missing");
  assert.equal(added.FuelCode, "Diesel");
  assert.equal(added.NormalizedFuel, "Diesel", "community-added model did not receive compatibility normalization");

  assert.deepEqual(JSON.parse(JSON.stringify(data.communityOverlay)), overlay, "overlay payload should remain available to callers");

  console.log(JSON.stringify({
    status: "PASS",
    canonicalModels: 1,
    overlayAddedModels: 1,
    overlayPatchedModels: 1,
    overlayAddedManufacturers: 1
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
