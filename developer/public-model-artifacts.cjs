'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES=200000;
function writeModels(out,models,ownership,options={}){
 const sourceDigest=sha(JSON.stringify({ownership,models}));
 const directory='data/generated/models',shards=[],modelToShard=Object.create(null);
 fs.mkdirSync(path.join(out,directory),{recursive:true});
 let rows=[],bytes=2;
 function flush(){
  if(!rows.length)return;
  const content=Buffer.from('['+rows.map(r=>r.json).join(',')+']'),digest=sha(content);
  const file=directory+'/'+String(shards.length).padStart(3,'0')+'-'+digest+'.json';
  fs.writeFileSync(path.join(out,file),content);
  for(const row of rows)modelToShard[row.id]=shards.length;
  shards.push({path:file,sha256:digest,bytes:content.length,records:rows.length});rows=[];bytes=2;
 }
 const ids=new Set();
 for(const model of models){
  if(!model.BoatModelID||ids.has(model.BoatModelID))throw Error('Missing/duplicate public model ID');
  ids.add(model.BoatModelID);
  const json=JSON.stringify(model),length=Buffer.byteLength(json);
  if(length+2>MAX_BYTES)throw Error('Model exceeds public shard limit: '+model.BoatModelID);
  if(rows.length&&bytes+1+length>MAX_BYTES)flush();
  bytes+=length+(rows.length?1:0);rows.push({id:model.BoatModelID,json});
 }
 flush();
 // Temporary output-only compatibility endpoint for Phase 2's unchanged clients.
 const compatibility=Buffer.from(JSON.stringify(models,null,2)+'\n');
 fs.writeFileSync(path.join(out,'boatmodels.json'),compatibility);
 const datasets={};
 const {DATASET_PATHS}=require('../datarepository.js');
 for(const [name,sourcePath] of Object.entries(DATASET_PATHS).filter(([name])=>name!=='boats')){
  const source=options.sourceRoot||out;
  const values=JSON.parse(fs.readFileSync(path.join(source,sourcePath),'utf8'));
  if(!Array.isArray(values))throw Error('Catalogue dataset must be an array: '+sourcePath);
  let chunks=[],group=[],size=2;
  function save(){
   const raw=Buffer.from(JSON.stringify(group)),digest=sha(raw),file='data/generated/catalogue/'+name+'-'+digest+'.json';
   fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.writeFileSync(path.join(out,file),raw);
   chunks.push({path:file,sha256:digest,bytes:raw.length,records:group.length});group=[];size=2;
  }
  for(const row of values){const length=Buffer.byteLength(JSON.stringify(row));if(length+2>MAX_BYTES)throw Error('Catalogue row exceeds shard limit: '+name);if(group.length&&size+1+length>MAX_BYTES)save();size+=length+(group.length?1:0);group.push(row);}
  if(group.length||!chunks.length)save();
  datasets[name]={sourcePath,records:values.length,shards:chunks};
 }
 const {projectSearchModel,DETAIL_ONLY_FIELDS}=require('../datarepository.js');
 const search={projection:'batlas-search-v1',detailOnlyFields:DETAIL_ONLY_FIELDS,shards:[],modelToShard:Object.create(null)};
 let projected=[],projectedBytes=2;
 function saveSearch(){
  if(!projected.length)return;
  const raw=Buffer.from(JSON.stringify(projected)),digest=sha(raw),file='data/generated/catalogue/search-'+String(search.shards.length).padStart(3,'0')+'-'+digest+'.json';
  fs.writeFileSync(path.join(out,file),raw);
  for(const row of projected)search.modelToShard[row.BoatModelID]=search.shards.length;
  search.shards.push({path:file,sha256:digest,bytes:raw.length,records:projected.length});projected=[];projectedBytes=2;
 }
 for(const model of models){const row=projectSearchModel(model),length=Buffer.byteLength(JSON.stringify(row));if(length+2>MAX_BYTES)throw Error('Search row exceeds shard limit');if(projected.length&&projectedBytes+length+1>MAX_BYTES)saveSearch();projectedBytes+=length+(projected.length?1:0);projected.push(row);}saveSearch();
 const baselineVersion=JSON.parse(fs.readFileSync(path.join(options.sourceRoot||out,'baseline-version.json'),'utf8')).baselineVersion;
 const release=sha(JSON.stringify({format:'batlas-catalogue-release-v3',sourceDigest,baselineVersion,modelCount:models.length,shards,modelToShard,datasets,search}));
 const manifest={schemaVersion:3,format:'batlas-catalogue-release-v3',release,sourceDigest,baselineVersion,modelCount:models.length,maxShardBytes:MAX_BYTES,shards,modelToShard,datasets,search,compatibility:{path:'boatmodels.json',sha256:sha(compatibility),bytes:compatibility.length,records:models.length}};
 // Keep one preceding release's immutable files for clients holding its manifest.
 // A second-old release recovers through the reader's whole-release retry.
 manifest.retained=[];
 if(options.previousRoot){
  const previousFile=path.join(options.previousRoot,directory,'manifest.json');
  if(fs.existsSync(previousFile)){
   const previous=JSON.parse(fs.readFileSync(previousFile,'utf8'));
   const candidates=previous.release===release?(previous.retained||[]):[...previous.shards,...Object.values(previous.datasets||{}).flatMap(d=>d.shards),...(previous.search?.shards||[])];
   const current=new Set([...shards,...Object.values(datasets).flatMap(d=>d.shards),...search.shards].map(d=>d.path));
   const retained=candidates.filter(d=>!current.has(d.path));
   // Never promote unsafe or corrupted previous files into a fresh release.
   const verified=retained.map(d=>{
    if(!/^data\/generated\/(models|catalogue)\/[a-zA-Z0-9_-]+-[a-f0-9]{64}\.json$/.test(d.path)||!d.path.includes(d.sha256))throw Error('Unsafe previous shard');
    const raw=fs.readFileSync(path.join(options.previousRoot,d.path));
    if(raw.length!==d.bytes||sha(raw)!==d.sha256)throw Error('Corrupt previous shard');
    return {d,raw};
   });
   for(const {d,raw} of verified){fs.mkdirSync(path.dirname(path.join(out,d.path)),{recursive:true});fs.writeFileSync(path.join(out,d.path),raw);manifest.retained.push(d);}
  }
 }
 const content=JSON.stringify(manifest,null,2)+'\n';
 if(Buffer.byteLength(content)>MAX_BYTES)throw Error('Public model manifest exceeds limit');
 fs.writeFileSync(path.join(out,directory,'manifest.json'),content);
 return manifest;
}
module.exports={writeModels,sha,MAX_BYTES};
