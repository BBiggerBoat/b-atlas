'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
fs.mkdirSync('.bscout-data',{recursive:true});
const temp=fs.mkdtempSync(path.resolve('.bscout-data/pages-test-'));
try {
 fs.mkdirSync(path.join(temp,'developer'));
 for(const file of ['developer/canonical-store.cjs','developer/model-page-input.cjs','developer/generate-search-landing-pages.py','imageassetmanager.js','index.html','package.json'])fs.copyFileSync(file,path.join(temp,file));
 fs.cpSync('data/canonical',path.join(temp,'data/canonical'),{recursive:true});
 for(const file of ['data/imageassets.json','data/imageassets-external.json','data/image-candidates.json'])fs.copyFileSync(file,path.join(temp,file));
 execFileSync('python',[path.join(temp,'developer/generate-search-landing-pages.py')],{cwd:temp,env:{...process.env,BATLAS_OUTPUT_DIR:temp},stdio:'pipe'});
 const models=require('../developer/canonical-store.cjs').load();
 const permalinks=JSON.parse(fs.readFileSync(path.join(temp,'data/model-permalinks.json'),'utf8'));
 assert.equal(permalinks.models.length,models.length);
 assert.equal(new Set(permalinks.models.map(m=>m.CanonicalSlug)).size,models.length);
 for(const model of models){
   const slug=permalinks.models.find(m=>m.BoatModelID===model.BoatModelID).CanonicalSlug;
   const html=fs.readFileSync(path.join(temp,'models',slug,'index.html'),'utf8');
   assert(html.includes(model.BoatModelID),`Missing stable model link: ${model.BoatModelID}`);
 }
 const firstIndex=fs.readFileSync(path.join(temp,'index.html'),'utf8');
 execFileSync('python',[path.join(temp,'developer/generate-search-landing-pages.py')],{cwd:temp,env:{...process.env,BATLAS_OUTPUT_DIR:temp},stdio:'pipe'});
 assert.equal(fs.readFileSync(path.join(temp,'index.html'),'utf8'),firstIndex,'Repeated generation duplicates footer links');
 console.log(`PASS: ${models.length} generated model pages and permalinks from authoritative datasets.`);
} finally {fs.rmSync(temp,{recursive:true,force:true})}
