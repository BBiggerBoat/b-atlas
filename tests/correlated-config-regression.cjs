// Run: node tests/correlated-config-regression.cjs [path/to/boatmodels.json]
// Uses the repository's current filter engine and value normalizer.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const sandbox = { console }; sandbox.window = sandbox; sandbox.globalThis = sandbox;
for (const name of ["valuenormalizer.js", "filterengine.js"])
  vm.runInNewContext(fs.readFileSync(path.join(root, name), "utf8"), sandbox, { filename: name });
const passes = (boat, profile) => sandbox.BScoutFilterEngine.evaluateBoat(boat, profile, [], {}).passes;
const correlated = {
  VerifiedConfigurationsComplete: true,
  VerifiedConfigurations: [
    { FuelCode: "fuel.gasoline", MechanicalPropulsionCode: "mechanical_propulsion.sterndrive", EngineCount: 2 },
    { FuelCode: "fuel.diesel", MechanicalPropulsionCode: "mechanical_propulsion.shaft", EngineCount: 1 }
  ]
};
const cases = [
  ["matching diesel shaft single", correlated, { fuels:["Diesel"], propulsion:["Shaft"], engineCounts:[1] }, true],
  ["impossible diesel sterndrive", correlated, { fuels:["Diesel"], propulsion:["Sterndrive"] }, false],
  ["impossible diesel twin", correlated, { fuels:["Diesel"], engineCounts:[2] }, false],
  ["incomplete retains", {...correlated, VerifiedConfigurationsComplete:false}, { fuels:["Diesel"], propulsion:["Sterndrive"] }, true],
  ["unknown row retains", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{FuelCode:"fuel.diesel"}]}, {fuels:["Diesel"],propulsion:["Shaft"]}, true],
  ["unknown fuel retains", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{FuelCode:"unknown"}]}, {fuels:["Diesel"]}, true],
  ["empty rows preserve legacy", {FuelCode:"fuel.gasoline",VerifiedConfigurations:[]}, {fuels:["Diesel"]}, false],
  ["legacy unknown retains", {}, {fuels:["Diesel"]}, true],
  ["legacy twin compatibility", {EngineCount:1}, {twinEngines:true}, false],
  ["V drive is shaft", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{MechanicalPropulsionCode:"mechanical_propulsion.shaft_v_drive"}]}, {propulsion:["Shaft"]}, true],
  ["IPS is pod", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{MechanicalPropulsionCode:"mechanical_propulsion.ips_pod"}]}, {propulsion:["Pod"]}, true],
  ["V drive not sterndrive", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{MechanicalPropulsionCode:"mechanical_propulsion.shaft_v_drive"}]}, {propulsion:["Sterndrive"]}, false],
  ["IPS not shaft", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{MechanicalPropulsionCode:"mechanical_propulsion.ips_pod"}]}, {propulsion:["Shaft"]}, false],
  ["unknown subtype retains", {VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{MechanicalPropulsionCode:"mechanical_propulsion.unknown"}]}, {propulsion:["Shaft"]}, true]
];
for (const [name, boat, profile, expected] of cases)
  assert.equal(passes(boat, profile), expected, name);
console.log("Correlated configuration tests:", cases.length, "passed");
if (process.argv[2]) {
  const boats = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  assert.ok(Array.isArray(boats), "model database must be an array");
  const legacy = boats.filter(b => !Array.isArray(b.VerifiedConfigurations) || !b.VerifiedConfigurations.length);
  console.log("Database models:", boats.length, "legacy models:", legacy.length);
  assert.equal(legacy.length, boats.length, "Review all verified configurations before enabling exclusion");
  const profiles = [{fuels:["Diesel"]},{fuels:["Gasoline"]},{propulsion:["Shaft"]},{engineCounts:[1]}];
  for (const b of boats) for (const p of profiles)
    assert.equal(typeof passes(b,p), "boolean", "Filter must return a boolean");
  console.log("Database engine evaluations:", boats.length * profiles.length, "passed");
}
