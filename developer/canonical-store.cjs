"use strict";
// Source-only authority boundary. boatmodels.json is a generated public view.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const journalPath=path.join(root,'.bscout-data/canonical-write-journal.json');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const contractPath = 'data/canonical/ownership.json';
function contract() { return read(contractPath); }
function compose(datasets, rules = contract()) {
  const rows = new Map();
  for (const [name, records] of Object.entries(datasets)) {
    if (!Array.isArray(records)) throw Error(`Invalid dataset ${name}`);
    const seen = new Set();
    for (const record of records) {
      const id = record.BoatModelID;
      if (!id || seen.has(id)) throw Error(`Missing/duplicate ID in ${name}: ${id}`);
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
    if (records.length !== identities.length || records.some(r => !identities.some(i=>i.BoatModelID===r.BoatModelID))) throw Error('Dataset identity sets differ');
  }
  return identities.map(row=>rows.get(row.BoatModelID));
}
function load() {
  if(fs.existsSync(journalPath)) throw Error('Incomplete canonical write; recover journal before reading: '+journalPath);
  const rules = contract();
  return compose(Object.fromEntries(Object.entries(rules.datasets).map(([name,file])=>[name,read(file)])),rules);
}
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
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  fs.renameSync(file+'.tmp',file);
}
function materialize() {
  const rows=load();
  const file=path.join(root,'boatmodels.json');
  if(!fs.existsSync(file)||!require('node:util').isDeepStrictEqual(read('boatmodels.json'),rows)) writeFile(file,rows);
  return rows;
}
function save(models) {
  const parts=split(models), rules=contract();
  // Durable recovery journal prevents a partial multi-file write from being silent.
  const journal=path.join(root,'.bscout-data/canonical-write-journal.json');
  writeFile(journal,{before:load(),after:models});
  try {
    for (const [name,file] of Object.entries(rules.datasets)) writeFile(path.join(root,file),parts[name]);
    writeFile(path.join(root,'boatmodels.json'),models);
    fs.unlinkSync(journal);
  } catch(error) { throw Error(`Canonical write incomplete; recover from ${journal}: ${error.message}`); }
}
function recover(side) {
  if(!['before','after'].includes(side)) throw Error('Choose before or after');
  const models=JSON.parse(fs.readFileSync(journalPath,'utf8'))[side];
  const parts=split(models), rules=contract();
  for(const [name,file] of Object.entries(rules.datasets)) writeFile(path.join(root,file),parts[name]);
  writeFile(path.join(root,'boatmodels.json'),models);
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
