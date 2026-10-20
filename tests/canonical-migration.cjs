'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const store=require('../developer/canonical-store.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const baseline='archive/canonical-migration-baseline/';
const original=read(baseline+'boatmodels.json'), models=store.load();
const expected=structuredClone(original);
for(const change of read('reports/canonical-url-migration.json')){
 const row=expected.find(m=>m.BoatModelID===change.BoatModelID);
 for(const key of Object.keys(change.before))assert.equal(row[key],change.before[key]);
 assert.deepEqual(Object.keys(change.after).sort(),['CanonicalPath','CanonicalSlug','CanonicalURL']);
 Object.assign(row,change.after);
}
assert.equal(models.length,995);
assert.deepEqual(models,expected,'Every model field must survive except the documented URL corrections');
assert.deepEqual(read('boatmodels.json'),models,'Stale generated view');
assert.deepEqual(read('data/registry/boat-registry.json'),read(baseline+'data/registry/boat-registry.json'),'Identity decisions changed');
const checksums=read(baseline+'manifest.json');
for(const [file,sha] of Object.entries(checksums.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(baseline+file)).digest('hex'),sha);
const rules=store.contract(),parts=store.split(models);
assert.deepEqual(store.compose(parts),models);
const bad=structuredClone(parts);bad.specifications[0].Model='wrong owner';assert.throws(()=>store.compose(bad),/not owned/);
const duplicate=structuredClone(parts);duplicate.identities.push(duplicate.identities[0]);assert.throws(()=>store.compose(duplicate),/duplicate/);
const orphan=structuredClone(parts);orphan.guidance[0].BoatModelID='ORPHAN';assert.throws(()=>store.compose(orphan),/identity sets/);
assert.throws(()=>store.split([{BoatModelID:'TEST',unowned:true}]),/Unregistered/);
// Exercise the real multi-owner administrative write and recovery in an isolated repository.
fs.mkdirSync('.bscout-data',{recursive:true});
const temp=fs.mkdtempSync(path.resolve('.bscout-data/canonical-test-'));
try {
 fs.mkdirSync(path.join(temp,'developer'));
 fs.copyFileSync('developer/canonical-store.cjs',path.join(temp,'developer/canonical-store.cjs'));
 fs.cpSync('data/canonical',path.join(temp,'data/canonical'),{recursive:true});
 const isolated=require(path.join(temp,'developer/canonical-store.cjs'));
 const revised=structuredClone(models);revised[0].Overview='Edited guidance';revised[0].LOA=12.5;revised[0].Model='Updated identity';revised[0].ReviewedBy='Regression test';
 isolated.save(revised);assert.deepEqual(isolated.load(),revised);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp,'boatmodels.json'),'utf8')),revised);
 const journal=path.join(temp,'.bscout-data/canonical-write-journal.json');
 fs.writeFileSync(journal,JSON.stringify({before:models,after:revised}));
 assert.throws(()=>isolated.load(),/Incomplete canonical write/);
 isolated.recover('before');assert.deepEqual(isolated.load(),models);
} finally {fs.rmSync(temp,{recursive:true,force:true})}
const ui=require('../knowledge/knowledgecardui.js');
const inputs={resources:read('knowledge/data/curatedresources.json'),listings:read('knowledge/data/listingsearches.json'),annotations:read('knowledge/data/knowledgeannotations.json'),coverage:read('knowledge/data/knowledge-coverage.json')};
const cards=ui.projectCards(models,inputs);
assert.equal(cards.length,995);assert.deepEqual(cards,ui.projectCards(original,inputs));
assert.equal(cards[0].intelligence.overview,original[0].Overview);
const fetchImpl=async file=>({ok:true,json:async()=>read(file)});
ui.loadKnowledgeCards(fetchImpl).then(runtime=>{assert.deepEqual(runtime,cards);console.log(JSON.stringify({status:'PASS',losslessModels:models.length,fieldOwners:Object.keys(rules.fields).length,knowledgeCards:cards.length,pendingIdentities:read('data/registry/boat-registry.json').filter(x=>x.IdentityStatus==='PendingReview').length,administrativeWriteAndRecovery:'PASS'}))}).catch(e=>{console.error(e);process.exitCode=1});
