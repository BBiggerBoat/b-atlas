'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES=200000;
function writeModels(out,models,ownership){
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
 const manifest={schemaVersion:1,format:'batlas-lossless-model-shards-v1',release:sourceDigest,sourceDigest,modelCount:models.length,maxShardBytes:MAX_BYTES,shards,modelToShard,compatibility:{path:'boatmodels.json',sha256:sha(compatibility),bytes:compatibility.length,records:models.length}};
 const content=JSON.stringify(manifest,null,2)+'\n';
 if(Buffer.byteLength(content)>MAX_BYTES)throw Error('Public model manifest exceeds limit');
 fs.writeFileSync(path.join(out,directory,'manifest.json'),content);
 return manifest;
}
module.exports={writeModels,sha,MAX_BYTES};
