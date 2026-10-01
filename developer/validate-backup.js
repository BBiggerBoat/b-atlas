const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const file=process.argv[2];
if(!file){
  console.error("Usage: node developer/validate-backup.js <B-Atlas_Backup.json>");
  process.exit(2);
}
let backup;
try{backup=JSON.parse(fs.readFileSync(path.resolve(file),"utf8"))}
catch(e){console.error("Backup validation failed: unreadable/invalid JSON:",e.message);process.exit(1)}

const problems=[];
if(backup?.schema!=="batlas-backup-v1") problems.push("schema must be batlas-backup-v1");
if(!backup?.baselineVersion) problems.push("baselineVersion missing");
if(!backup?.exportedAt) problems.push("exportedAt missing");
if(!backup?.snapshot||typeof backup.snapshot!=="object") problems.push("snapshot missing");
if(!backup?.published||typeof backup.published!=="object") problems.push("published missing");
if(!backup?.attachments||typeof backup.attachments!=="object") problems.push("attachments manifest missing");

for(const key of ["pending","reviewed","knowledgeItems","knowledgeEvidence"]){
  if(!Array.isArray(backup?.snapshot?.[key])) problems.push(`snapshot.${key} must be an array`);
}
for(const key of ["modelPatches","addedModels","addedManufacturers","reviewedContributions","knowledgeItems","knowledgeEvidence","resourceAdditions"]){
  const value=backup?.published?.[key];
  if(key==="modelPatches"){
    if(!value||typeof value!=="object"||Array.isArray(value)) problems.push("published.modelPatches must be an object");
  }else if(!Array.isArray(value)) problems.push(`published.${key} must be an array`);
}
if(!Array.isArray(backup?.attachments?.manifest)) problems.push("attachments.manifest must be an array");

if(backup?.integrity){
  if(backup.integrity.algorithm!=="SHA-256") problems.push("integrity.algorithm must be SHA-256");
  const expected=crypto.createHash("sha256").update(JSON.stringify({
    snapshot:backup.snapshot,
    published:backup.published,
    attachmentManifest:backup.attachments?.manifest||[]
  })).digest("hex");
  if(String(backup.integrity.digest||"").toLowerCase()!==expected) problems.push("integrity digest mismatch");
}

if(problems.length){
  console.error("B-Atlas backup validation FAILED:");
  for(const p of problems) console.error(" - "+p);
  process.exit(1);
}

const patchCount=Object.keys(backup.published.modelPatches||{}).length;
const patchFields=Object.values(backup.published.modelPatches||{}).reduce((n,p)=>n+Object.keys(p||{}).filter(k=>!["LastUpdated","ReviewedBy"].includes(k)).length,0);
console.log("B-Atlas backup validation PASSED");
console.log(`Baseline: ${backup.baselineVersion}`);
console.log(`Pending: ${backup.snapshot.pending.length}`);
console.log(`Reviewed: ${backup.snapshot.reviewed.length}`);
console.log(`Published patches: ${patchCount} model(s) / ${patchFields} field(s)`);
console.log(`Added models: ${backup.published.addedModels.length}`);
console.log(`Added manufacturers: ${backup.published.addedManufacturers.length}`);
console.log(`Attachment references: ${backup.attachments.manifest.length}`);
console.log(`Integrity: ${backup.integrity?.digest ? "SHA-256 verified" : "legacy backup without digest"}`);
