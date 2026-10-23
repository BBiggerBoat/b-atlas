'use strict';
const {modelCount}=require('./catalogue-evolution.cjs');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const s={console};s.window=s;s.globalThis=s;
for(const file of ['canonicaldata.js','valuenormalizer.js','filterengine.js','engine.js','searchstatemanager.js','searchprofilemanager.js','datarepository.js'])vm.runInNewContext(read(file),s,{filename:file});
const evaluate=(b,p,r=[])=>s.BScoutFilterEngine.evaluateBoat(b,p,r,{});
const cases=json('tests/fixtures/phase3-audit-cases.json');assert.equal(cases.length,103);
for(const c of cases){
 if(c.kind==='filter')assert.equal(evaluate(c.boat,c.profile,c.routes|| (c.id.startsWith('joint-route')?[{RouteID:'TEST',MaxLengthFt:30,MaxBeamFt:11}]:c.id==='route-null-dimensions'?[{RouteID:'TEST',MaxLengthFt:30,MaxBeamFt:10,MaxDraftFt:5,MaxAirDraftFt:10}]:c.id==='route-known-incompatible'?[{RouteID:'TEST',MaxBeamFt:10}]:[])).passes,c.expectedRetained,c.id);
 else if(c.id==='missing-feature-uncertainty-label')assert(evaluate({}, {featurePriorities:{'Separate Shower':'Required'}}).preference.preferences[0].unknown);
 else if(c.id==='buyer-explanation-stale-legacy-drive'){
  const script=read('script.js'),a=script.indexOf('function calculateBScoutScore('),b=script.indexOf('\n}',a)+2;vm.runInNewContext(script.slice(a,b),s);
  assert(!s.calculateBScoutScore({FuelCode:'fuel.diesel',Fuel:'Gas',MechanicalPropulsionCode:'mechanical_propulsion.outboard',Propulsion:'Shaft'}).reasons.some(r=>r.includes('shaft')));
 }else if(c.kind==='state'){
  s.BScoutSearchState.setSearchSettings(c.before);const result=s.BScoutSearchState.captureFromDocument({getElementById:()=>null,querySelectorAll:()=>[]}).searchSettings;
  for(const key of Object.keys(c.before))assert.deepEqual(JSON.parse(JSON.stringify(result[key])),c.before[key],c.id+key);
 }else if(c.kind==='ui-event-binding'){
  for(const width of [390,680,768,1440]){
   let count=0;const events={},ctx={console,document:{querySelector:()=>({dataset:{},addEventListener:(n,fn)=>events[n]=fn}),getElementById:()=>({addEventListener:()=>{}})},runCurrentSearch:()=>count++,setTimeout:fn=>fn(),clearTimeout:()=>{}};ctx.window=ctx;ctx.matchMedia=()=>({matches:width<=680});const script=read('script.js'),a=script.indexOf('(function bindMobileLiveFiltering()'),b=script.indexOf('})();',a)+5;vm.runInNewContext(script.slice(a,b),ctx);events.change({target:{id:'fuel',matches:()=>true}});assert.equal(count,1,'Live filter at '+width);
  }
 }else throw Error('Uncovered audit case '+c.id);
}
// Additional safeguards for option scope, category parents, independent known values and uncertainty labels.
const extra=[
 ['confirmed',{FuelCode:'fuel.diesel'},{fuels:['Diesel']},'confirmed'],
 ['unknown',{FuelCode:null},{fuels:['Diesel']},'unknown'],
 ['conditional',{ProductionPhases:[{FactOverrides:[{FieldID:'Beam',ValueState:'known',CanonicalValue:2}]},{FactOverrides:[{FieldID:'Beam',ValueState:'known',CanonicalValue:4}]}]},{maxBeam:10},'configuration-dependent'],
 ['pod subtype',{MechanicalPropulsionCode:'mechanical_propulsion.zeus_pod'},{propulsion:['Pod']},'confirmed'],
 ['fiberglass composite',{HullMaterialCode:'hull_material.fiberglass_composite'},{constructionMaterials:['Fiberglass']},'confirmed'],
 ['null authoritative blocks stale fuel',{FuelCode:null,Fuel:'Diesel'},{fuels:['Gas']},'unknown'],
 ['uncertain boolean no',{Trailerable:'Unknown'},{trailerable:'No'},'unknown'],
 ['no numeric parsing of optional package',{EngineCount:'1 or 2'},{engineCounts:[2]},'unknown'],
 ['incomplete known fuel retained as constraint',{FuelCode:'fuel.gasoline',VerifiedConfigurations:[{EngineCount:2}]},{fuels:['Diesel']},'excluded'],
 ['missing option engine count',{VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{EngineCount:2},{}]},{engineCounts:[1]},'unknown'],
 ['empty category array',{FuelCode:[]},{fuels:['Diesel']},'unknown'],
 ['unknown inboard subtype',{MechanicalPropulsionCode:'propulsion.inboard'},{propulsion:['Shaft']},'unknown'],
 ['inboard incompatible with outboard',{MechanicalPropulsionCode:'propulsion.inboard'},{propulsion:['Outboard']},'excluded'],
 ['known shaft within inboard',{MechanicalPropulsionCode:'mechanical_propulsion.shaft'},{propulsion:['Inboard']},'confirmed'],
 ['unlinked alternative arrays',{FuelCode:['fuel.diesel','fuel.gasoline'],MechanicalPropulsionCode:['mechanical_propulsion.shaft','mechanical_propulsion.sterndrive']},{fuels:['Diesel'],propulsion:['Stern Drive']},'unknown'],
 ['uncertain fuel prose',{FuelCode:'Diesel or Gasoline'},{fuels:['Diesel']},'unknown'],
 ['low confidence fuel',{FuelCode:'fuel.gasoline',SpecificationConfidence:{FuelCode:{Level:'Low',Status:'estimated'}}},{fuels:['Diesel']},'unknown'],
 ['dimension boundary tolerance',{LOA:30*0.3048},{maxLength:30},'confirmed'],
 ['known option and phase not linked',{ProductionPhases:[{ProductionPhaseID:'A',FactOverrides:[{FieldID:'LOA',ValueState:'known',CanonicalValue:8}]},{ProductionPhaseID:'B',FactOverrides:[{FieldID:'LOA',ValueState:'known',CanonicalValue:12}]}],VerifiedConfigurations:[{FuelCode:'fuel.diesel'}],VerifiedConfigurationsComplete:true},{maxLength:30,fuels:['Diesel']},'unknown'],
 ['explicit option phase linkage',{ProductionPhases:[{ProductionPhaseID:'A',FactOverrides:[{FieldID:'LOA',ValueState:'known',CanonicalValue:8}]},{ProductionPhaseID:'B',FactOverrides:[{FieldID:'LOA',ValueState:'known',CanonicalValue:12}]}],VerifiedConfigurations:[{ProductionPhaseID:'A',FuelCode:'fuel.gasoline'},{ProductionPhaseID:'B',FuelCode:'fuel.diesel'}],VerifiedConfigurationsComplete:true},{maxLength:30,fuels:['Diesel']},'excluded'],
 ['canonical flybridge overrides old description',{FlybridgeCode:'availability.no',Flybridge:'Yes'},{flybridge:'Yes'},'excluded'],
 ['uncertain layout alternatives',{Configuration:'Aft Cabin or Express Cruiser'},{configurations:['Express Cruiser']},'unknown'],
 ['slash V-drive alias',{MechanicalPropulsionCode:'Shaft/V-Drive'},{propulsion:['Shaft']},'confirmed'],
 ['known option plus uncertain alternative',{VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{FuelCode:'fuel.diesel'},{}]},{fuels:['Diesel']},'configuration-dependent']
];
for(const [name,b,p,status]of extra)assert.equal(evaluate(b,p).match.status,status,name);
const boats=json('boatmodels.json'),phases=json('data/production-phases.json'),routes=json('routes.json');assert.equal(boats.length,modelCount);assert.equal(new Set(boats.map(b=>b.BoatModelID)).size,modelCount);
let evaluated=0;const profiles=[{fuels:['Diesel']},{fuels:['Gas']},{propulsion:['Shaft']},{propulsion:['Outboard']},{propulsion:['Stern Drive']},{engineCounts:[1]},{engineCounts:[2]},{hullTypes:['Planing']},{hullTypes:['Full Displacement']},{hullTypes:['Semi-Displacement']},{constructionMaterials:['Fiberglass']},{boatFamilies:['Trawler']},{configurations:['Express Cruiser']},{minLength:24,maxLength:40,minBeam:8,maxBeam:14},{routes:['RC']}];
for(const b of boats){const row=s.BScoutDataRepository.applyCanonicalCompatibility({...b,ProductionPhases:phases.filter(p=>p.BoatModelID===b.BoatModelID)});for(const p of profiles){const r=evaluate(row,p,routes);assert.equal(typeof r.passes,'boolean');assert(r.match.status);evaluated++;}
 if(/\.v_drive$/.test(b.MechanicalPropulsionCode))assert(evaluate(row,{propulsion:['Shaft']}).passes,b.BoatModelID);
 if(b.HullMaterialCode==='hull_material.fiberglass')assert(evaluate(row,{constructionMaterials:['Fiberglass']}).passes,b.BoatModelID);
}
// Preserve every historical field without requiring later catalogues to have the
// same aggregate file hashes as an optional receipt outside this repository.
require('./catalogue-evolution.cjs').assertHistorical(boats,require('../developer/historical-fixtures.cjs').json('pre-storage-models'));
console.log(JSON.stringify({status:'PASS',auditCases:103,additionalCases:extra.length,catalogue:modelCount,filterEvaluations:evaluated,historicalCanonicalDataUnchanged:true}));
