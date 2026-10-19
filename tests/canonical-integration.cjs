"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vmFilter = require("node:vm");
const vm = require("node:vm");
const read = p => JSON.parse(fs.readFileSync(p,"utf8"));
const boats=read("boatmodels.json");
const registry=read("data/registry/boat-registry.json");
const phases=read("data/production-phases.json");
const aliases=read("data/model-search-aliases.json");
const ids=new Set(boats.map(x=>x.BoatModelID));
assert.equal(ids.size,boats.length,"Duplicate canonical IDs");
assert.equal(new Set(registry.map(x=>x.BoatModelID)).size,registry.length,"Duplicate registry IDs");
assert.equal(registry.length,boats.length,"Registry count differs from canonical");
assert(registry.every(x=>ids.has(x.BoatModelID)),"Registry references unknown model");
assert(boats.every(x=>registry.some(y=>y.BoatModelID===x.BoatModelID)),"Missing registry identity");
assert(phases.every(x=>ids.has(x.BoatModelID)),"Production phase references unknown model");
assert(aliases.every(x=>ids.has(x.BoatModelID)),"Alias references unknown model");
const dataByPath={
 "boatmodels.json":boats,
 "data/registry/boat-registry.json":registry,
 "data/production-phases.json":phases,
 "data/model-search-aliases.json":aliases
};
const context={fetch:async url=>({ok:true,json:async()=>dataByPath[url]||[]})};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync("datarepository.js","utf8"),context,{filename:"datarepository.js"});
(async()=>{
 const result=await context.BScoutDataRepository.loadApplicationData({fetchImpl:context.fetch});
 assert.equal(result.boats.length,boats.length,"Runtime model count changed");
 const expected=new Map();
 for(const p of phases)expected.set(p.BoatModelID,(expected.get(p.BoatModelID)||0)+1);
 for(const row of result.boats)assert.equal((row.ProductionPhases||[]).length,expected.get(row.BoatModelID)||0,"Incorrect phases for "+row.BoatModelID);
 const filterSandbox={console};
 filterSandbox.window=filterSandbox;
 filterSandbox.globalThis=filterSandbox;
 for(const file of ["valuenormalizer.js","filterengine.js"])vmFilter.runInNewContext(fs.readFileSync(file,"utf8"),filterSandbox,{filename:file});
 const profiles=[
  {fuels:["Diesel"]},{fuels:["Gasoline"]},{propulsion:["Shaft"]},
  {engineCounts:[1]},{fuels:["Diesel"],propulsion:["Shaft"]},
  {fuels:["Diesel"],engineCounts:[1]},{textSearch:"Mainship"}
 ];
 let evaluations=0;
 for(const boat of result.boats)for(const profile of profiles){
  const assessment=filterSandbox.BScoutFilterEngine.evaluateBoat(boat,profile,[],{});
  assert.equal(typeof assessment.passes,"boolean","Invalid filter result for "+boat.BoatModelID);
  evaluations++;
 }
 console.log(JSON.stringify({status:"PASS",models:boats.length,identities:registry.length,phases:phases.length,aliases:aliases.length,filterEvaluations:evaluations,unknownFuelRetained:result.boats.filter(x=>!x.FuelCode).length},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
