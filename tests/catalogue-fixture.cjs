// Build real, checksummed release fixtures around a caller's dataset transport.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {writeModels}=require('../developer/public-model-artifacts.cjs');
const {DATASET_PATHS}=require('../datarepository.js');
async function releaseFetch(transport){
 fs.mkdirSync('.bscout-data',{recursive:true});
 const root=fs.mkdtempSync(path.resolve('.bscout-data/catalogue-fixture-'));
 try{
  for(const source of new Set(Object.values(DATASET_PATHS))){
   const response=await transport(source),value=await response.json();
   const file=path.join(root,source);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));
  }
  fs.writeFileSync(path.join(root,'baseline-version.json'),JSON.stringify({baselineVersion:'fixture'}));
  const models=JSON.parse(fs.readFileSync(path.join(root,'boatmodels.json')));
  const manifest=writeModels(root,models,{}),files=new Map();
  for(const d of [...manifest.shards,...Object.values(manifest.datasets).flatMap(d=>d.shards)])files.set(d.path,fs.readFileSync(path.join(root,d.path),'utf8'));
  files.set('data/generated/models/manifest.json',JSON.stringify(manifest));
  return async(url,options)=>files.has(url)?{ok:true,json:async()=>JSON.parse(files.get(url)),text:async()=>files.get(url)}:transport(url,options);
 }finally{if(!root.startsWith(path.resolve('.bscout-data')+path.sep))throw Error('Unsafe fixture cleanup');fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={releaseFetch,contextGlobals:{setTimeout,clearTimeout,AbortController,TextEncoder,crypto:require('node:crypto').webcrypto}};
