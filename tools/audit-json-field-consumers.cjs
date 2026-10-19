"use strict";
/* Static inventory of legacy field consumers, to guide safe loader migration.
 * Candidate matches are deliberately conservative and require manual review.
 */
const fs=require("node:fs"),path=require("node:path");
const report=JSON.parse(fs.readFileSync("build/json-architecture-preview/audit.json","utf8"));
const fields=Object.fromEntries(Object.entries(report.counts).flatMap(([layer,info])=>info.fields.map(field=>[field,{layer,referencedIn:[]}])));
const excluded=new Set(["boatmodels.json"]);
function walk(dir){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>{
  const p=path.join(dir,x.name);
  if(x.isDirectory()&& ![".git","node_modules","dist","build","models","manufacturers","images"].includes(x.name))return walk(p);
  if(x.isFile()&&p.endsWith(".js")&&!p.startsWith("tools/"))return [p];
  return [];
 });
}
const scripts=[...new Set([...walk("."),...walk("developer")])].filter(x=>!x.includes("/.git/"));
for(const file of scripts){
 let source;
 try{source=fs.readFileSync(file,"utf8");}catch{continue;}
 for(const field of Object.keys(fields)){
  if(source.includes("."+field)||source.includes('["'+field+'"]')||source.includes("['"+field+"']"))fields[field].referencedIn.push(file);
 }
}
const layerSummary=Object.fromEntries(["specifications","ownerKnowledge","resources","media"].map(layer=>{
 const keys=Object.entries(fields).filter(([_,x])=>x.layer===layer);
 return [layer,{fields:keys.length,withDetectedConsumers:keys.filter(([_,x])=>x.referencedIn.length>0).length,withoutDetectedConsumers:keys.filter(([_,x])=>x.referencedIn.length===0).length}];
}));
const result={schema:"batlas-runtime-field-consumer-inventory-v1",caveat:"Heuristic textual scan; absence of direct references does not prove a field is unused. Dynamic property access may be missed.",scannedJavaScriptFiles:scripts.length,layerSummary,nonSpecificationFieldsWithConsumers:Object.entries(fields).filter(([_,x])=>x.layer!=="specifications"&&x.referencedIn.length>0).map(([field,x])=>({field,layer:x.layer,referencedIn:x.referencedIn}))};
fs.writeFileSync("build/json-architecture-preview/consumer-audit.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({scannedJavaScriptFiles:scripts.length,layerSummary,nonSpecificationFieldsWithConsumers:result.nonSpecificationFieldsWithConsumers.length},null,2));
