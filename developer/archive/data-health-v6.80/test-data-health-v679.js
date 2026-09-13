const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const models=read('boatmodels.json'), byId=new Map(models.map(x=>[x.BoatModelID,x]));
const manifest=read('data/data-manifest.json');
assert.strictEqual(models.length,259,'model count must remain 259');
assert.strictEqual(manifest.modelCount,259,'manifest model count');
assert.strictEqual(manifest.Release,'v6.79.0','manifest release');
// Supported omissions promoted.
for(const [id,fields] of Object.entries({
 'DUFF-29':['LOA','Beam','Draft'], 'CDRY-26-PA':['LOA','Beam','Draft'], 'CHBY-40':['LOA','Beam','Draft'],
 'MNSH-30-PI':['Draft'], 'NPAC-28':['Draft'], 'TRUN-34':['LOA']
})) for(const f of fields) assert(Number.isFinite(byId.get(id)?.[f]),`${id} ${f} should be canonical`);
// Deliberately ambiguous/phase-specific values remain unknown model-wide.
for(const [id,fields] of Object.entries({
 'CHBB-34-SE':['LOA','Beam','Draft'], 'CHBB-34-TC':['LOA','Beam','Draft'], 'GRBK-36-CL':['LOA','Beam'],
 'GRBK-42-CL':['LOA','Beam'], 'MRTR-38-SD2':['LOA','Beam','Draft'], 'JEAU-795':['LOA','Draft']
})) for(const f of fields) assert.strictEqual(byId.get(id)?.[f],null,`${id} ${f} must remain unknown until reconciled`);
// Legacy intelligence duplicate is no longer a runtime data dependency.
assert(!fs.existsSync(path.join(ROOT,'knowledge/data/boatintelligence.json')),'retired boatintelligence should be archived');
const kui=fs.readFileSync(path.join(ROOT,'knowledge/knowledgecardui.js'),'utf8');
assert(kui.includes("const INTELLIGENCE_PATH = 'boatmodels.json';"),'knowledge UI must read authoritative model record');
// Old reports/snapshots removed from active data paths.
for(const p of ['missions.json','data/registry/legacy-id-map.json','data/registry/boat-registry-validation.json','data/taxonomy/taxonomy-validation.json','data/plan-critical-exceptions-v6.62.json'])
  assert(!fs.existsSync(path.join(ROOT,p)),`${p} should be archived`);
assert(fs.existsSync(path.join(ROOT,'data/plan-critical-exceptions-v6.79.json')),'current exception file required');
// Future server writes must populate canonical measurements.
const server=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
assert(server.includes('syncCanonicalMeasurement(model,target,value)'), 'correction publishing must sync canonical measurements');
assert(server.includes('LOA:f.LengthFt?feetToMetres(f.LengthFt):null'), 'new models must get canonical LOA');
console.log('v6.79.0 data-health tests passed');
