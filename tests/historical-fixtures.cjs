'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const fixtures=require('../developer/historical-fixtures.cjs'),m=fixtures.manifest();
assert.equal(m.schema,'batlas-historical-fixtures-v1');assert.equal(m.maxPartBytes,150000);
const verified=fixtures.verify(),checks=fixtures.json('migration/manifest.json');
assert.equal(verified.entries,122);
const retirement=JSON.parse(fs.readFileSync('reports/phase5-retired-files.json','utf8'));
let retiredCount=0,retiredBytes=0,preserved=0;
for(const shard of retirement.shards){
 const raw=fs.readFileSync(shard.path);assert.equal(raw.length,shard.bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),shard.sha256);
 const rows=JSON.parse(raw);assert.equal(rows.length,shard.records);
 for(const row of rows){
  retiredCount++;retiredBytes+=row.bytes;
  const name=row.path.startsWith('data/phase2-live-')?'retired/'+row.path:row.path.startsWith('archive/canonical-migration-baseline/')?'migration/'+row.path.slice('archive/canonical-migration-baseline/'.length):null;
  if(name){assert(Object.hasOwn(m.entries,name),'Missing retired historical reference: '+row.path);assert.equal(m.entries[name].sha256,row.sha256);assert.equal(m.entries[name].bytes,row.bytes);preserved++;}
 }
}
assert.equal(retiredCount,retirement.files);assert.equal(retiredBytes,retirement.bytes);assert.equal(preserved,106);
for(const [name,hash] of Object.entries(checks.files))assert.equal(m.entries['migration/'+name].sha256,hash,'Original migration checksum changed');
assert.equal(fixtures.json('pre-storage-models').length,995);
assert.equal(fixtures.json('original-models').length,995);
assert.throws(()=>fixtures.read('absent'),/Unknown historical fixture/);
const read=fs.readFileSync;
try{
 fs.readFileSync=function(file,...args){const bytes=read.call(this,file,...args);return String(file).includes('/parts/')||String(file).includes('\\parts\\')?Buffer.concat([bytes,Buffer.from('corrupt')]):bytes;};
 assert.throws(()=>fixtures.read('original-models'),/integrity failure/);
}finally{fs.readFileSync=read;}
console.log(JSON.stringify({status:'PASS',...verified,preservedRetiredReferences:preserved,checksumMismatchRejected:true}));
