'use strict';
// Entirely local transports; no production requests or writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const {sha}=require('../developer/public-model-artifacts.cjs');
const {releaseFetch,contextGlobals}=require('./catalogue-fixture.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),plain=x=>JSON.parse(JSON.stringify(x));
const endpoint='https://api.b-atlas.org/api/public/overlays',manifestPath='data/generated/models/manifest.json';
const blank={modelPatches:{},addedModels:[],addedManufacturers:[],resourceAdditions:[]};
const response=value=>({ok:true,json:async()=>plain(value),text:async()=>JSON.stringify(value)});
const missing={ok:false,status:404};
function runtime(fetch,previous=false){
 const ctx={...contextGlobals,console,fetch,URL};ctx.window=ctx;ctx.globalThis=ctx;
 for(const file of ['canonicaldata.js','valuenormalizer.js','filterengine.js','actionmodel.js','datarepository.js','knowledge/knowledgecardui.js','communityapi.js']){
  const source=previous&&file==='datarepository.js'?cp.execFileSync('git',['show','427c46d:'+file],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
  vm.runInNewContext(source,ctx,{filename:file});
 }
 return ctx;
}
const profiles=[{}, {fuels:['Diesel']},{propulsion:['Shaft']},{constructionMaterials:['Fiberglass']},{engineCounts:[1]},{engineCounts:[2]},{minLength:24,maxLength:40,maxAirDraft:15},{routes:['RC']},{textSearch:'Mainship'},{featurePriorities:{'Wide Side Decks':'Required','Separate Shower':'Preferred'}},{preferencePolicyVersion:4,featurePriorities:{'Wide Side Decks':'Important','Separate Shower':'Preferred'}},{fuels:['Diesel'],featurePriorities:{'Wide Side Decks':'Important'}},{propulsion:['Shaft'],maxLength:40},{crewComposition:'TwoCouples',guestFrequency:'Often'},{featurePriorities:{'Single Engine':'Important','Twin Engines':'Important'}}];
function sign(m){m.release=sha(JSON.stringify({format:m.format,sourceDigest:m.sourceDigest,baselineVersion:m.baselineVersion,modelCount:m.modelCount,shards:m.shards,modelToShard:m.modelToShard,datasets:m.datasets,search:m.search}));return m;}
async function small(label='A',overlay=blank){
 const values={'boatmodels.json':[{BoatModelID:'BASE',Model:label,FuelCode:'fuel.diesel',Overview:'Complete guidance',EvidenceSummary:{Statements:['Retain provenance']}}], 'data/production-phases.json':[{BoatModelID:'BASE',Sequence:1,Label:label}], 'data/registry/manufacturers.json':[{CanonicalName:'Base'}]};
 return releaseFetch(async url=>response(url===endpoint?overlay:values[url]||[]));
}
(async()=>{
 const raw=async url=>response(url===endpoint?blank:read(url));
 const generated=await releaseFetch(raw),calls=new Map();let active=0,maxActive=0;
 const fetch=async(url,options)=>{
  calls.set(url,(calls.get(url)||0)+1);
  if(url.startsWith('data/generated/')&&url!==manifestPath){active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setImmediate(r));try{return await generated(url,options);}finally{active--;}}
  return generated(url,options);
 };
 const ctx=runtime(fetch),repo=ctx.BScoutDataRepository.getRepository();
 const contributionSource=fs.readFileSync('contributionentry.js','utf8');
 const contributionContext={root:ctx,console,modelCatalog:null};
 vm.runInNewContext(contributionSource.slice(contributionSource.indexOf('    async function loadModels()'),contributionSource.indexOf('    function hidePrimaryViews()')),contributionContext);
 const [data,baseline,cards,contributions,overlay]=await Promise.all([repo.loadApplicationData(),repo.loadBaseline(),ctx.BScoutKnowledgeUI.loadKnowledgeCards(),contributionContext.loadModels(),ctx.BScoutCommunityAPI.publicOverlays()]);
 assert.equal(data.boats.length,995);assert.equal(cards.length,995);assert.equal(contributions.length,995);assert.equal(maxActive,4);
 assert.equal(calls.get(manifestPath),1);assert.equal(calls.get(endpoint),1);assert(!calls.has('boatmodels.json'));
 for(const [file,count] of calls)assert.equal(count,1,'Repeated shared request: '+file);
 assert.deepEqual(plain(baseline.boats),read('boatmodels.json'));assert(Object.isFrozen(baseline.boats[0].EvidenceSummary));
 const old=runtime(raw,true),before=await old.BScoutDataRepository.loadApplicationData({fetchImpl:raw});
 for(const key of Object.keys(old.BScoutDataRepository.DEFAULT_MANIFEST))assert.deepEqual(plain(data[key]),plain(before[key]),'Dataset changed: '+key);
 let evaluations=0;
 for(const profile of profiles){
  const previous=old.BScoutFilterEngine.filterBoats(before.boats,profile,before.routes,{}),current=ctx.BScoutFilterEngine.filterBoats(data.boats,profile,data.routes,{});
  assert.deepEqual(plain(current.map(b=>b.BoatModelID)),plain(previous.map(b=>b.BoatModelID)),'Membership or tie ordering changed');
  for(let i=0;i<data.boats.length;i++){
   const a=old.BScoutFilterEngine.evaluateBoat(before.boats[i],profile,before.routes,{}),b=ctx.BScoutFilterEngine.evaluateBoat(data.boats[i],profile,data.routes,{});
   assert.deepEqual(plain(b),plain(a),'Assessment changed: '+data.boats[i].BoatModelID);
   assert.deepEqual(plain(ctx.generateBuyerActions(b)),plain(old.generateBuyerActions(a)),'Buyer actions changed');evaluations++;
  }
 }
 const updates={...blank,modelPatches:{BASE:{BoatModelID:'FORGED',FuelCode:'fuel.gasoline',Overview:'Published patch'}},addedModels:[{BoatModelID:'ADDED',Overview:'Added guidance'},{BoatModelID:'BASE'}],addedManufacturers:[{CanonicalName:'BASE'},{CanonicalName:'Added'}],resourceAdditions:[{BoatModelID:'BASE',url:'https://example.test/manual',group:'documents',title:'Manual'}]};
 const overlayFetch=await small('A',updates),overlayCtx=runtime(overlayFetch),overlayRepo=overlayCtx.BScoutDataRepository.getRepository();
 const effective=await overlayRepo.loadApplicationData();
 assert.equal(effective.boats.length,2);assert.equal(effective.manufacturers.length,2);
 assert.equal((await overlayRepo.getModel('BASE')).Overview,'Published patch');assert.equal((await overlayRepo.getModel('BASE')).NormalizedFuel,'fuel.gasoline');
 assert.equal((await overlayRepo.loadBaseline()).boats[0].Overview,'Complete guidance');
 for(let i=0;i<3;i++){const resources=await overlayCtx.BScoutKnowledgeUI.loadCuratedResources();assert.equal(resources[0].documents.length,1);assert.equal((await overlayRepo.getModel('BASE')).BoatModelID,'BASE');}
 assert.equal((await overlayRepo.loadBaseline()).curatedResources.length,0);
 assert.equal((await overlayCtx.BScoutKnowledgeUI.loadKnowledgeCards()).find(c=>c.identity.boatModelId==='BASE').intelligence.overview,'Published patch');
 // Invalid required releases reject completely. Recovery reuses no partial rows.
 const good=await small(),baseManifest=await (await good(manifestPath)).json();let failureCases=0;
 async function rejects(transform,pattern){const request=async(url,options)=>transform(url,await good(url,options));const r=runtime(request).BScoutDataRepository.createRepository({fetchImpl:request,timeoutMs:20});await assert.rejects(r.loadApplicationData(),pattern);failureCases++;}
 await rejects((u,r)=>u===baseManifest.search.shards[0].path?missing:r,/unavailable/);
 await rejects((u,r)=>u===baseManifest.search.shards[0].path?{ok:true,text:async()=> 'corrupt'}:r,/byte count/);
 await rejects((u,r)=>u===baseManifest.search.shards[0].path?{ok:true,text:async()=>{const text=await r.text();return text.replace('BASE','FAIL');}}:r,/checksum/);
 await rejects((u,r)=>u===manifestPath?response({...baseManifest,release:'0'.repeat(64)}):r,/identity/);
 await rejects((u,r)=>u===manifestPath?response(sign({...plain(baseManifest),modelCount:2})):r,/model count/);
 await rejects((u,r)=>u===manifestPath?response(sign({...plain(baseManifest),search:{...plain(baseManifest.search),modelToShard:{BASE:10}}})):r,/routing/);
 await rejects((u,r)=>u===manifestPath?response({...baseManifest,schemaVersion:1}):r,/Unsupported/);
 await rejects((u,r)=>u===baseManifest.search.shards[0].path?new Promise(()=>{}):r,/timed out/);
 const duplicate=plain(baseManifest),rows=JSON.parse(await (await good(duplicate.shards[0].path)).text());rows.push(rows[0]);const text=JSON.stringify(rows),hash=sha(text),d=duplicate.search.shards[0];d.path='data/generated/models/000-'+hash+'.json';d.sha256=hash;d.bytes=Buffer.byteLength(text);d.records=2;duplicate.modelCount=2;sign(duplicate);
 await rejects((u,r)=>u===manifestPath?response(duplicate):u===d.path?response(rows):r,/duplicate/);
 // A stale release with missing immutable files retries the entire manifest.
 const newer=await small('B');let manifests=0;
 const modes=[];
 const switching=async(u,o)=>{modes.push({url:u,cache:o?.cache,attempt:manifests});return u===manifestPath?(++manifests===1?good(u,o):newer(u,o)):manifests===1&&u===baseManifest.search.shards[0].path?missing:manifests===1?good(u,o):newer(u,o);};
 const switched=await runtime(switching).BScoutDataRepository.getRepository().loadApplicationData();
 assert.equal(manifests,2);assert.equal(switched.boats[0].Model,'B');assert.equal(switched.productionPhases[0].Label,'B');
 assert(modes.some(m=>m.attempt===1&&m.cache==='force-cache'));assert(modes.some(m=>m.attempt===2&&m.cache==='reload'));
 let available=false;
 const recoverable=async(u,o)=>available?good(u,o):missing,recovery=runtime(recoverable).BScoutDataRepository.getRepository();
 await assert.rejects(recovery.loadApplicationData());available=true;assert.equal((await recovery.loadApplicationData()).boats.length,1);
 // Optional API timeout is bounded and preserves a complete static catalogue.
 const noOverlay=async(u,o)=>u===endpoint?new Promise(()=>{}):good(u,o),optional=runtime(noOverlay).BScoutDataRepository.createRepository({fetchImpl:noOverlay,overlayTimeoutMs:10});
 assert.equal((await optional.loadApplicationData()).boats[0].Model,'A');assert.equal(await optional.loadOverlay(),null);
 let version=good;
 const refreshing=runtime((u,o)=>version(u,o)).BScoutDataRepository.getRepository();
 assert.equal((await refreshing.loadApplicationData()).boats[0].Model,'A');version=newer;
 assert.equal((await refreshing.loadApplicationData()).boats[0].Model,'A');refreshing.invalidate();assert.equal((await refreshing.loadApplicationData()).boats[0].Model,'B');
 // Moderator baseline failure prevents any write; reconciliation requires an overlay.
 let writes=0;
 const mod=runtime(async()=>{writes++;return response({});});mod.sessionStorage={getItem:()=> 'local-test-token',removeItem(){}};
 mod.BScoutDataRepository={getRepository:()=>({loadBaseline:async()=>{throw Error('Required baseline failed');}})};
 vm.runInNewContext(fs.readFileSync('developer/moderatorapi.js','utf8'),mod);
 await assert.rejects(mod.BScoutCommunityAPI.promote({}),/baseline failed/);assert.equal(writes,0);
 // A successful local mock promotion receives the untouched baseline, then invalidates.
 let invalidations=0,submitted;
 mod.BScoutDataRepository={getRepository:()=>({loadBaseline:async()=>({boats:[{BoatModelID:'BASE',Model:'raw'}],manufacturers:[]}),invalidate(){invalidations++;}})};
 mod.fetch=async(u,o)=>{submitted=JSON.parse(o.body);return response({ok:true});};await mod.BScoutCommunityAPI.promote({ContributionID:'TEST'});
 assert.equal(submitted.baseline.models[0].Model,'raw');assert.equal(invalidations,1);
 console.log(JSON.stringify({status:'PASS',models:995,profiles:profiles.length,evaluations,fullAssessmentAndActionEquivalence:true,sharedRequests:calls.size,maxConcurrentShards:maxActive,failureCases,overlayHydrationAndResourceIntegrity:true,wholeReleaseRetry:true,retryAfterRejection:true,moderatorNoWriteOnFailure:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
