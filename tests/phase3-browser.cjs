'use strict';
// Local-only end-to-end test. All non-local requests are blocked; no community service writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../outputs/phase3-implementation');fs.mkdirSync(out,{recursive:true});
const publicRoot=process.env.PHASE3_PUBLIC_ROOT?path.resolve(process.env.PHASE3_PUBLIC_ROOT):root;
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(publicRoot,'.'+rel);if(!file.startsWith(publicRoot+path.sep)&&file!==publicRoot){res.writeHead(403);return res.end();}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;const results=[];
try{
 browser=await chromium.launch({channel:'msedge',headless:true,timeout:20000});
 for(const [name,viewport,mobile]of [['desktop',{width:1440,height:1000},false],['mobile',{width:390,height:844},true]]){
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.type()==='prompt'?dialog.accept('Phase 3 saved search'):dialog.accept());
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('totalBoatsCount')?.textContent==='995',{timeout:30000});
  await page.locator('[data-app-action="dream"]:visible').first().click();
  await page.locator('#newProfileBtn').click();
  const baseline=await page.locator('#currentBoatsCount').textContent();assert.equal(baseline,'995');
  await page.locator('.filter-header').filter({hasText:'Characteristics'}).click();
  await page.locator('.fuelFilter[value="Diesel"]').check();
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.fuels.includes('Diesel'));
  const count=await page.locator('#currentBoatsCount').textContent();assert(Number(count)<995&&Number(count)>0);
  await page.locator('.filter-header').filter({hasText:'Dimensions'}).click();
  await page.locator('#maxAirDraft').fill('15');await page.locator('#maxAirDraft').press('Tab');
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.maxAirDraft===15);
  await page.locator('#saveProfileBtn').click();
  const savedID=await page.locator('#searchProfileSelect').inputValue();assert(savedID);
  await page.locator('#clearButton').click();
  await page.waitForFunction(()=>document.getElementById('currentBoatsCount').textContent==='995');
  await page.locator('#searchProfileSelect').selectOption(savedID);
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.maxAirDraft===15&&window.BScoutSearchState.getState().searchSettings.fuels.includes('Diesel'));
  let savedCount=await page.locator('#currentBoatsCount').textContent();
  // Verify non-rendered saved requirements survive the same reader used by Save.
  const retained=await page.evaluate(()=>{const current=window.BScoutSearchState.getState().searchSettings;window.applySearchSettingsToControls({...current,minimumBerths:4,styles:['Trawler']});window.runCurrentSearch();return window.buildUserProfile();});
  assert.equal(retained.minimumBerths,4);assert.deepEqual(retained.styles,['Trawler']);assert.equal(retained.maxAirDraft,15);
  await page.locator('#maxAirDraft').dispatchEvent('change');await page.locator('#saveProfileBtn').click();
  savedCount=await page.locator('#currentBoatsCount').textContent();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('totalBoatsCount')?.textContent==='995');
  await page.locator('[data-app-action="dream"]:visible').first().click();await page.locator('#searchProfileSelect').selectOption(savedID);
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.maxAirDraft===15);
  assert.equal(await page.locator('#currentBoatsCount').textContent(),savedCount);
  const restored=await page.evaluate(()=>window.BScoutSearchState.getState().searchSettings);assert.equal(restored.minimumBerths,4);assert.deepEqual(restored.styles,['Trawler']);
  assert((await page.locator('.card-fit-summary').filter({hasText:'Retained because'}).count())>0);
  assert(!(await page.locator('.unknown-data').allTextContents()).some(t=>t.includes('max-air-draft')));
  // Exercise remaining category controls and text search through the browser's real events.
  await page.locator('#clearButton').click();await page.locator('.filter-header').filter({hasText:'Characteristics'}).click();
  await page.locator('.constructionFilter[value="Fiberglass"]').check();await page.locator('.propulsionFilter[value="Shaft"]').check();await page.locator('.engineCountFilter[value="2"]').check();
  await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.engineCounts.includes(2));
  const combinedCount=await page.locator('#currentBoatsCount').textContent();assert(Number(combinedCount)>0&&Number(combinedCount)<995);
  await page.locator('#textSearch').fill('Tiara');await page.waitForFunction(()=>window.BScoutSearchState.getState().searchSettings.textSearch==='tiara');
  assert(Number(await page.locator('#currentBoatsCount').textContent())>0);
  const dismiss=page.getByRole('button',{name:'Not now',exact:true});if(await dismiss.isVisible())await dismiss.click();
  await page.locator('.card-fit-summary').first().scrollIntoViewIfNeeded();
  assert(await page.locator('.card-fit-summary').first().isVisible());
  await page.screenshot({path:path.join(out,name+'-search.png'),fullPage:false});assert.deepEqual(errors,[],'Browser JavaScript errors');
  results.push({name,viewport,status:'PASS',catalogue:995,liveFilterCount:Number(count),savedCount:Number(savedCount),combinedCount:Number(combinedCount),savedSearchReload:true,hiddenRequirementsPreserved:true});await context.close();
 }
 assert.equal(results[0].liveFilterCount,results[1].liveFilterCount);assert.equal(results[0].savedCount,results[1].savedCount);
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({status:'PASS',browser:'Installed Edge, headless',workflows:results,externalRequestsBlocked:true,productionWrites:false},null,2)+'\n');console.log(JSON.stringify(results));
}catch(error){fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({status:'FAILED_OR_UNAVAILABLE',error:error.message,completed:results,productionWrites:false},null,2)+'\n');throw error;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
