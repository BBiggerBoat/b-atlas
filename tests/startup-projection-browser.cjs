'use strict';
const {modelCount}=require('./catalogue-evolution.cjs');
// Compare a hash-verified Phase 3 runtime overlay with current dist. Local traffic only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const validImages=process.env.PHASE4_IMAGE_FIXTURE==='valid',repeats=Number(process.env.PHASE4_PERFORMANCE_REPEATS||3);
assert(Number.isInteger(repeats)&&repeats>=1&&repeats<=5);
const root=path.resolve('dist'),baseline=path.resolve(process.env.PHASE4_BASELINE_ROOT||'.bscout-data/phase4-architecture/phase3-runtime'),out=path.resolve('.bscout-data/phase4-architecture/'+(validImages?'performance-valid-images':'performance'));fs.mkdirSync(out,{recursive:true});
const completeModels=require('../developer/canonical-store.cjs').load(),projection=require('../datarepository.js').projectSearchModel;
const inputs={before:JSON.stringify(completeModels),after:JSON.stringify(completeModels.map(projection))};
const baselineManifest=JSON.parse(fs.readFileSync(path.join(baseline,'data/generated/models/manifest.json'))),currentManifest=JSON.parse(fs.readFileSync(path.join(root,'data/generated/models/manifest.json')));
assert.equal(baselineManifest.release,'7c50425ccd25ed65072fed18c43c653717c0d9f1303df8ef5bd0af3641866243','Reconstruct the verified Phase 3 runtime first');
assert.equal(currentManifest.sourceDigest,baselineManifest.sourceDigest,'Performance variants must use identical canonical facts');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),old=url.pathname.startsWith('/before/'),rel=url.pathname.replace(/^\/(before|after)/,'')||'/';
 const suffix=rel==='/'?'/index.html':rel;
 let file=path.resolve(old?baseline:root,'.'+suffix);
 if(!file.startsWith((old?baseline:root)+path.sep)){res.writeHead(403);return res.end();}
 if(old&&!fs.existsSync(file))file=path.resolve(root,'.'+suffix);
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const ext=path.extname(file);let body=fs.readFileSync(file);if(/\.(html|js|css|json|xml|svg)$/.test(ext))body=Buffer.from(body.toString('utf8').replace(/\r\n/g,'\n'));res.setHeader('Content-Type',mime[ext]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;const runs=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [name,viewport,isMobile] of [['desktop',{width:1440,height:1000},false],['mobile',{width:390,height:844},true]])for(let repeat=1;repeat<=repeats;repeat++)for(const version of ['before','after']){
   const context=await browser.newContext({viewport,isMobile,hasTouch:isMobile});
   await context.route('**/*',route=>{
    const r=route.request();
    if(validImages&&!r.url().startsWith(origin)&&r.resourceType()==='image')return route.fulfill({status:200,contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')});
    if(!r.url().startsWith(origin)||!['GET','HEAD'].includes(r.method()))return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    // Resolve root-based image/site paths into the selected variant as well.
    const url=new URL(r.url());if(!/^\/(before|after)\//.test(url.pathname))return route.continue({url:origin+'/'+version+url.pathname+url.search});return route.continue();
   });
   await context.addInitScript((modelCount)=>{
    performance.setResourceTimingBufferSize(10000);
    window.__metrics={ready:null,longTasks:[],textMs:0,jsonMs:0};
    const observe=()=>{const el=document.getElementById('totalBoatsCount');if(el?.textContent===String(modelCount)&&window.__metrics.ready===null)window.__metrics.ready=performance.now();};
    new MutationObserver(observe).observe(document,{subtree:true,childList:true,characterData:true});
    try{new PerformanceObserver(list=>window.__metrics.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});}catch{}
    for(const [key,metric] of [['text','textMs'],['json','jsonMs']]){const original=Response.prototype[key];Response.prototype[key]=async function(...args){const start=performance.now();try{return await original.apply(this,args);}finally{window.__metrics[metric]+=performance.now()-start;}};}
   },modelCount);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/'+version+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__metrics.ready!==null);await page.waitForLoadState('networkidle');
   const startup=await page.evaluate(()=>{const resources=performance.getEntriesByType('resource');return {catalogueDecodedBytes:resources.filter(e=>/\/data\/generated\//.test(e.name)).reduce((n,e)=>n+e.decodedBodySize,0),catalogueRequests:resources.filter(e=>/\/data\/generated\//.test(e.name)).length,catalogueReadyMs:__metrics.ready,requests:resources.length,transferBytes:resources.reduce((n,e)=>n+e.transferSize,0),decodedBytes:resources.reduce((n,e)=>n+e.decodedBodySize,0),bodyCompletionMs:__metrics.textMs+__metrics.jsonMs,longTaskMs:__metrics.longTasks.reduce((a,b)=>a+b,0),heapBytes:performance.memory?.usedJSHeapSize||null,fullModelRequests:resources.filter(e=>/\/data\/generated\/models\/\d/.test(e.name)).length};});
   const guide=await page.evaluate(async()=>{const boat=allBoats.find(b=>b.BoatModelID==='ALBN-25'),start=performance.now(),pending=BScoutBoatWorkspace.open(boat,'overview',{history:false});await new Promise(requestAnimationFrame);const visibleMs=performance.now()-start;await pending;return {guideVisibleMs:visibleMs,guideReadyMs:performance.now()-start,guideText:document.getElementById('boatWorkspaceStatus')?.textContent};});
   assert.equal(guide.guideText,'');assert.deepEqual(errors,[]);
   const bench=await page.evaluate(text=>{const samples=[];for(let i=0;i<5;i++){const a=performance.now(),rows=JSON.parse(text),b=performance.now();rows.map(BScoutDataRepository.applyCanonicalCompatibility);samples.push({parseMs:b-a,compatibilityMs:performance.now()-b});}return samples;},inputs[version]);
   runs.push({name,repeat,version,...startup,...guide,bench});console.log(JSON.stringify({...runs.at(-1),bench:undefined}));await context.close();
  }
  const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)],summary=[];
  for(const name of ['desktop','mobile'])for(const version of ['before','after']){const selected=runs.filter(r=>r.name===name&&r.version===version);summary.push({name,version,...Object.fromEntries(['catalogueReadyMs','decodedBytes','requests','catalogueDecodedBytes','catalogueRequests','guideVisibleMs','guideReadyMs','bodyCompletionMs','longTaskMs','heapBytes'].map(k=>[k,median(selected.map(r=>r[k]))])),parseMs:median(selected.flatMap(r=>r.bench.map(v=>v.parseMs))),compatibilityMs:median(selected.flatMap(r=>r.bench.map(v=>v.compatibilityMs)))});}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({repeats,imageFixture:validImages?'valid synthetic external GIF':'unavailable external images',method:'Installed Edge, alternating fresh contexts per viewport, localhost, normalized LF, uncompressed and unthrottled, external requests and writes blocked. Body work includes completion, not pure parse CPU; heap is a point sample. Phase 3 runtime reconstructed from 4990f6a with its release digest verified.',runs,summary},null,2));console.log(JSON.stringify(summary));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
