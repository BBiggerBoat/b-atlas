'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const {writeModels,sha}=require('./public-model-artifacts.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'deployment/public-manifest.json'),'utf8'));
function relative(rel){
 if(typeof rel!=='string'||!rel||rel.includes('\\')||path.isAbsolute(rel)||rel.split('/').some(p=>p==='..'||p==='.'||!p))throw Error('Unsafe manifest path: '+rel);
 return rel;
}
const denied=rel=>(manifest.sourceOnlyNeverPublish||[]).some(p=>rel===p||rel.startsWith(p+'/'));
function walk(dir,base=''){
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const rel=base+e.name;
  if(e.isSymbolicLink())throw Error('Symlink is not a public artifact: '+rel);
  return e.isDirectory()?walk(path.join(dir,e.name),rel+'/'):[rel];
 });
}
function removeWork(dir){
 const resolved=path.resolve(dir),boundary=path.join(root,'.bscout-data')+path.sep;
 if(!resolved.startsWith(boundary))throw Error('Unsafe build cleanup target');
 fs.rmSync(resolved,{recursive:true,force:true});
}
async function build(){
 // One validated composition feeds every generated model and SEO output.
 const store=require('./canonical-store.cjs'),models=store.load(),ownership=store.contract();
 const pageInput=await require('./model-page-input.cjs')(models);
 fs.mkdirSync(path.join(root,'.bscout-data'),{recursive:true});
 const work=fs.mkdtempSync(path.join(root,'.bscout-data/public-build-')),stage=path.join(work,'site'),previous=path.join(work,'previous');
 fs.mkdirSync(stage);
 try{
  const copy=rel=>{
   relative(rel);if(denied(rel))throw Error('Allowlisted source-only path: '+rel);
   const source=path.join(root,rel);if(!fs.statSync(source).isFile())throw Error('Public file is not a regular file: '+rel);
   if(fs.lstatSync(source).isSymbolicLink())throw Error('Public file symlink: '+rel);
   const dest=path.join(stage,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);
  };
  for(const rel of [...manifest.rootFiles,...manifest.publicFiles,...manifest.temporaryModeratorFiles])copy(rel);
  for(const dir of manifest.publicDirectories){relative(dir);for(const file of walk(path.join(root,dir)))copy(dir+'/'+file);}
  const publicModels=writeModels(stage,models,ownership,{previousRoot:out});
  const input=path.join(work,'page-input.json');fs.writeFileSync(input,JSON.stringify(pageInput));
  cp.execFileSync('python',[path.join(root,'developer/generate-search-landing-pages.py')],{cwd:root,env:{...process.env,BATLAS_OUTPUT_DIR:stage,BATLAS_PAGE_INPUT:input},stdio:'pipe'});
  const slugToId=new Map(models.map(row=>[row.CanonicalSlug,row.BoatModelID]));
  for(const rel of walk(stage).filter(file=>file.endsWith('.html'))){
   const file=path.join(stage,rel);let html=fs.readFileSync(file,'utf8');
   // Navigation rewrites must never alter <link rel="canonical"> metadata.
   html=html.replace(/<a\b[^>]*>/g,anchor=>anchor
    .replace(/href="(?:\.\.\/)*models\/?"/g,'href="/#boat-models"').replace(/href="\/models\/?"/g,'href="/#boat-models"')
    .replace(/href="([^"]*?models\/([^/"?#]+)\/?)"/g,(match,href,slug)=>slugToId.has(slug)?`href="/?model=${encodeURIComponent(slugToId.get(slug))}"`:match)
    .replace(/href="\.\.\/([^/"?#]+)\/"/g,(match,slug)=>rel.startsWith('models/')&&slugToId.has(slug)?`href="/?model=${encodeURIComponent(slugToId.get(slug))}"`:match));
   fs.writeFileSync(file,html);
  }
  const explicit=new Set([...manifest.rootFiles,...manifest.publicFiles,...manifest.temporaryModeratorFiles,...manifest.generatedFiles]);
  for(const rel of walk(stage)){
   if(denied(rel))throw Error('Source leaked into build: '+rel);
   if(!explicit.has(rel)&&![...manifest.publicDirectories,...manifest.generatedDirectories].some(dir=>rel.startsWith(dir+'/')))throw Error('Unexpected public output: '+rel);
   if(/\.(?:html|js|css|json|xml|txt|svg)$/.test(rel)){
    const file=path.join(stage,rel);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));
   }
  }
  for(const rel of manifest.generatedFiles.filter(file=>file!=='public-build.json'))assert(fs.existsSync(path.join(stage,relative(rel))),'Missing generated output: '+rel);
  for(const model of models){
   const rel='models/'+model.CanonicalSlug+'/index.html';relative(rel);
   const html=fs.readFileSync(path.join(stage,rel),'utf8');
   assert(html.includes(model.BoatModelID)&&html.includes(model.CanonicalURL),'Missing canonical SEO identity: '+model.BoatModelID);
  }
  const epoch=process.env.SOURCE_DATE_EPOCH;
  if(epoch!==undefined&&(!/^\d+$/.test(epoch)||!Number.isFinite(new Date(Number(epoch)*1000).getTime())))throw Error('Invalid SOURCE_DATE_EPOCH');
  const artifactDigest=sha(JSON.stringify(walk(stage).sort().map(file=>[file,sha(fs.readFileSync(path.join(stage,file)))])));
  const marker={schema:'batlas-public-build-v2',builtAt:(epoch===undefined?new Date():new Date(Number(epoch)*1000)).toISOString(),baseline:manifest.version,sourceDigest:publicModels.sourceDigest,artifactDigest,models:models.length,shards:publicModels.shards.length,rootFileCount:manifest.rootFiles.length,publicDirectoryCount:manifest.publicDirectories.length,temporaryModeratorFileCount:manifest.temporaryModeratorFiles.length};
  fs.writeFileSync(path.join(stage,'public-build.json'),JSON.stringify(marker,null,2)+'\n');
  // Replace the local artifact only after successful generation and validation.
  if(fs.existsSync(out))fs.renameSync(out,previous);
  try{fs.renameSync(stage,out);}catch(error){
   if(fs.existsSync(previous))try{fs.renameSync(previous,out);}catch(restoreError){throw new AggregateError([error,restoreError],'Previous artifact retained at '+previous);}
   throw error;
  }
  console.log(`Built ${models.length} models, ${publicModels.shards.length} lossless shards and current SEO pages in dist/.`);
  return marker;
 }finally{if(!fs.existsSync(previous)||fs.existsSync(out))removeWork(work);}
}
if(require.main===module)build().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build};
