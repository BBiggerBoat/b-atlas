'use strict';
// Run the actual production handler against real, isolated SQLite tables and
// in-memory attachment storage. No requests or notifications reach production.
const fs=require('node:fs'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),{pathToFileURL}=require('node:url');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('cloudflare/schema.sql','utf8'));
const db={prepare(sql){let args=[];const statement=sqlite.prepare(sql);return {bind(...values){args=values;return this},async first(){return statement.get(...args)||null},async run(){return statement.run(...args)},async all(){return {results:statement.all(...args)}}}},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const storage=new Map(),env={BSCOUT_DB:db,BSCOUT_ADMIN_TOKEN:crypto.randomUUID(),BSCOUT_FILES:{async get(k){return storage.get(k)||null},async put(k,v){storage.set(k,v)},async list(){return {keys:[...storage.keys()].map(name=>({name})),list_complete:true}}}};
const tasks=[],context={waitUntil:p=>tasks.push(p)};
(async()=>{
 const worker=(await import(pathToFileURL(require('node:path').resolve('cloudflare/worker.js')))).default;
 async function request(path,method='GET',body,admin=false,origin='https://b-atlas.org'){
  const headers={Origin:origin,'CF-Connecting-IP':'127.0.0.1','Content-Type':'application/json'};
  if(admin)headers.Authorization='Bearer '+env.BSCOUT_ADMIN_TOKEN;
  return worker.fetch(new Request('https://api.b-atlas.org/api/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),env,context);
 }
 assert.equal((await request('health')).status,200);
 assert.equal((await request('admin/snapshot')).status,401);
 assert.equal((await request('admin/snapshot','GET',null,true,'https://untrusted.example')).status,403);
 const record={ContributionID:'CONTRIB-'+crypto.randomUUID(),ContributionType:'correction',ModelID:'ALBN-25',AttachmentRefs:[],Payload:{CorrectionField:'LOA',ProposedValue:40,ProposedUnit:'ft'}};
 const submission=await request('contributions','POST',{record,attachments:[]});assert.equal(submission.status,201,await submission.text());
 const snapshot=await(await request('admin/snapshot','GET',null,true)).json();assert.equal(snapshot.pending.length,1);assert.equal(snapshot.pending[0].ModelID,'ALBN-25');
 assert.equal((await request('contributions','POST',{record,attachments:[]})).status,200,'Duplicate submission must be idempotent');
 const approved={...snapshot.pending[0],ModerationStatus:'approved',ReviewAction:'corrected'};
 assert.equal((await request('admin/snapshot','PUT',{pending:[],reviewed:[approved]},true)).status,200);
 assert.equal((await request('admin/publish','POST',{},true)).status,200);
 const overlay=await(await request('public/overlays')).json();assert(Math.abs(overlay.modelPatches['ALBN-25'].LOA-12.192)<1e-10);
 assert(!Object.hasOwn(overlay,'canonicalChangeHistory'));
 const backup=await(await request('admin/backup','GET',null,true)).json();assert.equal(backup.schema,'batlas-backup-v1');assert.equal(backup.integrity.algorithm,'SHA-256');
 await Promise.all(tasks);
 // Verify the browser's public client really submits to this handler successfully.
 const vm=require('node:vm');const browser={AbortSignal,fetch:async(url,options)=>worker.fetch(new Request(url,{...options,headers:{...options.headers,Origin:'https://b-atlas.org','CF-Connecting-IP':'127.0.0.2'}}),env,context)};browser.window=browser;
 vm.runInNewContext(fs.readFileSync('dist/communityapi.js','utf8'),browser);
 const ownerRecord={ContributionID:'CONTRIB-'+crypto.randomUUID(),ContributionType:'ownership_experience',ModelID:'ALBN-25',AttachmentRefs:[],Payload:{Experience:'Isolated readiness verification'}};
 assert((await browser.BScoutCommunityAPI.submit(ownerRecord,[])).ok);
 const result={status:'PASS',handler:'actual Cloudflare Worker',database:'isolated SQLite with production schema',contributionSubmission:true,duplicateProtection:true,authentication:true,correctionPublication:true,publicOverlay:true,backupIntegrity:true,browserClient:true,liveWrites:0};
 fs.writeFileSync('reports/production-worker-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>sqlite.close());
