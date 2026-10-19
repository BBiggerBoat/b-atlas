"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
const boats = read("boatmodels.json");
const phases = read("data/production-phases.json");
const aliases = read("data/model-search-aliases.json");
const manufacturers = read("data/registry/manufacturers.json");
const registry = read("data/registry/boat-registry.json");
const endpoint = "https://api.b-atlas.org/api/public/overlays";

(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Origin: "https://b-atlas.org",
        Referer: "https://b-atlas.org/",
        "User-Agent": "Mozilla/5.0 B-Atlas-Canonical-Verification/1.0"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  if (!response.ok) {
    const cloudflareChallenge = response.status === 403 &&
      (/Just a moment/i.test(responseText) || /challenges\.cloudflare\.com/i.test(responseText));
    if (cloudflareChallenge) {
      console.log(JSON.stringify({
        status: "SKIP",
        endpoint,
        httpStatus: response.status,
        reason: "cloudflare-edge-challenge-blocks-github-runner"
      }, null, 2));
      return;
    }
    throw new Error(`Live community overlay returned HTTP ${response.status}: ${responseText.slice(0, 500).replace(/\\s+/g, " ")}`);
  }
  const overlay = JSON.parse(responseText);
  assert(overlay && typeof overlay === "object" && !Array.isArray(overlay), "Overlay must be an object");
  assert(overlay.modelPatches && typeof overlay.modelPatches === "object" && !Array.isArray(overlay.modelPatches), "modelPatches must be an object");
  assert(Array.isArray(overlay.addedModels), "addedModels must be an array");
  assert(Array.isArray(overlay.addedManufacturers), "addedManufacturers must be an array");

  const canonicalIds = new Set(boats.map(x => x.BoatModelID));
  const addedIds = overlay.addedModels.map(x => String(x?.BoatModelID || "").trim());
  assert(addedIds.every(Boolean), "Every live added model must have a BoatModelID");
  assert.equal(new Set(addedIds).size, addedIds.length, "Live addedModels contains duplicate BoatModelID values");
  assert(addedIds.every(id => !canonicalIds.has(id)), "Live addedModels collides with a canonical BoatModelID");

  const patchIds = Object.keys(overlay.modelPatches);
  assert(patchIds.every(Boolean), "Live modelPatches contains an empty BoatModelID key");
  assert(patchIds.every(id => canonicalIds.has(id) || addedIds.includes(id)), "Live modelPatches references an unknown BoatModelID");

  const localData = {
    "boatmodels.json": boats,
    "data/production-phases.json": phases,
    "data/model-search-aliases.json": aliases,
    "data/registry/manufacturers.json": manufacturers,
    "data/registry/boat-registry.json": registry
  };
  const fetchImpl = async url => {
    if (url === endpoint) return { ok: true, json: async () => overlay };
    return { ok: true, json: async () => localData[url] || [] };
  };

  const context = { fetch: fetchImpl, console };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync("datarepository.js", "utf8"), context, { filename: "datarepository.js" });
  const data = await context.BScoutDataRepository.loadApplicationData({ fetchImpl });

  const mergedIds = data.boats.map(x => x.BoatModelID);
  assert.equal(new Set(mergedIds).size, mergedIds.length, "Live overlay merge produced duplicate BoatModelID values");
  assert.equal(data.boats.length, boats.length + addedIds.length, "Live overlay merge produced an unexpected model count");
  for (const id of patchIds.filter(id => canonicalIds.has(id))) {
    assert(data.boats.some(x => x.BoatModelID === id), `Patched canonical model disappeared after live overlay merge: ${id}`);
  }

  console.log(JSON.stringify({
    status: "PASS",
    endpoint,
    canonicalModels: boats.length,
    modelPatches: patchIds.length,
    addedModels: addedIds.length,
    addedManufacturers: overlay.addedManufacturers.length,
    mergedModels: data.boats.length,
    updatedAt: overlay.updatedAt || null
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
