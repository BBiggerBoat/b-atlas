'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const store=require('../developer/canonical-store.cjs'),models=store.load(),rules=store.contract();
// Independent, complete pre-storage-migration snapshot: no regenerated expectations.
const historical=require('../developer/historical-fixtures.cjs');
const original=historical.json('pre-storage-models');
const originalRules=historical.json('pre-storage-ownership');
assert.deepEqual(rules.fields,originalRules.fields,'Field ownership changed');
require('./catalogue-evolution.cjs').assertHistorical(models,original,'Storage migration changed historical model values or sequence');
assert.deepEqual(JSON.parse(fs.readFileSync('boatmodels.json')),models);
const bucket=id=>String(parseInt(crypto.createHash('sha256').update(id,'utf8').digest('hex').slice(0,8),16)%32).padStart(2,'0')+'.json';
let largest=0,total=0,partitions=0;
for(const [name,dir] of Object.entries(rules.datasets)){
 assert(!fs.existsSync(dir+'.json'),'Superseded owner remains');
 const files=fs.readdirSync(dir);assert.equal(files.length,32);
 for(const file of files){const raw=fs.readFileSync(path.join(dir,file));largest=Math.max(largest,raw.length);total+=raw.length;partitions++;assert(raw.length<=200000);const rows=JSON.parse(raw);for(const row of rows)assert.equal(bucket(row.BoatModelID),file);assert.deepEqual(rows.map(r=>r.BoatModelID),rows.map(r=>r.BoatModelID).sort());}
}
fs.mkdirSync('.bscout-data',{recursive:true});const temp=fs.mkdtempSync(path.resolve('.bscout-data/partitions-test-'));
try{
 fs.mkdirSync(path.join(temp,'developer'));fs.copyFileSync('developer/canonical-store.cjs',path.join(temp,'developer/canonical-store.cjs'));fs.cpSync('data/canonical',path.join(temp,'data/canonical'),{recursive:true});fs.copyFileSync('boatmodels.json',path.join(temp,'boatmodels.json'));
 const isolated=require(path.join(temp,'developer/canonical-store.cjs')),file=rel=>path.join(temp,rel),journal=file('.bscout-data/canonical-write-journal.json');
 const read=rel=>JSON.parse(fs.readFileSync(file(rel))),write=(rel,value)=>fs.writeFileSync(file(rel),JSON.stringify(value,null,2)+'\n');
 function snapshot(){const result={};for(const dir of Object.values(rules.datasets))for(const name of fs.readdirSync(file(dir))){const rel=dir+'/'+name;result[rel]={bytes:fs.readFileSync(file(rel)),mtime:fs.statSync(file(rel)).mtimeMs};}for(const rel of [rules.storage.index,'boatmodels.json'])result[rel]={bytes:fs.readFileSync(file(rel)),mtime:fs.statSync(file(rel)).mtimeMs};return result;}
 function unchanged(a,b){assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(a)){assert(a[key].bytes.equals(b[key].bytes),'Bytes changed: '+key);assert.equal(a[key].mtime,b[key].mtime,key);}}
 const initial=snapshot();isolated.save(models);unchanged(initial,snapshot());isolated.materialize();unchanged(initial,snapshot());
 const edited=structuredClone(models);edited[0].Overview='Partition regression guidance';isolated.save(edited);assert.deepEqual(isolated.load(),edited);
 const after=snapshot(),changed=Object.keys(initial).filter(key=>!initial[key].bytes.equals(after[key].bytes));assert.deepEqual(changed.sort(),['boatmodels.json',rules.datasets.guidance+'/'+bucket(models[0].BoatModelID)].sort());for(const key of Object.keys(initial).filter(key=>!changed.includes(key)))assert.equal(initial[key].mtime,after[key].mtime,key);
 isolated.save(models);
 const specRel=rules.datasets.specifications+'/'+bucket(models[0].BoatModelID),spec=read(specRel);
 function corrupt(rel,transform,pattern){const before=fs.readFileSync(file(rel));try{transform();assert.throws(()=>isolated.load(),pattern);}finally{fs.writeFileSync(file(rel),before);}}
 corrupt(specRel,()=>{const rows=read(specRel);rows.push(rows[0]);write(specRel,rows);},/duplicate/);
 corrupt(specRel,()=>{const rows=read(specRel);rows[0].Model='wrong owner';write(specRel,rows);},/not owned/);
 corrupt(specRel,()=>{const rows=read(specRel);rows.pop();write(specRel,rows);},/identity sets/);
 corrupt(specRel,()=>{const rows=read(specRel);rows[0].BoatModelID='ORPHAN';write(specRel,rows);},/routing|identity sets/);
 corrupt(specRel,()=>fs.writeFileSync(file(specRel),' '.repeat(200001)),/exceeds/);
 const warn=console.warn,messages=[],specBytes=fs.readFileSync(file(specRel));
 try{console.warn=m=>messages.push(m);fs.writeFileSync(file(specRel),JSON.stringify(spec)+' '.repeat(150001-Buffer.byteLength(JSON.stringify(spec))));assert.deepEqual(isolated.load(),models);}finally{console.warn=warn;fs.writeFileSync(file(specRel),specBytes);}assert(messages.some(m=>m.includes('partition warning')));
 // Missing/unexpected files and malformed sequence index cannot silently drop records.
 fs.renameSync(file(specRel),file(specRel+'.missing'));assert.throws(()=>isolated.load(),/partition/);fs.renameSync(file(specRel+'.missing'),file(specRel));
 fs.writeFileSync(file(rules.datasets.identities+'/unexpected.json'),'[]');assert.throws(()=>isolated.load(),/partition/);fs.unlinkSync(file(rules.datasets.identities+'/unexpected.json'));
 corrupt(rules.storage.index,()=>write(rules.storage.index,{schemaVersion:1,modelOrder:[models[0].BoatModelID,models[0].BoatModelID]}),/model order/);
 assert.throws(()=>isolated.save([{BoatModelID:'NEW',NotRegistered:true}]),/Unregistered/);
 const oversized=structuredClone(models);oversized[0].Overview='x'.repeat(210000);
 assert.throws(()=>isolated.save(oversized),/exceeds/);assert(!fs.existsSync(journal));assert.deepEqual(isolated.load(),models);
 const missingDomain=isolated.split(models);delete missingDomain.guidance;assert.throws(()=>isolated.compose(missingDomain),/identity sets/);
 // Real partial-write failures; recover before and after across domains, index and view.
 const revised=structuredClone(models);revised[0].Model='Changed identity';revised[0].LOA=12.5;revised[0].Overview='Changed guidance';revised[0].ReviewedBy='Test';revised.reverse();revised.push({BoatModelID:'TEST-PROMOTED',Manufacturer:'Test',Model:'New',Active:true,LOA:null,Overview:'',ResearchNotes:'Test'});
 for(const side of ['before','after']){
  isolated.save(models);const rename=fs.renameSync;let writes=0;
  try{fs.renameSync=(from,to)=>{if(to.startsWith(file('data/canonical')+path.sep)&&++writes===3)throw Error('Injected interrupted write');return rename(from,to);};assert.throws(()=>isolated.save(revised),/Canonical write incomplete/);}finally{fs.renameSync=rename;}
  assert(fs.existsSync(journal));assert.throws(()=>isolated.load(),/Incomplete canonical write/);
  fs.writeFileSync(file('boatmodels.json'),'{');fs.writeFileSync(file(rules.storage.index),'{');
  isolated.recover(side);const expected=side==='before'?models:revised;assert.deepEqual(isolated.load(),expected);assert.deepEqual(read('boatmodels.json'),expected);assert(!fs.existsSync(journal));
 }
 isolated.save(models);assert.deepEqual(isolated.load(),models);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({status:'PASS',models:models.length,partitions,totalBytes:total,largestBytes:largest,lossless:true,focusedWrites:true,recoveryBeforeAndAfter:true}));
