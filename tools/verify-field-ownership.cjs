"use strict";
const fs=require("fs"),assert=require("assert/strict");
const sources={
 specifications:"build/json-architecture-preview/specifications.json",
 ownerKnowledge:"build/json-architecture-preview/ownerKnowledge.json",
 resources:"knowledge/data/curatedresources.json",
 annotations:"knowledge/data/knowledgeannotations.json",
 knowledgeCards:"knowledge/data/knowledgecards.json",
 media:"data/imageassets.json",
 evidence:"knowledge/data/evidence.json",
 phases:"data/production-phases.json"
};
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const canonical=read("boatmodels.json");
const ids=new Set(canonical.map(x=>x.BoatModelID));
const output={schema:"batlas-field-ownership-v1",policy:"One authoritative writer per field; archived evidence is never a competing model specification database.",datasets:{},collisions:[],invalidReferences:[]};
const byDataset={};
for(const [name,file] of Object.entries(sources)){
 const value=read(file),rows=Array.isArray(value)?value:(value.assets||[]);
 const fields=new Set(),seen=new Map();
 for(const row of rows){
  const id=row.BoatModelID||row.boatModelId;
  for(const key of Object.keys(row))if(!["BoatModelID","boatModelId"].includes(key))fields.add(key);
  if(!id)continue;
  if(!ids.has(id))output.invalidReferences.push({dataset:name,id});
  const earlier=seen.get(id)||0;seen.set(id,earlier+1);
 }
 byDataset[name]=fields;
 output.datasets[name]={file,rows:rows.length,uniqueModelIds:seen.size,fields:[...fields].sort(),modelsWithRepeatedRecords:[...seen].filter(([_,count])=>count>1).length,role:name==="specifications"?"canonical model specifications":name==="ownerKnowledge"?"model narrative fields":name==="resources"?"curated model links":name==="annotations"?"owner and survey annotations":name==="knowledgeCards"?"derived knowledge-card display objects":name==="media"?"media asset inventory":name==="evidence"?"provenance assertions":"production-scoped overrides"};
}
for(const left of Object.keys(sources))for(const right of Object.keys(sources)){
 if(left>=right)continue;
 const shared=[...byDataset[left]].filter(x=>byDataset[right].has(x)&&!["schemaVersion","updatedAt","sources","confidence","notes","status"].includes(x));
 if(shared.length)output.collisions.push({left,right,shared});
}
fs.writeFileSync("build/json-architecture-preview/field-ownership.json",JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({datasets:Object.fromEntries(Object.entries(output.datasets).map(([k,v])=>[k,{rows:v.rows,fields:v.fields.length,modelIds:v.uniqueModelIds,repeatedRecords:v.modelsWithRepeatedRecords}])),sharedFieldNames:output.collisions,invalidReferenceCount:output.invalidReferences.length,invalidReferences:output.invalidReferences.slice(0,30)},null,2));
assert.equal(ids.size,995);
