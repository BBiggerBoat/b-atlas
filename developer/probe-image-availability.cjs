'use strict';
// Read-only availability probe of existing image references; never discovers,
// downloads or substitutes photographs, and never changes evidence statuses.
const fs=require('node:fs'),vm=require('node:vm');const ctx={};
vm.runInNewContext(fs.readFileSync('imageassetmanager.js','utf8'),ctx);
const read=p=>JSON.parse(fs.readFileSync(p.split('?')[0],'utf8'));
(async()=>{
 await ctx.ImageAssetManager.loadImageAssetRegistry(async p=>({ok:true,json:async()=>read(p)}));
 const models=read('boatmodels.json'),urls=new Map();
 for(const model of models){const url=ctx.ImageAssetManager.resolveBoatImage(model);if(/^https?:/.test(url)){if(!urls.has(url))urls.set(url,[]);urls.get(url).push(model.BoatModelID)}}
 const entries=[...urls],rows=[];let index=0;
 async function next(){while(index<entries.length){const [url,models]=entries[index++];let result;
  try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(4000),redirect:'follow'});result={url,models,status:r.status,contentType:r.headers.get('content-type'),available:r.ok&&String(r.headers.get('content-type')||'').startsWith('image/')};}
  catch(e){result={url,models,status:null,available:false,error:e.name};}rows.push(result);
  if(rows.length%100===0)console.log(`Checked ${rows.length}/${entries.length} existing external image URLs.`);
 }}
 await Promise.all(Array.from({length:16},next));
 const statuses={};for(const row of rows)statuses[String(row.status||row.error)]=(statuses[String(row.status||row.error)]||0)+1;
 const result={checkedAt:new Date().toISOString(),mode:'HEAD only; servers may reject probes differently from browser image loads',uniqueURLs:rows.length,modelsWithExternalImages:[...urls.values()].flat().length,reachableImageURLs:rows.filter(r=>r.available).length,statuses,automaticFallbackVerifiedForModels:995,liveWrites:0,rows};
 fs.writeFileSync('reports/production-image-availability.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
