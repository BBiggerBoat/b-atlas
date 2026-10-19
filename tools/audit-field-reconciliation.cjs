"use strict";
/** Read-only comparison of historical Phase 2 research to canonical specs.
 * Never auto-applies older data. Missing, matching and conflicting values are separate.
 */
const fs=require("node:fs"),path=require("node:path");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const canonical=read("boatmodels.json");
const current=new Map(canonical.map(row=>[String(row.BoatModelID),row]));
const fields=["FirstYear","LastYear","LOAFt","BeamFt","DraftFt","DisplacementLb","AirDraftFt","FuelCapacityGal","WaterCapacityGal","HoldingCapacityGal","DeadriseAftDeg","Fuel","Propulsion","EngineConfiguration","EngineCount"];
const batches=fs.readdirSync("data/phase2-batches").filter(x=>x.endsWith(".json")).map(x=>path.join("data/phase2-batches",x));
const categories={matching:0,canonicalMissing:0,conflicting:0,notComparable:0};
const samples={canonicalMissing:[],conflicting:[]};
const conflicts=[];
const gaps=[];
const tolerance=(a,b)=>typeof a==="number"&&typeof b==="number"&&Math.abs(a-b)<=0.00015;
for(const file of batches){
 const data=read(file);
 for(const research of Array.isArray(data.models)?data.models:[]){
  const model=current.get(String(research.BoatModelID));
  if(!model)continue;
  for(const field of fields){
   const old=research[field];
   if(old==null||old==="")continue;
   const now=model[field];
   const ref={BoatModelID:research.BoatModelID,field,historical:old,current:now??null,sourceFile:file,sourceURL:research.source||null};
   if(now==null||now===""){categories.canonicalMissing++;gaps.push(ref);}
   else if(old===now||tolerance(old,now)){categories.matching++;}
   else{categories.conflicting++;conflicts.push(ref);}
  }
 }
}
const dedupe=rows=>[...new Map(rows.map(x=>[x.BoatModelID+"|"+x.field+"|"+x.sourceFile,x])).values()];
const report={schema:"batlas-field-reconciliation-v1",policy:"Read-only diagnostic. Historical values are not automatically authoritative. Inferred configuration-dependent fields are never filled.",canonicalModels:canonical.length,batches:batches.length,categories,canonicalMissing:dedupe(gaps).slice(0,35),conflicts:dedupe(conflicts).slice(0,35),uniqueModelsWithMissing:new Set(gaps.map(x=>x.BoatModelID)).size,uniqueModelsWithConflicts:new Set(conflicts.map(x=>x.BoatModelID)).size};
console.log(JSON.stringify(report,null,2));
