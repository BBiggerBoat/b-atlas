const fs=require('fs'), assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(require('path').join(root,p),'utf8'));
const models=read('boatmodels.json'), registry=read('data/registry/boat-registry.json'), families=read('data/model-families.json'), manifest=read('data/data-manifest.json');
assert.strictEqual(models.length,259,'model count must remain 259');
assert.strictEqual(families.length,16,'16 overlapping identity families expected');
assert.strictEqual(manifest.Release,'v6.81.0');
const legacy=['LOA_ft','LengthFt','LWL_ft','Beam_ft','BeamFt','Draft_ft','DraftFt','AirDraft_ft','Headroom_ft','Displacement_lb','YearStart','YearEnd'];
for(const m of models) for(const k of legacy) assert.ok(!Object.prototype.hasOwnProperty.call(m,k),`${m.BoatModelID} still stores ${k}`);
for(const f of families){
 assert.ok(f.ModelIdentityFamilyID && f.MemberBoatModelIDs.length>=2);
 for(const id of f.MemberBoatModelIDs){
  const m=models.find(x=>x.BoatModelID===id), r=registry.find(x=>x.BoatModelID===id);
  assert.ok(m && r,`missing family member ${id}`);
  assert.strictEqual(m.ModelIdentityFamilyID,f.ModelIdentityFamilyID);
  assert.strictEqual(r.ModelIdentityFamilyID,f.ModelIdentityFamilyID);
 }
}
// No alias within a family may ambiguously resolve to multiple member records.
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
for(const f of families){
 const seen=new Map();
 for(const id of f.MemberBoatModelIDs){
  const r=registry.find(x=>x.BoatModelID===id);
  for(const a of (r.Aliases||[])){
   const k=norm(a); if(!k)continue;
   assert.ok(!seen.has(k),`ambiguous alias '${a}' in family ${f.ModelIdentityFamilyID}`);
   seen.set(k,id);
  }
 }
}
const cut=models.find(x=>x.BoatModelID==='CUTW-30-P');
assert.ok(Math.abs(cut.LOA-10.8712)<0.002,'Cutwater rigged LOA should be canonical');
for(const id of ['CHBB-34-SE','CHBB-34-TC']){
 const m=models.find(x=>x.BoatModelID===id);
 assert.ok(Math.abs(m.LOA-10.2108)<0.001 && Math.abs(m.Beam-3.5814)<0.001 && Math.abs(m.Draft-1.0668)<0.001,`${id} dimensions not reconciled`);
}
console.log('v6.81.0 identity consolidation tests passed');
