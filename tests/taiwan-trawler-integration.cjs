'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const store=require('../developer/canonical-store.cjs');
const {additionIDs,historicalCount,modelCount}=require('./catalogue-evolution.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),models=store.load();
assert.equal(models.length,modelCount);
assert.deepEqual(models.slice(historicalCount).map(m=>m.BoatModelID),additionIDs);
const registry=read('data/registry/boat-registry.json'),manufacturers=read('data/registry/manufacturers.json'),aliases=read('data/model-search-aliases.json');
assert.equal(new Set(models.map(m=>m.CanonicalSlug)).size,modelCount);
const staged=read('research/taiwan-trawler-seven-2026-10-23.json').candidates;
// Independently pinned identity, dimensions and representative installations.
const expected=[
 ['PRES-41-DC','President',1982,1987,12.3444,4.0894,0.8636,2],
 ['PRES-42-TR','President',2002,2006,13.5128,4.3434,1.0668,2],
 ['OCAL-42-SE','Ocean Alexander',1986,1993,12.8016,4.3688,0.9652,2],
 ['DEFE-44-OC','DeFever',1981,2007,13.335,4.4958,1.397,2],
 ['MRTR-40-SU','Marine Trader',1983,2000,11.9888,3.937,1.2192,null],
 ['CHBY-38-DC','CHB',1978,1985,11.5316,4.1148,1.0668,null],
 ['KHAS-40-SU','Kha Shing',1980,1988,12.0396,4.2672,1.0922,2]
];
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [id,manufacturer,first,last,loa,beam,draft,engines]of expected){
 const row=models.find(m=>m.BoatModelID===id),candidate=staged.find(c=>c.proposedID===id);
 assert.equal(row.Manufacturer,manufacturer);assert.equal(row.FirstYear,first);assert.equal(row.LastYear,last);
 near(row.LOA,loa);near(row.Beam,beam);near(row.Draft,draft);assert.equal(row.EngineCount,engines);
 for(const [field,source,factor]of [['Displacement','displacementLb',0.45359237],['FuelCapacity','fuelUSGal',3.785411784],['WaterCapacity','waterUSGal',3.785411784],['HoldingCapacity','holdingUSGal',3.785411784]]){
  if(candidate[source]===null)assert.equal(row[field],null);else near(row[field],candidate[source]*factor);
  assert(row.SpecificationConfidence[field].EvidenceRefs.length);
 }
 for(const field of ['AirDraft','EnginePowerPerEngine','TotalInstalledPower','CruiseSpeed','MaxSpeed','Range','GreatLoopSuitable','OffshoreRating','Builder','BuilderCountryCode'])assert.equal(row[field],null,`${id}: unsupported ${field}`);
 assert.equal(row.FuelCode,'fuel.diesel');assert.equal(row.Active,false);
 assert.equal(row.CanonicalPath,`/models/${row.CanonicalSlug}/`);assert.equal(row.CanonicalURL,'https://b-atlas.org'+row.CanonicalPath);
 assert.equal(row.ImageURL,'images/boat-placeholder.svg');assert(fs.existsSync(row.ImageURL));
 assert(row.EvidenceSummary.Statements[0].EvidenceRefs.every(url=>url.startsWith('https://')));
 assert.deepEqual(row.EvidenceSummary.UnresolvedInformation,candidate.unresolved);
 const identity=registry.filter(r=>r.BoatModelID===id);assert.equal(identity.length,1);
 assert.equal(identity[0].CanonicalName,row.Nickname);assert.equal(identity[0].RedirectTo,null);
 assert(manufacturers.some(m=>m.ManufacturerCode===identity[0].ManufacturerCode&&m.CanonicalName===manufacturer));
 assert.equal(aliases.filter(a=>a.BoatModelID===id).length,1);
 // Every addition must be present in all four authoritative domains exactly once.
 for(const domain of Object.values(store.split(models)))assert.equal(domain.filter(r=>r.BoatModelID===id).length,1);
}
const byID=id=>models.find(m=>m.BoatModelID===id);
assert.equal(byID('OCAL-42-SE').HullBehaviourCode,null,'Modified-V alone cannot establish behaviour');
assert.equal(byID('DEFE-44-OC').HullBehaviourCode,'hull_behaviour.displacement');
assert.notEqual(byID('CHBY-38-DC').Beam,byID('MRTR-38-SD').Beam);
assert.notEqual(byID('MRTR-40-SU').CanonicalSlug,byID('MRTR-40-DC').CanonicalSlug);
const khaAliases=['Spindrift 40 Sundeck','Vista 40 Sundeck','Southern Star 40 Sundeck'];
assert.deepEqual(byID('KHAS-40-SU').ModelAliases,khaAliases);
for(const alias of khaAliases){
 assert.equal(models.filter(m=>(m.ModelAliases||[]).includes(alias)).length,1);
 assert.deepEqual(registry.filter(r=>(r.Aliases||[]).includes(alias)).map(r=>r.BoatModelID),['KHAS-40-SU']);
}
const ctx={console};ctx.window=ctx;ctx.globalThis=ctx;
for(const file of ['canonicaldata.js','valuenormalizer.js','datarepository.js','filterengine.js','imageassetmanager.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
for(const id of additionIDs)assert.equal(ctx.ImageAssetManager.resolveBoatImage(byID(id)),'images/boat-placeholder.svg','Explicit placeholder must not become a nonexistent model JPG');
for(const id of ['MRTR-40-SU','CHBY-38-DC'])for(const n of [1,2]){
 const row=ctx.BScoutDataRepository.applyCanonicalCompatibility({...byID(id),ProductionPhases:[]});
 const assessment=ctx.BScoutFilterEngine.evaluateBoat(row,{engineCounts:[n]},[],{});
 assert(assessment.passes,`${id}: variable engine count must remain unknown for ${n}`);
}
for(const textSearch of khaAliases){
 const matches=ctx.BScoutFilterEngine.filterBoats(models.map(row=>ctx.BScoutDataRepository.applyCanonicalCompatibility({...row,ProductionPhases:[]})),{textSearch},[],{});
 assert.equal(matches[0].BoatModelID,'KHAS-40-SU','Marketing alias must rank its canonical model first');
 assert.equal(matches.filter(m=>m.BoatModelID==='KHAS-40-SU').length,1,'Alias must not duplicate the canonical result');
}
console.log(JSON.stringify({status:'PASS',additions:additionIDs,models:modelCount,unitsVerified:true,aliasesDeduplicated:true,variableEnginesUnknown:true}));
