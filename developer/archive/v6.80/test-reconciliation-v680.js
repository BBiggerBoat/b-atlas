const fs=require('fs'), assert=require('assert');
const models=JSON.parse(fs.readFileSync('boatmodels.json','utf8'));
const byid=Object.fromEntries(models.map(x=>[x.BoatModelID,x]));
const mc=JSON.parse(fs.readFileSync('developer/reports/data-health-measurement-conflicts-v6.80.json','utf8'));
const yc=JSON.parse(fs.readFileSync('developer/reports/data-health-year-conflicts-v6.80.json','utf8'));
const mf=JSON.parse(fs.readFileSync('data/data-manifest.json','utf8'));
assert.strictEqual(mf.Release,'v6.80.0');
assert.strictEqual(mc.ConflictCount,10);
assert.strictEqual(yc.ConflictCount,1);
assert.strictEqual(yc.Conflicts[0].BoatModelID,'MRTR-40-DC');
for(const c of mc.Conflicts) assert.strictEqual(byid[c.BoatModelID][c.Field],null,`${c.BoatModelID} ${c.Field} should remain canonical null`);
// Previously researched canonical values must have synchronized compatibility mirrors.
const bc=byid['BKCV-32'];
assert(Math.abs(bc.LOA_ft-37)<0.01 && Math.abs(bc.LengthFt-37)<0.01,'Back Cove 32 LOA mirrors');
const duff=byid['DUFF-37'];
assert(Math.abs(duff.Beam_ft-13.1667)<0.01 && Math.abs(duff.BeamFt-13.1667)<0.01,'Duffy 37 beam mirrors');
console.log('v6.80.0 reconciliation tests passed');
