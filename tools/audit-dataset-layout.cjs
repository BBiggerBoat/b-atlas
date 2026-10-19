"use strict";
const fs=require("fs");
const files=["boatmodels.json","knowledge/data/knowledgecards.json","knowledge/data/curatedresources.json","knowledge/data/knowledgeannotations.json","knowledge/data/evidence.json","data/production-phases.json","data/imageassets.json"];
const report=[];
for(const file of files){
 const parsed=JSON.parse(fs.readFileSync(file,"utf8"));
 const rows=Array.isArray(parsed)?parsed:parsed.assets||[];
 const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))].sort();
 const ids=rows.map(row=>row.BoatModelID||row.boatModelId).filter(Boolean);
 report.push({file,records:rows.length,uniqueIDs:new Set(ids).size,columns});
}
console.log(JSON.stringify(report,null,2));
