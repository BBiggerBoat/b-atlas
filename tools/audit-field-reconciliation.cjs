"use strict";
/** Read-only comparison of historical Phase 2 research to canonical specs.
 * Never auto-applies older data. Missing, matching and conflicting values are separate.
 */
const fs=require("node:fs"),path=require("node:path");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const canonical=read("boatmodels.json");
const current=new Map(canonical.map(row=>[String(row.BoatModelID),row]));
const phases=read("data/production-phases.json");
const phasesById=new Map();
for(const phase of phases){const id=String(phase.BoatModelID||"");if(!phasesById.has(id))phasesById.set(id,[]);phasesById.get(id).push(phase);}
const alternativeKeys={LOAFt:["LOA","LOA_ft","LengthFt"],BeamFt:["Beam","Beam_ft"],DraftFt:["Draft","Draft_ft"],AirDraftFt:["AirDraft","AirDraft_ft"],DisplacementLb:["Displacement","DisplacementKg"],FuelCapacityGal:["FuelCapacity","FuelCapacityL"],WaterCapacityGal:["WaterCapacity","WaterCapacityL"],HoldingCapacityGal:["HoldingCapacity","HoldingCapacityL"],DeadriseAftDeg:["DeadriseAft"],Fuel:["NormalizedFuel","FuelCode"],Propulsion:["NormalizedPropulsion","MechanicalPropulsionCode"],EngineConfiguration:["EngineConfigurationCode"],EngineCount:["NumberOfEngines"]};
const fields=["FirstYear","LastYear","LOAFt","BeamFt","DraftFt","DisplacementLb","AirDraftFt","FuelCapacityGal","WaterCapacityGal","HoldingCapacityGal","DeadriseAftDeg","Fuel","Propulsion","EngineConfiguration","EngineCount"];
const batches=fs.readdirSync("data/phase2-batches").filter(x=>x.endsWith(".json")).map(x=>path.join("data/phase2-batches",x));
const categories={matching:0,canonicalMissing:0,alternateFieldPresent:0,phaseScoped:0,conflicting:0};
const alternateExamples=[],phaseExamples=[];
const hasValue=x=>x!==null&&x!==undefined&&x!==""&&!(typeof x==="object"&&Object.keys(x).length===0);
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
   if(!hasValue(now)){
    const alternatives=(alternativeKeys[field]||[]).filter(key=>hasValue(model[key]));
    const phaseMatches=(phasesById.get(String(research.BoatModelID))||[]).flatMap(phase=>(phase.FactOverrides||[]).filter(fact=>[field,...(alternativeKeys[field]||[])].includes(fact.FieldID)).map(fact=>({ProductionPhaseID:phase.ProductionPhaseID,FieldID:fact.FieldID})));
    if(alternatives.length){categories.alternateFieldPresent++;if(alternateExamples.length<25)alternateExamples.push({...ref,alternateKeys:alternatives});}
    else if(phaseMatches.length){categories.phaseScoped++;if(phaseExamples.length<25)phaseExamples.push({...ref,phaseMatches});}
    else {categories.canonicalMissing++;gaps.push(ref);}
   }
   else if(old===now||tolerance(old,now)){categories.matching++;}
   else{categories.conflicting++;conflicts.push(ref);}
  }
 }
}
const dedupe=rows=>[...new Map(rows.map(x=>[x.BoatModelID+"|"+x.field+"|"+x.sourceFile,x])).values()];
const report={schema:"batlas-field-reconciliation-v2",policy:"Read-only diagnostic. Historical values are not automatically authoritative. Inferred configuration-dependent fields are never filled.",canonicalModels:canonical.length,batches:batches.length,categories,alternateExamples,phaseExamples,canonicalMissing:dedupe(gaps).slice(0,35),conflicts:dedupe(conflicts).slice(0,35),uniqueModelsWithMissing:new Set(gaps.map(x=>x.BoatModelID)).size,uniqueModelsWithConflicts:new Set(conflicts.map(x=>x.BoatModelID)).size};
const counted=Object.values(categories).reduce((a,b)=>a+b,0);
if(counted!==3969+2245) throw new Error("Historical comparison baseline shifted unexpectedly: "+counted);
console.log(JSON.stringify(report,null,2));
