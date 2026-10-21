'use strict';
// Isolated local browser profiles. External requests and ALL writes are blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),publicRoot=path.resolve(process.env.PHASE4_PUBLIC_ROOT||root),out=path.resolve(root,'../../outputs/phase4-implementation');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(publicRoot,'.'+pathname);if(!file.startsWith(publicRoot+path.sep)&&file!==publicRoot){res.writeHead(403);return res.end();}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;const workflows=[];
try{
 browser=await chromium.launch({channel:'msedge',headless:true,timeout:20000});
 for(const [name,viewport,isMobile] of [['desktop',{width:1440,height:1000},false],['mobile',{width:390,height:844},true]]){
  const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile});
  await context.route('**/*',route=>route.request().url().startsWith(base)&&['GET','HEAD'].includes(route.request().method())?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  console.log(name+': start');
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack || e.message));page.on('dialog',d=>d.type()==='prompt'?d.accept('Phase 4 saved search'):d.accept());
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('totalBoatsCount')?.textContent==='995',{timeout:30000});
  await page.locator('[data-app-action="dream"]:visible').first().click();await page.locator('#newProfileBtn').click();
  await page.locator('.filter-header').filter({hasText:'Standard'}).click();
  await page.getByLabel('Wide Side Decks priority',{exact:true}).selectOption('Important');
  await page.getByLabel('Separate Shower priority',{exact:true}).selectOption('PreferredV4');
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.featurePriorities['Separate Shower']==='PreferredV4');
  assert.equal(await page.locator('#currentBoatsCount').textContent(),'995','Soft preferences preserve all candidates');
  assert(await page.locator('.preference-match-summary').filter({hasText:'Not enough information'}).count()>0);
  assert(await page.locator('.preference-match-summary').filter({hasText:'Known compromises'}).count()>0);
  const first=page.locator('.boat-card').first(),id=await first.locator('.compare-btn').getAttribute('data-id');
  const cardAssessment=await first.locator('.preference-match-summary').evaluate(el=>({score:el.dataset.matchScore,confidence:el.dataset.confidence}));
  await first.locator('.preference-match-summary summary').click();assert(await first.locator('.preference-match-summary details').getAttribute('open')!==null);
  await first.locator('.intelligence-btn').click();
  await page.waitForFunction(()=>document.querySelector('.workspace-decision-card .preference-match-summary'));
  const guideAssessment=await page.locator('.workspace-decision-card .preference-match-summary').evaluate(el=>({score:el.dataset.matchScore,confidence:el.dataset.confidence}));
  assert.deepEqual(guideAssessment,cardAssessment,'Model guide uses active unsaved preferences');
  await page.locator('#closeModal').click();
  await page.locator('[data-app-action="dream"]:visible').first().click();
  await first.locator('.compare-btn').click();await page.locator('.boat-card').nth(1).locator('.compare-btn').click();const dismiss=page.getByRole('button',{name:'Not now',exact:true});if(await dismiss.isVisible())await dismiss.click();await page.locator('#floatingCompareBtn').click();
  await page.locator('#comparisonModal').waitFor({state:'visible'});
  const comparisons=await page.locator('#comparisonModal .preference-match-summary').evaluateAll(nodes=>nodes.map(el=>({score:el.dataset.matchScore,confidence:el.dataset.confidence})));
  assert.deepEqual(comparisons[0],cardAssessment,'Comparison and result assessment agree');assert.equal(comparisons.length,2);
  await page.screenshot({path:path.join(out,name+'-comparison.png')});console.log(name+': guide and comparison passed');
  await page.keyboard.press('Escape');
  // Save, clear and reload using actual controls.
  await page.locator('#saveProfileBtn').click();const savedID=await page.locator('#searchProfileSelect').inputValue();assert(savedID);
  const rankedIDs=await page.locator('.boat-card .compare-btn').evaluateAll(nodes=>nodes.map(n=>n.dataset.id));
  await page.locator('#clearButton').click();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('totalBoatsCount')?.textContent==='995');
  await page.locator('[data-app-action="dream"]:visible').first().click();await page.locator('#searchProfileSelect').selectOption(savedID);
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.featurePriorities['Separate Shower']==='PreferredV4');
  assert.deepEqual(await page.locator('.boat-card .compare-btn').evaluateAll(nodes=>nodes.map(n=>n.dataset.id)),rankedIDs);
  // Seed an actual legacy saved profile then restore it through the profile selector.
  await page.evaluate(()=>{const profiles=JSON.parse(localStorage.getItem('bscout_search_profiles')||'[]');profiles.push({ProfileID:'phase4-legacy',ProfileName:'Legacy search',SearchSettings:{fuels:['Diesel'],maxAirDraft:15,minimumBerths:4,featurePriorities:{'Wide Side Decks':'Required','Separate Shower':'Preferred','Hidden legacy feature':'Bonus'}},SortPreferences:{field:'LOA',direction:'desc'}});localStorage.setItem('bscout_search_profiles',JSON.stringify(profiles));});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('totalBoatsCount')?.textContent==='995');await page.locator('[data-app-action="dream"]:visible').first().click();await page.locator('#searchProfileSelect').selectOption('phase4-legacy');
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.fuels.includes('Diesel'));
  assert.equal(await page.getByLabel('Wide Side Decks priority',{exact:true}).inputValue(),'Required');
  assert.equal(await page.getByLabel('Separate Shower priority',{exact:true}).inputValue(),'Preferred');
  const legacy=await page.evaluate(()=>({settings:window.buildUserProfile(),sort:window.BScoutSearchState.getState().sort}));
  assert.equal(legacy.settings.minimumBerths,4);assert.equal(legacy.settings.maxAirDraft,15);assert.equal(legacy.settings.featurePriorities['Hidden legacy feature'],'Bonus');assert.equal(legacy.sort.field,'LOA');
  assert(await page.locator('.preference-match-summary').filter({hasText:'Must-haves still need verification'}).count()>0);
  assert.equal(await page.locator('.preference-match-summary[data-confidence="High"]').count(),0,'Unresolved real records never overclaim confidence');
  if(!await page.getByLabel('Shaft Drive priority',{exact:true}).isVisible())await page.locator('.filter-header').filter({hasText:'Standard'}).click();
  await page.getByLabel('Shaft Drive priority',{exact:true}).selectOption('PreferredV4');
  await page.locator('#saveProfileBtn').click();
  const savedLegacy=await page.evaluate(()=>JSON.parse(localStorage.getItem('bscout_search_profiles')).find(p=>p.ProfileID==='phase4-legacy'));
  assert.equal(savedLegacy.SearchSettings.featurePriorities['Wide Side Decks'],'Required');assert.equal(savedLegacy.SortPreferences.field,'LOA');
  console.log(name+': saved and legacy searches passed');
  // Real model with variable engine count, found by text control.
  await page.locator('#clearButton').click();await page.locator('#textSearch').fill('Mainship');
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.textSearch==='mainship');
  if(!await page.getByLabel('Single Engine priority',{exact:true}).isVisible())await page.locator('.filter-header').filter({hasText:'Standard'}).click();await page.getByLabel('Single Engine priority',{exact:true}).selectOption('Important');
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.featurePriorities['Single Engine']==='Important');
  const mainship=page.locator('.boat-card').filter({has:page.locator('.compare-btn[data-id="MNSH-34-TR"]')});assert(await mainship.count());assert.match(await mainship.locator('.preference-match-summary').textContent(),/Not enough information|unanswered/);assert.match(await mainship.locator('.preference-match-summary').textContent(),/Version-dependent/);assert.match(await mainship.locator('.model-knowledge-confidence').textContent(),/Knowledge:/);
  await mainship.locator('summary').click();await mainship.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,name+'-ranking.png')});
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  workflows.push({name,viewport,status:'PASS',catalogue:995,rankingPreservesCandidates:true,comparisonMatchesCards:true,guideMatchesCards:true,savedOrderReload:true,legacyRequirementsAndWeightsPreserved:true,hiddenPreferencesPreserved:true,savedSortPreserved:true,unknownMustHavesExplained:true,variableEngineRemainsUnknown:true,firstRankedModel:id});await context.close();
 }
 assert.equal(workflows[0].firstRankedModel,workflows[1].firstRankedModel);
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({status:'PASS',browser:'Installed Edge, headless desktop and emulated mobile',workflows,productionWrites:false,externalRequestsBlocked:true},null,2)+'\n');console.log(JSON.stringify(workflows));
}catch(e){fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({status:'FAILED_OR_UNAVAILABLE',error:e.message,completed:workflows},null,2)+'\n');throw e;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
