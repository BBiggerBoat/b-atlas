'use strict';
// Independent release audit: compare against checksum-verified original Git snapshot bytes, then run
// the actual published loaders, filter engine, knowledge providers and comparison renderer.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const historical=require('../developer/historical-fixtures.cjs');
const original=historical.json('original-models');
const current=read('boatmodels.json'),rules=read('data/canonical/ownership.json');
const {modelCount,historicalCount}=require('./catalogue-evolution.cjs');
const expected=structuredClone(original);
for(const change of read('reports/canonical-url-migration.json'))Object.assign(expected.find(m=>m.BoatModelID===change.BoatModelID),change.after);
const propulsionApprovals=read('reports/approved-propulsion-corrections.json').changes;
assert.equal(propulsionApprovals.length,8);assert.equal(new Set(propulsionApprovals.map(c=>c.BoatModelID)).size,8);
for(const change of propulsionApprovals){assert.equal(change.field,'MechanicalPropulsionCode');assert.equal(change.expectedValue,null);assert.equal(change.proposedValue,'mechanical_propulsion.outboard');const row=expected.find(m=>m.BoatModelID===change.BoatModelID);assert.equal(row[change.field],change.expectedValue);row[change.field]=change.proposedValue;}
require('./catalogue-evolution.cjs').assertHistorical(current,expected,'Historical data differs beyond approved URL and propulsion corrections');
// Addition semantics are independently checked by taiwan-trawler-integration.cjs.
expected.push(...current.slice(historicalCount));
assert.equal(current.length,modelCount);assert.equal(new Set(current.map(m=>m.BoatModelID)).size,modelCount);
assert.equal(new Set(current.map(m=>m.CanonicalSlug)).size,modelCount);
assert.deepEqual(require('../developer/canonical-store.cjs').load(),current);
for(const field of Object.keys(current[0]))if(field!=='BoatModelID')assert(Object.hasOwn(rules.fields,field));
const protectedResearch=historical.json('protected-research');
const digest=require('node:crypto').createHash;
function filesAt(rel){const stat=fs.statSync(rel);return stat.isDirectory()?fs.readdirSync(rel).flatMap(name=>filesAt(rel+'/'+name)):[rel];}
assert.deepEqual(protectedResearch.roots.flatMap(filesAt).sort(),Object.keys(protectedResearch.files).sort(),'Historical research file set changed');
for(const [file,expectedHash] of Object.entries(protectedResearch.files)){
 let content=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 if(['data/model-search-aliases.json','data/registry/boat-registry.json'].includes(file)){
  const rows=JSON.parse(content),{additionIDs}=require('./catalogue-evolution.cjs');
  assert.deepEqual(rows.filter(row=>additionIDs.includes(row.BoatModelID)).map(row=>row.BoatModelID),additionIDs,'Missing or duplicate integration identities: '+file);
  // Removing only the seven reviewed additions must recover the original bytes.
  content=JSON.stringify(rows.filter(row=>!additionIDs.includes(row.BoatModelID)),null,2)+'\n';
 }
 assert.equal(digest('sha256').update(content).digest('hex'),expectedHash,'Existing research changed: '+file);
}

const ctx={...require('./catalogue-fixture.cjs').contextGlobals,console,URL,AbortSignal};ctx.window=ctx;ctx.globalThis=ctx;
const blankOverlay={modelPatches:{},addedModels:[],addedManufacturers:[],resourceAdditions:[]};
ctx.fetch=async url=>String(url).startsWith('https://')?{ok:true,json:async()=>blankOverlay}:{ok:fs.existsSync('dist/'+String(url).split('?')[0]),json:async()=>read('dist/'+String(url).split('?')[0]),text:async()=>fs.readFileSync('dist/'+String(url).split('?')[0],'utf8')};
for(const file of ['canonicaldata.js','valuenormalizer.js','filterengine.js','searchstatemanager.js','searchorchestrator.js','datarepository.js','imageassetmanager.js','knowledge/knowledgeengine.js','knowledge/boatintelligencerepository.js','knowledge/providers/curatedresourceprovider.js','knowledge/providers/listingdiscoveryprovider.js','knowledge/providers/boatintelligenceprovider.js','knowledge/knowledgecardui.js','boatworkspace.js'])vm.runInNewContext(fs.readFileSync('dist/'+file,'utf8'),ctx,{filename:file});
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const data=await ctx.BScoutDataRepository.loadApplicationData({fetchImpl:ctx.fetch});
 assert.equal(data.boats.length,modelCount);
 const contributionSource=fs.readFileSync('dist/contributionentry.js','utf8');
 const contributionContext={console,root:ctx,fetch:ctx.fetch,modelCatalog:null};
 vm.runInNewContext(contributionSource.slice(contributionSource.indexOf('    async function loadModels()'),contributionSource.indexOf('    function hidePrimaryViews()')),contributionContext);
 const contributionCatalog=await contributionContext.loadModels();
 assert.equal(contributionCatalog.length,modelCount);assert.equal(new Set(contributionCatalog.map(m=>m.id)).size,modelCount);
 assert.deepEqual(plain(contributionCatalog.map(m=>m.id).sort()),current.map(m=>m.BoatModelID).sort());
 const phaseIndex=new Map();for(const p of data.productionPhases){if(!phaseIndex.has(p.BoatModelID))phaseIndex.set(p.BoatModelID,[]);phaseIndex.get(p.BoatModelID).push(p);}
 const baseline=expected.map(b=>ctx.BScoutDataRepository.applyCanonicalCompatibility({...b,ProductionPhases:phaseIndex.get(b.BoatModelID)||[]}));
 const profiles=[{},...read('data/search-profiles.json').map(p=>p.SearchSettings),{fuels:['Diesel']},{fuels:['Gasoline']},{propulsion:['Shaft']},{propulsion:['Outboard']},{engineCounts:[1]},{engineCounts:[2]},{minLength:25,maxLength:40},{maxBeam:12},{hullTypes:['Displacement']},{flybridge:'No'},{trailerable:'Yes'},...['Albin 25','Mainship','CHAP-307-SSX-21','SRAY-340-SD-G2'].map(textSearch=>({textSearch}))];
 let evaluations=0;
 for(const profile of profiles){
  const before=ctx.BScoutFilterEngine.filterBoats(baseline,profile,data.routes,{}).map(b=>b.BoatModelID);
  ctx.BScoutSearchOrchestrator.configure({boats:data.boats,routes:data.routes});
  const after=ctx.BScoutSearchOrchestrator.execute({state:{searchSettings:profile},render:false}).boats.map(b=>b.BoatModelID);
  assert.deepEqual(plain(after),plain(before),'Search/filter changed: '+JSON.stringify(profile));evaluations+=modelCount;
 }
 await ctx.ImageAssetManager.loadImageAssetRegistry(ctx.fetch);
 const imageCounts={local:0,external:0,missingLocal:0};
 let fallbackChecks=0;
 for(const boat of data.boats){
  const src=ctx.ImageAssetManager.resolveBoatImage(boat);
  if(/^https?:/.test(src))imageCounts.external++;
  else if(fs.existsSync('dist/'+src))imageCounts.local++;
  else imageCounts.missingLocal++;
  const element={dataset:{boatModelId:boat.BoatModelID},attrs:{src},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v}};
  ctx.ImageAssetManager.applyImageFallback(element,boat,true);
  // All candidates failing must reach a real placeholder, without a broken first-error state.
  const limit=ctx.ImageAssetManager.externalCandidateURLs(ctx.ImageAssetManager.getBoatImageAsset(boat)).length+2;
  for(let i=0;i<limit&&element.attrs.src!==ctx.ImageAssetManager.PLACEHOLDER_PATH;i++)element.onerror();
  assert.equal(element.attrs.src,ctx.ImageAssetManager.PLACEHOLDER_PATH,boat.BoatModelID);
  assert(fs.existsSync('dist/'+element.attrs.src));fallbackChecks++;
 }
 const inputs={resources:read('knowledge/data/curatedresources.json'),listings:read('knowledge/data/listingsearches.json'),annotations:read('knowledge/data/knowledgeannotations.json'),coverage:read('knowledge/data/knowledge-coverage.json')};
 const cards=ctx.BScoutKnowledgeUI.projectCards(data.boats,inputs);
 const workspaceSource=fs.readFileSync('dist/boatworkspace.js','utf8');
 const overviewContext={...ctx,root:ctx,getRecommendation:()=>({positives:[],cautions:[],tradeoffs:[]}),getRelationship:()=>null,getKnowledge:()=>null,
  esc:ctx.BScoutKnowledgeUI.escapeHtml,arr:value=>Array.isArray(value)?value:[],dimensionField:()=>'',field:()=>'',measure:()=>null,renderKnowledgeScoreCard:()=>''};
 vm.runInNewContext(workspaceSource.slice(workspaceSource.indexOf('    function textList('),workspaceSource.indexOf('    function safeUrl('))+workspaceSource.slice(workspaceSource.indexOf('    function nonEmptyArray('),workspaceSource.indexOf('    function uniqueText('))+workspaceSource.slice(workspaceSource.indexOf('    function renderOverview('),workspaceSource.indexOf('    function phaseFactDisplay(')),overviewContext);
 let guidanceChecks=0;
 for(let i=0;i<data.boats.length;i++){
  const boat=data.boats[i];
  const card=await ctx.BScoutKnowledgeUI.enrichCard(cards[i],inputs.resources,inputs.listings,data.boats);
  assert.equal(card.identity.boatModelId,boat.BoatModelID);
  if(Array.isArray(boat.Strengths))assert.deepEqual(plain(card.intelligence.strengths),plain(boat.Strengths),'Recorded strengths disappear: '+boat.BoatModelID);
  if(boat.ModelCharacter)assert.equal(card.intelligence.characterNarrative,boat.ModelCharacter,'Model character disappears: '+boat.BoatModelID);
  if(boat.OwnershipCharacter)assert.equal(card.intelligence.ownershipCharacter,boat.OwnershipCharacter);
  const highlights=ctx.BScoutBoatWorkspace.buildIntelligenceSections(boat,{positives:[],cautions:[],tradeoffs:[]},card,null,data.boats);
  for(const strength of boat.Strengths||[])assert(plain(highlights.why).includes(strength),'Overview loses documented strength: '+boat.BoatModelID);
  const html=ctx.BScoutKnowledgeUI.renderKnowledgeCard(card,boat)+ctx.BScoutKnowledgeUI.renderBoatIntelligence(card,boat);
  assert(!html.includes('[object Object]'),'Object rendered as text: '+boat.BoatModelID);
  overviewContext.currentBoat=boat;overviewContext.currentCard=card;
  const overview=overviewContext.renderOverview();
  for(const strength of boat.Strengths||[])assert(overview.includes(ctx.BScoutKnowledgeUI.escapeHtml(strength)),'Visible overview loses recorded strength: '+boat.BoatModelID);
  guidanceChecks++;
 }
 // Exercise the application's real comparison function for every model.
 const script=fs.readFileSync('dist/script.js','utf8');
 const comparison=script.slice(script.indexOf('function renderComparisonTable()'),script.indexOf('// Hook up comparison modal trigger'));
 const table={innerHTML:''};
 ctx.document={getElementById:id=>id==='comparisonTable'?table:null};
 ctx.allBoats=data.boats;ctx.currentSearchProfile=null;ctx.getBoatRelationship=()=>null;ctx.STATUS_LABELS={};
 ctx.escapeHtml=ctx.BScoutKnowledgeUI.escapeHtml;
 // Use the same shared assessment renderer as result cards.
 vm.runInNewContext(script.slice(script.indexOf('function renderPreferenceMatchSummary('),script.indexOf('function formatCardMeasurement(')),ctx);
 vm.runInNewContext(comparison,ctx);
 let comparisonChecks=0;
 for(let i=0;i<modelCount;i+=3){
  const selection=data.boats.slice(i,i+3);if(selection.length===1)selection.push(data.boats[0]);
  ctx.comparisonBoatIDs=selection.map(b=>b.BoatModelID);ctx.renderComparisonTable();
  for(const boat of selection)assert(table.innerHTML.includes(boat.BoatModelID));
  assert(!table.innerHTML.includes('undefined'));comparisonChecks+=selection.length;
  assert(!table.innerHTML.includes('side_decks.'),'Comparison exposes internal codes');
 }
 const publicFiles=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())walk(file);else publicFiles.push(file)}}walk('dist');
 assert(!publicFiles.some(f=>/phase2-live-|phase2-batches|\/canonical\/|knowledgecards\.json|\/archive\//.test(f)));
 for(const model of current){
  const page=fs.readFileSync('dist'+model.CanonicalPath+'index.html','utf8');
  assert(page.includes(model.BoatModelID));
  assert(page.includes('this.onerror=null;this.src='),'Static image has no fallback: '+model.BoatModelID);
  for(const [,src]of page.matchAll(/<img[^>]+src="([^"]+)"/g))if(!/^https?:/.test(src)){
   const resolved=require('node:path').resolve('dist'+model.CanonicalPath,src);
   assert(fs.existsSync(resolved),'Missing static image '+model.BoatModelID+': '+src);
  }
 }
 const retired=read('deployment/legacy-model-page-redirects.json');
 const activeSlugs=new Set(current.map(m=>m.CanonicalSlug));
 for(const entry of fs.readdirSync('dist/models',{withFileTypes:true}).filter(e=>e.isDirectory()))if(!activeSlugs.has(entry.name)){
  assert(retired[entry.name],'Obsolete production model page: '+entry.name);
  const redirect=fs.readFileSync('dist/models/'+entry.name+'/index.html','utf8');
  assert(redirect.includes('http-equiv="refresh"')&&redirect.includes('noindex'),'Retired page must redirect');
  assert(!redirect.includes('class="specs"'),'Retired page still contains competing specifications');
 }
 const result={status:'PASS',models:modelCount,baseline:'checksum-verified original Git snapshot fixture',fieldOwners:Object.keys(rules.fields).length,filterProfiles:profiles.length,filterEvaluations:evaluations,knowledgeDisplays:guidanceChecks,comparisonModelChecks:comparisonChecks,contributionCatalogModels:contributionCatalog.length,imageResolution:imageCounts,imageFallbackChecks:fallbackChecks,staticModelPages:modelCount,historicalResearch:'unchanged',liveWrites:0};
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/production-readiness-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
