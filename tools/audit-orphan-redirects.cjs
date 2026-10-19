"use strict";
const fs=require("fs");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const ids=new Set(read("boatmodels.json").map(x=>x.BoatModelID));
const redirect=read("data/model-id-redirects.json");
const datasets={"resources":read("knowledge/data/curatedresources.json"),"media":read("data/imageassets.json").assets,"evidence":read("knowledge/data/evidence.json")};
const out=[];
for(const [dataset,rows] of Object.entries(datasets))for(const row of rows){
 const old=row.BoatModelID||row.boatModelId;
 if(!old||ids.has(old))continue;
 const target=redirect[old]||null;
 out.push({dataset,old,target,resolved:target!==null&&ids.has(target)});
}
const summary={total:out.length,redirectResolved:out.filter(x=>x.resolved).length,unresolved:out.filter(x=>!x.resolved)};
fs.mkdirSync("build/json-architecture-preview",{recursive:true});
fs.writeFileSync("build/json-architecture-preview/reference-resolution.json",JSON.stringify({summary,records:out},null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
