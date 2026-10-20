"use strict";
/** Inventory existing historical research by canonical BoatModelID; read-only. */
const fs = require("node:fs");
const path = require("node:path");
const canonical = require('../developer/canonical-store.cjs').load();
const registry = JSON.parse(fs.readFileSync("data/registry/boat-registry.json","utf8"));
const canonicalIds = new Set(canonical.map(r=>String(r.BoatModelID)));
const pending = new Set(registry.filter(r=>r.IdentityStatus==="PendingReview").map(r=>String(r.BoatModelID)));
const roots = ["data/phase2-batches","data/enrichment"];
function walk(dir) {
 if (!fs.existsSync(dir)) return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=> {
   const p=path.join(dir,x.name);
   return x.isDirectory()?walk(p):x.isFile()&&p.endsWith(".json")?[p]:[];
 });
}
const liveShards=fs.readdirSync("data").filter(name=>/^phase2-live-models(?:-.+)?\.json$/.test(name)).map(name=>path.join("data",name));
const files=[...roots.flatMap(walk),...liveShards];
const byId=new Map();
const unmatched=[];
let totalRecords=0;
for(const file of files){
 let data;
 try { data=JSON.parse(fs.readFileSync(file,"utf8")); }
 catch(err){ unmatched.push({file,reason:"invalid_json",message:err.message}); continue; }
 // Files can contain intermediate research or meta objects. Only identified
 // model-level records are included; never infer identities from file names.
 const candidates=[...(Array.isArray(data)?data:[]), ...(Array.isArray(data.models)?data.models:[]), ...(Array.isArray(data.records)?data.records:[])];
 for(const row of candidates){
   if(!row || typeof row!=="object" || !row.BoatModelID) continue;
   totalRecords++;
   const id=String(row.BoatModelID);
   if(!canonicalIds.has(id)){unmatched.push({file,BoatModelID:id,reason:"model_id_not_in_canonical"});continue;}
   if(!byId.has(id))byId.set(id,[]);
   const urls=[...(typeof row.source==="string"?[row.source]:[]),...(Array.isArray(row.evidence)?row.evidence:[])].filter(x=>typeof x==="string"&&/^https?:\/\//.test(x));
   byId.get(id).push({file,hasSourceUrls:urls.length>0,sourceUrlCount:urls.length});
 }
}
const assertionFiles=walk("knowledge/data/evidence");
const assertionById=new Map();
let assertionCount=0;
for(const file of assertionFiles){
 const data=JSON.parse(fs.readFileSync(file,"utf8"));
 const assertions=Array.isArray(data)?data:(Array.isArray(data.assertions)?data.assertions:[]);
 for(const row of assertions){
   if(!row?.BoatModelID) continue;
   assertionCount++;
   const id=String(row.BoatModelID);
   if(!canonicalIds.has(id)){unmatched.push({file,BoatModelID:id,reason:"evidence_for_unknown_model"});continue;}
   if(!assertionById.has(id))assertionById.set(id,[]);
   assertionById.get(id).push({file,EvidenceAssertionID:row.EvidenceAssertionID||null,SourceRef:row.SourceRef||null});
 }
}
const linkedPending=[...pending].filter(id=>byId.has(id));
const linkedWithEither=[...pending].filter(id=>byId.has(id)||assertionById.has(id));
const pendingByManufacturer={};
for(const row of registry.filter(r=>pending.has(String(r.BoatModelID)))){
 const code=String(row.ManufacturerCode||"(missing)");
 const s=pendingByManufacturer[code] ||= {pending:0,withResearchFile:0,withSourceUrl:0,withEvidenceAssertions:0};
 s.pending++;
 const records=byId.get(String(row.BoatModelID))||[];
 if(records.length)s.withResearchFile++;
 if(records.some(x=>x.hasSourceUrls))s.withSourceUrl++;
 if(assertionById.has(String(row.BoatModelID)))s.withEvidenceAssertions++;
}
const report={
 schema:"batlas-existing-research-inventory-v4",
 recoveredLegacyShardFiles:liveShards.length,
 semantics:"Source-file linkage indicates historical research exists; it does NOT establish historical/specification correctness or approval.",
 scannedFiles:files.length,identifiedRecords:totalRecords,
 evidenceAssertionFiles:assertionFiles.length,evidenceAssertions:assertionCount,
 pendingWithEvidenceAssertions:[...pending].filter(id=>assertionById.has(id)).length,
 pendingWithResearchOrEvidence:linkedWithEither.length,
 pendingWithoutResearchOrEvidence:pending.size-linkedWithEither.length,
 silverton52Evidence:assertionById.get("SILV-52-OV")||[],
 uniqueCanonicalIDsWithResearchFiles:byId.size,
 pendingWithResearchFiles:linkedPending.length,
 pendingWithoutMatchedResearchFiles:pending.size-linkedPending.length,
 unmatchedPendingIdentities:registry.filter(r=>pending.has(String(r.BoatModelID))&&!byId.has(String(r.BoatModelID))).map(r=>({BoatModelID:r.BoatModelID,ManufacturerCode:r.ManufacturerCode,CanonicalName:r.CanonicalName})),
 pendingByManufacturer:Object.fromEntries(Object.entries(pendingByManufacturer).sort((a,b)=>b[1].pending-a[1].pending)),
 unmatchedRecordCount:unmatched.length,unmatched:unmatched.slice(0,100),
 seaRayExamples:[...byId.entries()].filter(([id])=>id.startsWith("SRAY-")).slice(0,6).map(([id,sources])=>({BoatModelID:id,sources}))
};
console.log(JSON.stringify(report,null,2));
