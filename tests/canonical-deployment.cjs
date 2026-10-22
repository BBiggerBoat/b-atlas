'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const manifest=JSON.parse(fs.readFileSync('deployment/public-manifest.json','utf8'));
for(const rel of manifest.sourceOnlyNeverPublish) assert(!fs.existsSync(path.join('dist',rel)),`Source leaked: ${rel}`);
assert(!fs.existsSync('dist/knowledge/data/knowledgecards.json'));
assert.deepEqual(JSON.parse(fs.readFileSync('dist/boatmodels.json','utf8')),require('../developer/canonical-store.cjs').load());
assert(fs.existsSync('dist/data/generated/models/manifest.json'),'Missing generated shard manifest');
assert(!manifest.publicDirectories.includes('data')&&!manifest.publicDirectories.includes('knowledge'),'Broad public data copy remains');
assert(manifest.generatedFiles.includes('boatmodels.json')&&!manifest.rootFiles.includes('boatmodels.json'),'Compatibility view must be generated');
const context={};require('node:vm').runInNewContext(fs.readFileSync('dist/datarepository.js','utf8'),context);
for(const file of Object.values(context.BScoutDataRepository.DEFAULT_MANIFEST))assert(fs.existsSync(path.join('dist',file)),`Missing runtime dependency: ${file}`);
for(const file of ['index.html','knowledge/knowledgecardui.js','developer/moderatorapi.js','data/model-schema.json','data/field-registry.json'])assert(fs.existsSync(path.join('dist',file)),file);
for(const file of ['data/image-candidates.json','data/imageassets.json','data/imageassets-external.json'])assert(fs.existsSync(path.join('dist',file)),`Missing image runtime dependency ${file}`);
const models=require('../developer/canonical-store.cjs').load();
assert.equal(new Set(models.map(m=>m.CanonicalSlug)).size,models.length,'Ambiguous published model URL');
for(const model of models){
 const page=path.join('dist','models',model.CanonicalSlug,'index.html');
 assert(fs.existsSync(page),`Missing published model page ${model.BoatModelID}`);
 assert(fs.readFileSync(page,'utf8').includes(model.BoatModelID),`Wrong model page ${model.BoatModelID}`);
}
const html=fs.readFileSync('dist/index.html','utf8');
for(const file of ['imageassetmanager.js','datarepository.js','communityapi.js','knowledge/knowledgecardui.js','knowledge/boatintelligencerepository.js'])assert(html.includes(file+'?v=7.06.2-canonical-20261020'),`Stale client cache version for ${file}`);
for(const file of ['boatworkspace.js','script.js','filterengine.js','engine.js','valuenormalizer.js','userProfile.js','searchstatemanager.js'])assert(html.includes(file+'?v=phase4-ranking-20261021'),`Stale discovery cache version for ${file}`);
for(const [,url] of html.matchAll(/<script[^>]*src="([^"?#]+)(?:[^\"]*)"/g)) if(!/^https?:/.test(url))assert(fs.existsSync(path.join('dist',url)),`Missing script ${url}`);
console.log('PASS: generated public view, loader dependencies, script assets, and all source exclusions.');
