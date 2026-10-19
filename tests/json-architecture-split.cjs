"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const original=JSON.parse(fs.readFileSync("boatmodels.json","utf8"));
const root="build/json-architecture-preview/";
const read=name=>JSON.parse(fs.readFileSync(root+name+".json","utf8"));
const spec=read("specifications"),knowledge=read("ownerKnowledge"),resources=read("resources"),media=read("media");
const context={};context.globalThis=context;
vm.runInNewContext(fs.readFileSync("datarepository.js","utf8"),context);
const loader=context.BScoutDataRepository;
const assembled=loader.assembleSplitModels(spec,knowledge,resources,media);
assert.equal(assembled.length,995);
for(let i=0;i<995;i++){
 assert.deepEqual(JSON.parse(JSON.stringify(assembled[i])),original[i],"Model differs "+original[i].BoatModelID);
}
const bad=knowledge.slice();bad[0]={...bad[0],BoatModelID:"NONEXISTENT"};
assert.throws(()=>loader.assembleSplitModels(spec,bad,resources,media),/identity/);
const duplicate=knowledge.slice();duplicate[0]={...duplicate[0],Overview:"Invalid",Model:"illegal duplicate ownership"};
assert.throws(()=>loader.assembleSplitModels(spec,duplicate,resources,media),/Duplicate field ownership/);
(async()=>{
 const paths={specifications:"split/specifications.json",ownerKnowledge:"split/ownerKnowledge.json",resources:"split/resources.json",media:"split/media.json"};
 const mapped=Object.fromEntries(Object.entries(paths).map(([k,v])=>[v,{specifications:spec,ownerKnowledge:knowledge,resources,media}[k]]));
 const responses={"boatmodels.json":original,...mapped};
 const fetchImpl=async url=>({ok:true,json:async()=>responses[url]||[]});
 const old=await loader.loadApplicationData({fetchImpl});
 const next=await loader.loadApplicationData({fetchImpl,splitModelPaths:paths});
 assert.equal(next.boats.length,995);
 assert.deepEqual(JSON.parse(JSON.stringify(next.boats)),JSON.parse(JSON.stringify(old.boats)),"Runtime behavior changed after split");
 console.log(JSON.stringify({status:"PASS",models:995,splitMatchesLegacy:true,duplicateOwnershipRejected:true,missingIdentitiesRejected:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
