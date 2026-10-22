'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
fs.mkdirSync('.bscout-data',{recursive:true});
const temp=fs.mkdtempSync(path.resolve('.bscout-data/admin-test-'));
const token=crypto.randomUUID();let child;
const read=p=>JSON.parse(fs.readFileSync(path.join(temp,p),'utf8'));
async function stop(){if(child&&!child.killed){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}}
(async()=>{
 try{
  for(const dir of ['data/canonical','data/registry','deployment'])fs.cpSync(dir,path.join(temp,dir),{recursive:true});
  fs.mkdirSync(path.join(temp,'developer'));
  for(const file of ['server.js','developer/canonical-store.cjs','developer/canonical-corrections.cjs','data/model-schema.json','index.html'])fs.copyFileSync(file,path.join(temp,file));
  fs.cpSync('data/i18n',path.join(temp,'data/i18n'),{recursive:true});
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const base=`http://127.0.0.1:${port}`;
  async function start(){
   child=spawn(process.execPath,[path.join(temp,'server.js')],{cwd:temp,env:{...process.env,PORT:String(port),BSCOUT_ADMIN_TOKEN:token,BSCOUT_DATA_DIR:path.join(temp,'.state')},stdio:'pipe'});
   let errors='';child.stderr.on('data',d=>errors+=d);
   for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(errors);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Admin server failed to start: '+errors);
  }
  await start();
  assert.equal((await fetch(base+'/api/admin/snapshot')).status,401);
  for(const file of ['/data/canonical/specifications.json','/archive/canonical-migration-baseline/boatmodels.json','/data/phase2-live-models.json','/server.js'])assert.equal((await fetch(base+file)).status,404,file);
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
  const corrections=[
   {CorrectionField:'LOA',ProposedValue:40,ProposedUnit:'ft'},
   {CorrectionField:'FuelCode',ProposedValue:'fuel.gasoline'},
   {CorrectionField:'AftCabin',ProposedValue:'false'}
  ].map(Payload=>({ModerationStatus:'approved',ReviewAction:'corrected',ContributionType:'correction',ModelID:'ALBN-25',Payload}));
  assert((await fetch(base+'/api/admin/snapshot',{method:'PUT',headers,body:JSON.stringify({reviewed:corrections})})).ok);
  const publish=await fetch(base+'/api/admin/publish',{method:'POST',headers});assert(publish.ok,await publish.text());
  let model=read('boatmodels.json').find(m=>m.BoatModelID==='ALBN-25');assert(Math.abs(model.LOA-12.192)<1e-10);assert.equal(model.FuelCode,'fuel.gasoline');assert.equal(model.AftCabin,false);
  const isolatedStore=require(path.join(temp,'developer/canonical-store.cjs'));
  assert.equal(isolatedStore.load().find(m=>m.BoatModelID==='ALBN-25').FuelCode,'fuel.gasoline');
  assert(!fs.existsSync(path.join(temp,'knowledge/data/knowledgecards.json')));
  await stop();await start();
  model=await (await fetch(base+'/boatmodels.json')).json();assert.equal(model[0].FuelCode,'fuel.gasoline');
  // Import the existing monolithic durable snapshot on restart, through the new store.
  await stop();
  const legacySnapshot=path.join(temp,'.state/published/boatmodels.json');
  const legacy=JSON.parse(fs.readFileSync(legacySnapshot));legacy[0].Overview='Legacy snapshot import regression';
  fs.writeFileSync(legacySnapshot,JSON.stringify(legacy));await start();
  assert.equal(isolatedStore.load()[0].Overview,'Legacy snapshot import regression');
  const promoted=await fetch(base+'/api/admin/promote',{method:'POST',headers,body:JSON.stringify({contribution:{ContributionType:'new_model',CanonicalDraft:{Fields:{Manufacturer:'Test Partition Builder',Model:'Regression 28',LengthFt:28,Fuel:'Diesel'},ResearchNotes:'Isolated regression fixture'}}})});
  const promotedText=await promoted.text();assert(promoted.ok,promotedText);const result=JSON.parse(promotedText);
  const added=isolatedStore.load().find(m=>m.BoatModelID===result.id);assert(added);assert.equal(added.Model,'Regression 28');assert.equal(added.LOA,8.5344);
  assert.equal(read('data/registry/boat-registry.json').find(r=>r.BoatModelID===result.id).IdentityStatus,'PendingReview');
  assert.equal((await fetch(base+'/data/canonical/index.json')).status,404);
  const ownerDir=isolatedStore.contract().datasets.specifications;
  assert.equal((await fetch(base+'/'+ownerDir+'/00.json')).status,404);
  await stop();await start();assert(isolatedStore.load().some(m=>m.BoatModelID===result.id));
  console.log('PASS: authenticated local moderation, canonical units/codes/booleans, owner writes, restart persistence and source exclusion.');
 }finally{await stop();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
