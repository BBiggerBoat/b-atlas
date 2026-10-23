'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {releaseFetch,contextGlobals}=require('./catalogue-fixture.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),plain=v=>JSON.parse(JSON.stringify(v));
const endpoint='https://api.b-atlas.org/api/public/overlays';
(async()=>{
 const models=read('boatmodels.json'),overlay={modelPatches:{[models[0].BoatModelID]:{Overview:'Published detail',BoatModelID:'FORGED'}},addedModels:[{BoatModelID:'LOCAL',Model:'Added',Active:true,Overview:'Complete addition'}],addedManufacturers:[]};
 const transport=await releaseFetch(async url=>({ok:true,json:async()=>url===endpoint?overlay:read(url)}));
 const calls=new Map();let bytes=0;
 const fetch=async(url,options)=>{calls.set(url,(calls.get(url)||0)+1);const r=await transport(url,options);if(url!==endpoint&&r.ok){const length=Buffer.byteLength(await r.text());bytes+=length;}return r;};
 const ctx={...contextGlobals,fetch,console};ctx.window=ctx;ctx.globalThis=ctx;
 for(const file of ['canonicaldata.js','valuenormalizer.js','filterengine.js','actionmodel.js','modelknowledgescore.js','intelligencelayer.js','datarepository.js','knowledge/knowledgecardui.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
 const repo=ctx.BScoutDataRepository.getRepository(),search=await repo.loadSearchData(),initialBytes=bytes;
 const manifest=await (await transport('data/generated/models/manifest.json')).json();
 const measured=[...calls.keys()].filter(u=>u!==endpoint);const expectedBytes=(await Promise.all(measured.map(async u=>Buffer.byteLength(await (await transport(u)).text())))).reduce((a,b)=>a+b,0);assert.equal(initialBytes,expectedBytes);assert.equal(manifest.search.shards.filter(d=>calls.has(d.path)).length,manifest.search.shards.length);
 assert.equal(search.boats.length,996);assert.equal(calls.get(endpoint),1);
 for(const d of manifest.shards)assert(!calls.has(d.path),'Startup fetched full detail');
 for(const name of ctx.BScoutDataRepository.DEFERRED_DATASETS)for(const d of manifest.datasets[name].shards)assert(!calls.has(d.path),'Startup fetched resources');
 const projectedSnapshot=JSON.stringify(search.boats);
 const [detail,again,card]=await Promise.all([repo.getModel(models[0].BoatModelID),repo.getModel(models[0].BoatModelID),ctx.BScoutKnowledgeUI.loadCardForBoat(search.boats[0])]);
 assert.strictEqual(detail,again);assert.equal(detail.Overview,'Published detail');assert.equal(detail.BoatModelID,models[0].BoatModelID);assert.equal(card.intelligence.overview,'Published detail');
 assert.equal(JSON.stringify(search.boats),projectedSnapshot,'Hydration modified search records');
 assert.equal(search.boats.length,996);assert.equal(calls.get(endpoint),1);
 const detailCalls=manifest.shards.filter(d=>calls.has(d.path));assert.equal(detailCalls.length,1);assert.equal(calls.get(detailCalls[0].path),1);
 assert.equal((await repo.getModel('LOCAL')).Overview,'Complete addition');assert.equal(await repo.getModel('missing'),null);
 for(const id of ['__proto__','constructor','toString'])assert.equal(await repo.getModel(id),null,'Inherited object keys must not be model routing entries');
 const full=await repo.loadApplicationData();
 for(const index of [0,17,400,700,994])assert.deepEqual(plain(await repo.getModel(models[index].BoatModelID)),plain(full.boats[index]),'Hydrated record differs from complete application record');
 const profiles=[{}, {fuels:['Diesel']},{propulsion:['Shaft']},{constructionMaterials:['Fiberglass']},{engineCounts:[1]},{engineCounts:[2]},{minLength:24,maxLength:40,maxAirDraft:15},{routes:['RC']},{textSearch:'Mainship'},{featurePriorities:{'Wide Side Decks':'Required','Separate Shower':'Preferred'}},{featurePriorities:{'Wide Side Decks':'Important','Separate Shower':'Preferred'}},{fuels:['Diesel'],featurePriorities:{'Wide Side Decks':'Important'}},{propulsion:['Shaft'],maxLength:40},{crewComposition:'TwoCouples',guestFrequency:'Often'},{featurePriorities:{'Single Engine':'Important','Twin Engines':'Important'}}];
 let assessments=0;
 for(const profile of profiles){
  assert.deepEqual(plain(ctx.BScoutFilterEngine.filterBoats(search.boats,profile,search.routes,{}).map(b=>b.BoatModelID)),plain(ctx.BScoutFilterEngine.filterBoats(full.boats,profile,full.routes,{}).map(b=>b.BoatModelID)));
  for(let i=0;i<models.length;i++){
   const projected=ctx.BScoutFilterEngine.evaluateBoat(search.boats[i],profile,search.routes,{}),complete=ctx.BScoutFilterEngine.evaluateBoat(full.boats[i],profile,full.routes,{});
   assert.deepEqual(plain(projected),plain(complete));assert.deepEqual(plain(ctx.generateBuyerActions(projected)),plain(ctx.generateBuyerActions(complete)));assessments++;
  }
 }
 for(let i=0;i<models.length;i++)assert.deepEqual(plain(ctx.BAtlasModelKnowledgeScore.scoreModel(search.boats[i])),plain(ctx.BAtlasModelKnowledgeScore.scoreModel(full.boats[i])));
 for(let i=0;i<models.length;i++)assert.deepEqual(plain(ctx.BScoutIntelligenceLayer.buildModelKnowledgeSummary(search.boats[i])),plain(ctx.BScoutIntelligenceLayer.buildModelKnowledgeSummary(full.boats[i])),'Result-card knowledge explanation changed');
 // An unknown future key is preserved; optional configuration metadata cannot disappear.
 const synthetic={BoatModelID:'CONFIG',VerifiedConfigurationsComplete:true,VerifiedConfigurations:[{EngineCount:1,SpecificationConfidence:{EngineCount:{Level:'High',Status:'verified'}}}],FutureScopedConfiguration:{a:false,b:0,c:null},Overview:'detail'};
 const projected=ctx.BScoutDataRepository.projectSearchModel(synthetic);assert.deepEqual(plain(projected.VerifiedConfigurations),synthetic.VerifiedConfigurations);assert.deepEqual(plain(projected.FutureScopedConfiguration),synthetic.FutureScopedConfiguration);assert(!Object.hasOwn(projected,'Overview'));
 // A lazy failure leaves all candidates available and can be retried in the same release.
 let broken=true;
 const failing=async(u,o)=>broken&&u===manifest.shards[0].path?{ok:false}:transport(u,o);
 const retry=ctx.BScoutDataRepository.createRepository({fetchImpl:failing});
 const retained=await retry.loadSearchData();await assert.rejects(retry.getModel(models[0].BoatModelID));assert.equal(retained.boats.length,996);broken=false;assert.equal((await retry.getModel(models[0].BoatModelID)).Overview,'Published detail');
 console.log(JSON.stringify({status:'PASS',models:995,profiles:15,assessments,initialBytes,firstDetailShardBytes:detailCalls[0].bytes,fullDetailRequestsAtStartup:0,resourceRequestsAtStartup:0,oneOverlay:true,hydrationPreservesCandidatesAndPatches:true,lazyFailureRetry:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
