"use strict";
/**
 * Reversible architecture prototype. Never edits source boatmodels.json.
 * Generate split datasets in build/json-architecture-preview/ and verify every
 * field and JSON value round trips exactly before migration is considered.
 */
const fs=require("node:fs"), path=require("node:path"), assert=require("node:assert/strict");
const original=JSON.parse(fs.readFileSync("boatmodels.json","utf8"));
assert(Array.isArray(original)&&original.length===995,"Unexpected canonical model baseline");
const identity=new Set();
const qualitative=new Set([
 "Overview","Strengths","Weaknesses","CommonProblems","KnownConcerns",
 "InspectionFocus","BuyerQuestions","OwnerActions","BestFor","TradeOffs",
 "Suitability","TypicalMission","AvoidIf","OwnershipCharacter","ModelCharacter",
 "DesignLineage","ModelVariations","ResearchNotes","EvidenceSummary",
 "CharacterConfidence","RarityLabel"
]);
const resources=new Set([
 "Documents","Videos","OwnerCommunities","ExternalLinks","References",
 "Sources","Manuals","OwnerForums","ResourceLinks","SourceURL"
]);
const media=new Set(["ImageURL","ImageURLs","Images","Media","Gallery","HeroImage","ImageCredit"]);
const out={specifications:[],ownerKnowledge:[],resources:[],media:[]};
const classified={specifications:new Set(),ownerKnowledge:new Set(),resources:new Set(),media:new Set()};
const ids=new Set();
for(const model of original){
 const id=model.BoatModelID;
 assert(typeof id==="string"&&id&&!ids.has(id),"Missing or duplicate BoatModelID");
 ids.add(id);
 const portions={specifications:{BoatModelID:id},ownerKnowledge:{BoatModelID:id},resources:{BoatModelID:id},media:{BoatModelID:id}};
 for(const [key,value] of Object.entries(model)){
  if(key==="BoatModelID")continue;
  const group=qualitative.has(key)?"ownerKnowledge":resources.has(key)?"resources":media.has(key)?"media":"specifications";
  portions[group][key]=value;
  classified[group].add(key);
 }
 for(const k of Object.keys(out))out[k].push(portions[k]);
}
const reassemble=i=>{
 const row={};
 // Preserve the original key order using a separately recorded key map.
 for(const key of Object.keys(original[i])){
  if(key==="BoatModelID"){row[key]=original[i].BoatModelID;continue;}
  const source=[...Object.values(out)].map(arr=>arr[i]).find(x=>Object.prototype.hasOwnProperty.call(x,key));
  assert(source,"Lost key "+key);
  row[key]=source[key];
 }
 return row;
};
assert.deepEqual(original,original.map((_,i)=>reassemble(i)),"Split/rejoin changed record data");
const output="build/json-architecture-preview";
fs.mkdirSync(output,{recursive:true});
for(const [kind,rows] of Object.entries(out)){
 fs.writeFileSync(path.join(output,kind+".json"),JSON.stringify(rows,null,2)+"\n");
}
const initialBytes=Buffer.byteLength(JSON.stringify(original));
const specBytes=Buffer.byteLength(JSON.stringify(out.specifications));
const counts=Object.fromEntries(Object.entries(classified).map(([kind,keys])=>[kind,{fieldCount:keys.size,fields:[...keys].sort(),bytes:Buffer.byteLength(JSON.stringify(out[kind]))}]));
const report={schema:"batlas-json-architecture-preview-v1",originalModels:original.length,roundTripExact:true,originalMinifiedBytes:initialBytes,specificationMinifiedBytes:specBytes,specificationReductionPercent:Math.round((1-specBytes/initialBytes)*10000)/100,counts,warning:"Preview only. Field ownership requires consumer dependency audit. Do not deploy these split files or delete historical data."};
fs.writeFileSync(path.join(output,"audit.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({models:995,roundTripExact:true,specificationReductionPercent:report.specificationReductionPercent,fieldCounts:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v.fieldCount]))},null,2));
