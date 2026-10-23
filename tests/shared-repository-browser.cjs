'use strict';
const {modelCount}=require('./catalogue-evolution.cjs');
// Real browser consumers, synthetic overlay, local static artifacts only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.PHASE3_PUBLIC_ROOT||'dist'),out=path.resolve(process.env.PHASE3_OUTPUT_DIR||'.bscout-data/phase3/shared-browser');
fs.mkdirSync(out,{recursive:true});
const overlay={modelPatches:{'ALBN-25':{BoatModelID:'FORGED',Overview:'Shared repository browser verification',FuelCode:'fuel.gasoline'}},addedModels:[{BoatModelID:'LOCAL-TEST',Manufacturer:'Local',Model:'Test',Overview:'Complete added guidance',Active:true}],addedManufacturers:[{CanonicalName:'Local'}],resourceAdditions:[{BoatModelID:'ALBN-25',url:'https://example.test/manual',group:'documents',title:'Local test manual'}]};
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let browser;const results=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [name,viewport,isMobile] of [['desktop',{width:1440,height:1000},false],['mobile',{width:390,height:844},true]]){
   const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile}),calls=new Map();let writes=0,blockedResource=null;
   await context.route('**/*',route=>{
    const request=route.request(),url=request.url();calls.set(url,(calls.get(url)||0)+1);
    if(!['GET','HEAD'].includes(request.method())){writes++;return route.abort();}
    if(url===blockedResource)return route.fulfill({status:404,body:'Unavailable fixture'});
    if(url==='https://api.b-atlas.org/api/public/overlays')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(overlay)});
    return url.startsWith(base)?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction((expected)=>document.getElementById('totalBoatsCount')?.textContent===String(expected),modelCount+1);
   const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/generated/models/manifest.json')));
   for(const d of manifest.shards)assert(!calls.has(base+'/'+d.path),'Startup fetched a detail shard');
   await page.evaluate(async()=>BScoutBoatWorkspace.open((await BScoutDataRepository.getRepository().loadSearchData()).boats.find(b=>b.BoatModelID==='ALBN-25'),'overview',{history:false}));
   for(const name of ['curatedResources','listingSearches'])for(const d of manifest.datasets[name].shards)assert(!calls.has(base+'/'+d.path),'Research guide eagerly loaded owner resources');
   const result=await page.evaluate(async()=>{
    const repository=BScoutDataRepository.getRepository(),data=await repository.loadSearchData();
    const baseline={boats:data.boats.filter(b=>b.BoatModelID!=='LOCAL-TEST')};
    const card=await BScoutKnowledgeUI.loadCardForBoat(data.boats.find(b=>b.BoatModelID==='ALBN-25'),{includeResources:false});
    await BScoutContributions.openGuide({dataset:{modelId:'ALBN-25',manufacturer:'Albin',model:'25'}},{typeId:'correction',fieldId:'FuelCode',history:false});
    const source=(await repository.getModel('ALBN-25')).Overview;
    const added=(await repository.getModel('LOCAL-TEST')).Overview;
    await BScoutBoatWorkspace.open(data.boats.find(b=>b.BoatModelID==='ALBN-25'),'resources',{history:false});
    if(!document.querySelector('[data-workspace-panel="owning"]').textContent.includes('Local test manual'))throw Error('Owner Resources did not render the lazy resource addition');
    const resources=await BScoutKnowledgeUI.loadCuratedResources();
    return {count:data.boats.length,baselineCount:baseline.boats.length,source,card:card.intelligence.overview,added,modelId:(await repository.getModel('ALBN-25')).BoatModelID,correction:document.getElementById('correctionCurrentValue').value,manuals:resources.find(r=>r.BoatModelID==='ALBN-25').documents.filter(d=>d.url==='https://example.test/manual').length,release:data.catalogueRelease};
   });
   assert.equal(result.count,modelCount+1);assert.equal(result.baselineCount,modelCount);assert.equal(result.source,'Shared repository browser verification');assert.equal(result.card,result.source);assert.equal(result.added,'Complete added guidance');assert.equal(result.modelId,'ALBN-25');assert.match(result.correction,/Gasoline/i);assert.equal(result.manuals,1);
   assert.equal(calls.get('https://api.b-atlas.org/api/public/overlays'),1);
   assert.equal(calls.get(base+'/data/generated/models/manifest.json'),1);
   assert(![...calls.keys()].some(url=>new URL(url).pathname==='/boatmodels.json'));
   for(const [url,count] of calls)if(url.includes('/data/generated/'))assert.equal(count,1,url);
   assert.equal(writes,0);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,name+'-contribution.png')});
   for(const shell of ['/saved-models/','/privacy/']){
    calls.clear();await page.goto(base+shell,{waitUntil:'domcontentloaded'});
    await page.waitForFunction((expected)=>typeof BScoutDataRepository?.getRepository==='function' && document.getElementById('totalBoatsCount')?.textContent===String(expected),modelCount+1);
    const row=await page.evaluate(async()=>(await BScoutDataRepository.getRepository().getModel('ALBN-25')).Overview);
    assert.equal(row,result.source);assert.equal(calls.get('https://api.b-atlas.org/api/public/overlays'),1);
    assert(![...calls.keys()].some(url=>new URL(url).pathname==='/boatmodels.json'));
   }
   // A missing owner-resource shard must show an error, preserve candidates and retry.
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction((expected)=>document.getElementById('totalBoatsCount')?.textContent===String(expected),modelCount+1);
   blockedResource=base+'/'+manifest.datasets.curatedResources.shards[0].path;
   await page.evaluate(async()=>BScoutBoatWorkspace.open((await BScoutDataRepository.getRepository().loadSearchData()).boats.find(b=>b.BoatModelID==='ALBN-25'),'resources',{history:false}));
   assert.match(await page.locator('[data-workspace-panel="owning"]').textContent(),/could not be loaded/);
   assert.equal(await page.locator('#totalBoatsCount').textContent(),String(modelCount+1));
   blockedResource=null;
   const dismissTour=page.getByRole('button',{name:'Not now',exact:true});
   if(await dismissTour.isVisible())await dismissTour.click();
   await page.locator('[data-workspace-tab="owning"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-workspace-panel="owning"]').textContent.includes('Local test manual'));
   const latestGuide=await page.evaluate(async()=>{
    const data=await BScoutDataRepository.getRepository().loadSearchData(),first=data.boats.find(b=>b.BoatModelID==='ALBN-25'),last=data.boats.find(b=>b.BoatModelID==='MNSH-34-TR');
    await Promise.all([BScoutBoatWorkspace.open(first,'overview',{history:false}),BScoutBoatWorkspace.open(last,'overview',{history:false})]);
    const full=await BScoutDataRepository.getRepository().getModel(last.BoatModelID);
    return {contributionModel:document.getElementById('contributeToGuideBtn').dataset.modelId,character:full.ModelCharacter,body:document.querySelector('[data-workspace-panel="research"]').textContent};
   });
   assert.equal(latestGuide.contributionModel,'MNSH-34-TR');assert(latestGuide.character);assert(latestGuide.body.includes(latestGuide.character),'Late previous guide repainted the selected model');
   assert.equal(writes,0);assert.deepEqual(errors,[]);
   results.push({name,status:'PASS',...result,overlayRequests:1,monolithRequests:0,productionWrites:0,staticShells:['saved-models','privacy']});await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',results},null,2));console.log(JSON.stringify(results));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
