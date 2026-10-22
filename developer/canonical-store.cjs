"use strict";
// Source-only authority boundary. boatmodels.json is a generated public view.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const journalPath=path.join(root,'.bscout-data/canonical-write-journal.json');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const contractPath = 'data/canonical/ownership.json';
function contract() { return read(contractPath); }
function compose(datasets, rules = contract()) {
  const rows = new Map();
  const expectedNames = Object.keys(rules.datasets);
  if (Object.keys(datasets).length !== expectedNames.length || expectedNames.some(name => !Object.hasOwn(datasets,name))) throw Error('Dataset identity sets differ: missing or unexpected domain');
  const identityIDs = new Set((datasets.identities || []).map(row=>row.BoatModelID));
  for (const [name, records] of Object.entries(datasets)) {
    if (!Array.isArray(records)) throw Error(`Invalid dataset ${name}`);
    const seen = new Set();
    for (const record of records) {
      const id = record.BoatModelID;
      if (typeof id !== 'string' || !id || seen.has(id)) throw Error(`Missing/duplicate ID in ${name}: ${id}`);
      seen.add(id);
      if (!rows.has(id)) rows.set(id, {BoatModelID:id});
      const target = rows.get(id);
      for (const [key,value] of Object.entries(record)) {
        if (key === 'BoatModelID') continue;
        if (rules.fields[key] !== name) throw Error(`Field ${key} is not owned by ${name}`);
        if (Object.hasOwn(target,key)) throw Error(`Duplicate owner for ${id}:${key}`);
        target[key] = value;
      }
    }
  }
  const identities = datasets.identities || [];
  for (const records of Object.values(datasets)) {
    if (records.length !== identities.length || records.some(r => !identityIDs.has(r.BoatModelID))) throw Error('Dataset identity sets differ');
  }
  return identities.map(row=>rows.get(row.BoatModelID));
}
function load() {
  if(fs.existsSync(journalPath)) throw Error('Incomplete canonical write; recover journal before reading: '+journalPath);
  const rules = contract();
  const storage = storageContract(rules), index = read(storage.index);
  if (index.schemaVersion !== 1 || !Array.isArray(index.modelOrder) || index.modelOrder.some(id=>typeof id!=='string'||!id) || new Set(index.modelOrder).size !== index.modelOrder.length) throw Error('Invalid canonical model order index');
  const datasets = Object.fromEntries(Object.entries(rules.datasets).map(([name,dir])=>{
    const expected = bucketNames();
    const actual = fs.readdirSync(path.join(root,dir));
    if (actual.length !== expected.length || actual.some(file=>!expected.includes(file))) throw Error(`Missing or unexpected partition in ${name}`);
    const records = expected.flatMap((file,bucket)=>{
      const rel=path.posix.join(dir,file), bytes=fs.readFileSync(path.join(root,rel));
      checkSize(rel,bytes.length,storage);
      const rows=JSON.parse(bytes);
      if (!Array.isArray(rows)) throw Error(`Invalid dataset ${name}: ${file}`);
      for(const row of rows) if(typeof row?.BoatModelID!=='string'||bucketFor(row.BoatModelID)!==bucket) throw Error(`Wrong partition routing in ${rel}`);
      return rows;
    });
    const byID=new Map(records.map(row=>[row.BoatModelID,row]));
    if(byID.size!==records.length) throw Error(`Missing/duplicate ID in ${name}`);
    if(records.length!==index.modelOrder.length || index.modelOrder.some(id=>!byID.has(id))) throw Error(`Dataset identity sets differ: ${name} and index`);
    return [name,index.modelOrder.map(id=>byID.get(id))];
  }));
  return compose(datasets,rules);
}
const warned = new Set();
function storageContract(rules) {
  const s=rules.storage;
  if(!s || s.schemaVersion!==1 || s.bucketCount!==32 || s.routing!=='sha256-utf8-first8hex-mod32' || s.warningBytes!==150000 || s.maximumBytes!==200000) throw Error('Unsupported canonical storage contract');
  return s;
}
function bucketFor(id) { return Number.parseInt(crypto.createHash('sha256').update(id,'utf8').digest('hex').slice(0,8),16)%32; }
function bucketNames() { return Array.from({length:32},(_,i)=>String(i).padStart(2,'0')+'.json'); }
function checkSize(file,bytes,storage) {
  if(bytes>storage.maximumBytes) throw Error(`Canonical partition exceeds ${storage.maximumBytes} bytes: ${file} (${bytes})`);
  if(bytes>storage.warningBytes&&!warned.has(file)) {console.warn(`Canonical partition warning: ${file} (${bytes} bytes)`);warned.add(file);}
}
function plannedWrites(models) {
  const rules=contract(),storage=storageContract(rules),parts=split(models), writes=new Map();
  for(const [name,dir] of Object.entries(rules.datasets)) {
    const buckets=Array.from({length:32},()=>[]);
    for(const row of parts[name]) buckets[bucketFor(row.BoatModelID)].push(row);
    bucketNames().forEach((file,i)=>{
      const rows=buckets[i].sort((a,b)=>a.BoatModelID<b.BoatModelID?-1:a.BoatModelID>b.BoatModelID?1:0);
      const rel=path.posix.join(dir,file),text=serialize(rows);
      checkSize(rel,Buffer.byteLength(text,'utf8'),storage);
      writes.set(rel,text);
    });
  }
  writes.set(storage.index,serialize({schemaVersion:1,modelOrder:models.map(row=>row.BoatModelID)}));
  writes.set('boatmodels.json',serialize(models));
  return writes;
}
function serialize(value) { return JSON.stringify(value,null,2)+'\n'; }
function split(models) {
  const rules = contract();
  const datasets = Object.fromEntries(Object.keys(rules.datasets).map(name=>[name,[]]));
  for (const model of models) {
    const parts = Object.fromEntries(Object.keys(datasets).map(name=>[name,{BoatModelID:model.BoatModelID}]));
    for (const [key,value] of Object.entries(model)) {
      if (key === 'BoatModelID') continue;
      const owner = rules.fields[key];
      if (!owner) throw Error(`Unregistered field ${key}; declare ownership before writing`);
      parts[owner][key] = value;
    }
    for (const name of Object.keys(parts)) datasets[name].push(parts[name]);
  }
  compose(datasets,rules);
  return datasets;
}
function writeFile(file,data) {
  writeText(file,serialize(data));
}
function writeText(file,text) {
  // Git may check JSON out with CRLF on Windows. Preserve an unchanged file's
  // bytes and timestamp rather than rewriting it solely to normalize newlines.
  const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  let unchanged=existing!==null&&existing.replace(/\r\n/g,'\n')===text;
  if(!unchanged&&existing!==null&&file===path.join(root,'boatmodels.json')) {
    try {unchanged=require('node:util').isDeepStrictEqual(JSON.parse(existing),JSON.parse(text));} catch (_) { /* Replace a damaged generated view during recovery. */ }
  }
  if(unchanged) {
    if(fs.existsSync(file+'.tmp')) fs.unlinkSync(file+'.tmp');
    return;
  }
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const fd=fs.openSync(file+'.tmp','w');
  try {fs.writeFileSync(fd,text);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  fs.renameSync(file+'.tmp',file);
}
function materialize() {
  const rows=load();
  const file=path.join(root,'boatmodels.json');
  if(!fs.existsSync(file)||!require('node:util').isDeepStrictEqual(read('boatmodels.json'),rows)) writeFile(file,rows);
  return rows;
}
function save(models) {
  const writes=plannedWrites(models),before=load();
  // Durable recovery journal prevents a partial multi-file write from being silent.
  const journal=path.join(root,'.bscout-data/canonical-write-journal.json');
  writeFile(journal,{before,after:models});
  try {
    for (const [file,text] of writes) writeText(path.join(root,file),text);
    fs.unlinkSync(journal);
  } catch(error) { throw Error(`Canonical write incomplete; recover from ${journal}: ${error.message}`); }
}
function recover(side) {
  if(!['before','after'].includes(side)) throw Error('Choose before or after');
  const models=JSON.parse(fs.readFileSync(journalPath,'utf8'))[side];
  const writes=plannedWrites(models);
  for(const [file,text] of writes) writeText(path.join(root,file),text);
  fs.unlinkSync(journalPath);
}
if (require.main === module) {
  if (process.argv.includes('--recover-before')) recover('before');
  else if (process.argv.includes('--recover-after')) recover('after');
  else if (process.argv.includes('--check')) {
    require('node:assert/strict').deepEqual(read('boatmodels.json'),load(),'Generated model view is stale; run npm run generate:models');
    console.log('Canonical ownership and generated model view verified.');
  } else console.log(`Generated ${materialize().length} models from canonical owners.`);
}
module.exports={load,save,split,compose,contract,materialize,recover};
