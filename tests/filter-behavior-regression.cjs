"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
for (const file of ["valuenormalizer.js", "filterengine.js"]) {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

const evaluate = (boat, profile) =>
  sandbox.BScoutFilterEngine.evaluateBoat(boat, profile, [], {});

function expectPass(label, boat, profile) {
  const result = evaluate(boat, profile);
  assert.equal(result.passes, true, `${label}: expected pass, got ${result.reasons.join(", ")}`);
}

function expectFail(label, boat, profile, reason) {
  const result = evaluate(boat, profile);
  assert.equal(result.passes, false, `${label}: expected exclusion`);
  assert(result.reasons.includes(reason), `${label}: expected reason '${reason}', got ${result.reasons.join(", ")}`);
}

// Core B-Atlas rule: missing information must not eliminate a candidate.
expectPass("unknown fuel retained", { BoatModelID: "T-UNKNOWN-FUEL" }, { fuels: ["Diesel"] });
expectFail("known wrong fuel eliminated", { BoatModelID: "T-GAS", FuelCode: "Gasoline" }, { fuels: ["Diesel"] }, "fuel");
expectPass("known matching fuel retained", { BoatModelID: "T-DIESEL", FuelCode: "Diesel" }, { fuels: ["Diesel"] });

expectPass("unknown propulsion retained", { BoatModelID: "T-UNKNOWN-PROP" }, { propulsion: ["Shaft"] });
expectFail("known wrong propulsion eliminated", { BoatModelID: "T-OUTBOARD", MechanicalPropulsionCode: "Outboard" }, { propulsion: ["Shaft"] }, "propulsion");
expectPass("known matching propulsion retained", { BoatModelID: "T-SHAFT", MechanicalPropulsionCode: "Shaft" }, { propulsion: ["Shaft"] });

expectPass("unknown engine count retained", { BoatModelID: "T-UNKNOWN-COUNT" }, { engineCounts: [1] });
expectFail("known wrong engine count eliminated", { BoatModelID: "T-TWIN", EngineCount: 2 }, { engineCounts: [1] }, "engine-count");
expectPass("known matching engine count retained", { BoatModelID: "T-SINGLE", EngineCount: 1 }, { engineCounts: [1] });

expectPass("unknown style retained", { BoatModelID: "T-UNKNOWN-STYLE" }, { styles: ["Trawler"] });
expectFail("known wrong style eliminated", { BoatModelID: "T-EXPRESS", NormalizedStyle: "Express Cruiser" }, { styles: ["Trawler"] }, "style");

// Correlated configurations: only complete, wholly conflicting evidence may eliminate.
expectPass(
  "incomplete conflicting configuration retained",
  {
    BoatModelID: "T-INCOMPLETE-CONFIG",
    VerifiedConfigurations: [{ FuelCode: "Gasoline", MechanicalPropulsionCode: "Outboard", EngineCount: 2 }],
    VerifiedConfigurationsComplete: false
  },
  { fuels: ["Diesel"], propulsion: ["Shaft"], engineCounts: [1] }
);

expectFail(
  "complete conflicting configuration eliminated",
  {
    BoatModelID: "T-COMPLETE-CONFLICT",
    VerifiedConfigurations: [{ FuelCode: "Gasoline", MechanicalPropulsionCode: "Outboard", EngineCount: 2 }],
    VerifiedConfigurationsComplete: true
  },
  { fuels: ["Diesel"], propulsion: ["Shaft"], engineCounts: [1] },
  "verified-configuration"
);

expectPass(
  "complete configuration with unknown alternative retained",
  {
    BoatModelID: "T-COMPLETE-UNKNOWN",
    VerifiedConfigurations: [
      { FuelCode: "Gasoline", MechanicalPropulsionCode: "Outboard", EngineCount: 2 },
      { FuelCode: null, MechanicalPropulsionCode: null, EngineCount: null }
    ],
    VerifiedConfigurationsComplete: true
  },
  { fuels: ["Diesel"], propulsion: ["Shaft"], engineCounts: [1] }
);

expectPass(
  "complete configuration with matching alternative retained",
  {
    BoatModelID: "T-COMPLETE-MATCH",
    VerifiedConfigurations: [
      { FuelCode: "Gasoline", MechanicalPropulsionCode: "Outboard", EngineCount: 2 },
      { FuelCode: "Diesel", MechanicalPropulsionCode: "Shaft", EngineCount: 1 }
    ],
    VerifiedConfigurationsComplete: true
  },
  { fuels: ["Diesel"], propulsion: ["Shaft"], engineCounts: [1] }
);

console.log(JSON.stringify({
  status: "PASS",
  principle: "known-undesirable-eliminates-missing-retains",
  assertions: 15
}, null, 2));
