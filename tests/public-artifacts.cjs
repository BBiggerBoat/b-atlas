'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {sha,MAX_BYTES,writeModels}=require('../developer/public-model-artifacts.cjs');
const store=require('../developer/canonical-store.cjs'),models=store.load();
const read=file=>JSON.parse(fs.readFileSync(file));
function files(dir,base=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),base+e.name+'/'):[base+e.name]);}
function digests(dir){return Object.fromEntries(files(dir).sort().map(file=>[file,sha(fs.readFileSync(path.join(dir,file)))]));}
function verify(dir,expected,ownership){
 const m=read(path.join(dir,'data/generated/models/manifest.json'));
 assert.equal(m.schemaVersion,3);assert.equal(m.format,'batlas-catalogue-release-v3');assert.equal(m.maxShardBytes,MAX_BYTES);
 assert.equal(m.sourceDigest,sha(JSON.stringify({ownership,models:expected})));assert.equal(m.release,sha(JSON.stringify({format:m.format,sourceDigest:m.sourceDigest,baselineVersion:m.baselineVersion,modelCount:m.modelCount,shards:m.shards,modelToShard:m.modelToShard,datasets:m.datasets,search:m.search})));
 assert.equal(m.modelCount,expected.length);const rebuilt=[];
 m.shards.forEach((shard,index)=>{
  assert(/^data\/generated\/models\/\d{3}-[0-9a-f]{64}\.json$/.test(shard.path));
  const raw=fs.readFileSync(path.join(dir,shard.path));assert.equal(raw.length,shard.bytes);assert(raw.length<=MAX_BYTES);assert.equal(sha(raw),shard.sha256);assert(shard.path.includes(shard.sha256));
  const rows=JSON.parse(raw);assert.equal(rows.length,shard.records);for(const row of rows)assert.equal(m.modelToShard[row.BoatModelID],index);rebuilt.push(...rows);
 });
 const projected=m.search.shards.flatMap((d,i)=>{const raw=fs.readFileSync(path.join(dir,d.path));assert.equal(raw.length,d.bytes);assert(raw.length<=MAX_BYTES);assert.equal(sha(raw),d.sha256);const values=JSON.parse(raw);assert.equal(values.length,d.records);for(const row of values)assert.equal(m.search.modelToShard[row.BoatModelID],i);return values;});
 assert.deepEqual(projected,expected.map(require('../datarepository.js').projectSearchModel),'Search projection changed values/order');
 assert.deepEqual(rebuilt,expected,'Lossless shards changed records or sequence');assert.equal(Object.keys(m.modelToShard).length,expected.length);
 for(const [name,dataset] of Object.entries(m.datasets)){
  const rows=dataset.shards.flatMap(d=>{const raw=fs.readFileSync(path.join(dir,d.path));assert.equal(raw.length,d.bytes);assert(raw.length<=MAX_BYTES);assert.equal(sha(raw),d.sha256);return JSON.parse(raw);});
  assert.equal(rows.length,dataset.records);assert.deepEqual(rows,read(path.join(dir,dataset.sourcePath)),name);
 }
 const compatibility=fs.readFileSync(path.join(dir,m.compatibility.path));assert.equal(sha(compatibility),m.compatibility.sha256);assert.equal(compatibility.length,m.compatibility.bytes);assert.deepEqual(JSON.parse(compatibility),expected);
 const marker=read(path.join(dir,'public-build.json'));assert.equal(marker.sourceDigest,m.sourceDigest);const inventory=digests(dir);delete inventory['public-build.json'];assert.equal(marker.artifactDigest,sha(JSON.stringify(Object.entries(inventory))));
 for(const row of expected){const html=fs.readFileSync(path.join(dir,'models',row.CanonicalSlug,'index.html'),'utf8');assert(html.includes(row.BoatModelID));assert(html.includes('rel="canonical" href="'+row.CanonicalURL+'"'));assert(html.includes('application/ld+json'));}
 const sitemap=fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8'),permalinks=read(path.join(dir,'data/model-permalinks.json'));
 assert.equal(permalinks.models.length,expected.length);
 for(const row of expected){assert(sitemap.includes('<loc>'+row.CanonicalURL+'</loc>'));const entry=permalinks.models.find(x=>x.BoatModelID===row.BoatModelID);for(const key of ['CanonicalSlug','CanonicalPath','CanonicalURL'])assert.equal(entry[key],row[key]);}
 const redirects=read('deployment/legacy-model-page-redirects.json');for(const slug of Object.keys(redirects)){const html=fs.readFileSync(path.join(dir,'models',slug,'index.html'),'utf8');assert(html.includes('noindex')&&html.includes('http-equiv="refresh"'));}
 for(const d of m.retained||[]){const raw=fs.readFileSync(path.join(dir,d.path));assert.equal(raw.length,d.bytes);assert.equal(sha(raw),d.sha256);}
 assert.equal(files(path.join(dir,'data/generated/models')).length,m.shards.length+1+(m.retained||[]).filter(d=>d.path.startsWith('data/generated/models/')).length);
 return m;
}
const production=verify('dist',models,store.contract());
assert(fs.readFileSync('dist/robots.txt','utf8').includes('Disallow: /data/'),'Generated data must retain the existing crawl exclusion');
assert.throws(()=>cp.execFileSync('git',['ls-files','--error-unmatch','boatmodels.json'],{stdio:'pipe'}),'Root generated monolith remains tracked');
fs.mkdirSync('.bscout-data',{recursive:true});const fixture=fs.mkdtempSync(path.resolve('.bscout-data/artifacts-test-'));
try{
 const manifest=read('deployment/public-manifest.json'),copy=rel=>{fs.mkdirSync(path.dirname(path.join(fixture,rel)),{recursive:true});fs.copyFileSync(rel,path.join(fixture,rel));};
 for(const rel of [...manifest.rootFiles,...manifest.publicFiles,...manifest.temporaryModeratorFiles,'package.json','deployment/public-manifest.json','deployment/legacy-model-page-redirects.json','developer/build-public-site.js','developer/public-model-artifacts.cjs','developer/canonical-store.cjs','developer/model-page-input.cjs','developer/generate-search-landing-pages.py'])copy(rel);
 for(const dir of manifest.publicDirectories.filter(dir=>dir!=='images'))fs.cpSync(dir,path.join(fixture,dir),{recursive:true});
 copy('images/boat-placeholder.svg');fs.cpSync('data/canonical',path.join(fixture,'data/canonical'),{recursive:true});
 const stalePage='models/'+models[0].CanonicalSlug+'/index.html';fs.mkdirSync(path.dirname(path.join(fixture,stalePage)),{recursive:true});fs.writeFileSync(path.join(fixture,stalePage),'STALE TRACKED PAGE');
 fs.writeFileSync(path.join(fixture,'data/unlisted-research.json'),'[{"sourceOnly":true}]');fs.writeFileSync(path.join(fixture,'knowledge/unlisted-research.json'),'[]');
 const sourceIndex=fs.readFileSync(path.join(fixture,'index.html'));
 const build=()=>cp.execFileSync(process.execPath,['developer/build-public-site.js'],{cwd:fixture,env:{...process.env,SOURCE_DATE_EPOCH:'1792627200'},stdio:'pipe'});
 assert(!fs.existsSync(path.join(fixture,'boatmodels.json')));build();
 const output=path.join(fixture,'dist'),first=digests(output);verify(output,models,store.contract());
 // Retention is one generation, stable for repeated builds and hash-verified.
 const generations=['a','b','b-again','c'].map(name=>path.join(fixture,'.bscout-data/retention-'+name));
 const revisions=['First release','Second release','Second release','Third release'];let previous;
 const releases=generations.map((dir,i)=>{fs.mkdirSync(dir,{recursive:true});const value=writeModels(dir,[{...models[0],Overview:revisions[i]}],store.contract(),{sourceRoot:fixture,previousRoot:previous});previous=dir;return value;});
 assert(releases[1].retained.some(d=>d.path===releases[0].shards[0].path));
 assert.deepEqual(releases[2].retained,releases[1].retained);
 assert(releases[3].retained.some(d=>d.path===releases[1].shards[0].path));
 assert(!fs.existsSync(path.join(generations[3],releases[0].shards[0].path)),'Second-old release escaped retention bound');
 fs.appendFileSync(path.join(generations[2],releases[2].shards[0].path),' ');
 const corruptTarget=path.join(fixture,'.bscout-data/retention-corrupt');fs.mkdirSync(corruptTarget);
 assert.throws(()=>writeModels(corruptTarget,[{...models[0],Overview:'New release'}],store.contract(),{sourceRoot:fixture,previousRoot:generations[2]}),/Corrupt previous shard/);
 assert.throws(()=>writeModels(path.join(fixture,'.bscout-data/oversize'),[{BoatModelID:'OVERSIZE',Overview:'x'.repeat(MAX_BYTES)}],store.contract()),/exceeds public shard limit/);
 const shard=path.join(output,production.shards[0].path),originalShard=fs.readFileSync(shard);fs.appendFileSync(shard,' ');assert.throws(()=>verify(output,models,store.contract()));fs.writeFileSync(shard,originalShard);
 assert(!fs.existsSync(path.join(output,'data/unlisted-research.json')));assert(!fs.existsSync(path.join(output,'knowledge/unlisted-research.json')));assert(!fs.existsSync(path.join(output,'data/canonical')));
 assert.equal(fs.readFileSync(path.join(fixture,stalePage),'utf8'),'STALE TRACKED PAGE');assert(fs.readFileSync(path.join(fixture,'index.html')).equals(sourceIndex));assert(!fs.existsSync(path.join(fixture,'boatmodels.json')));
 fs.writeFileSync(path.join(fixture,'boatmodels.json'),'[]');
 build();assert.deepEqual(digests(output),first,'Fixed-clock builds are not deterministic');assert.equal(fs.readFileSync(path.join(fixture,'boatmodels.json'),'utf8'),'[]');fs.unlinkSync(path.join(fixture,'boatmodels.json'));
 const isolated=require(path.join(fixture,'developer/canonical-store.cjs')),changed=structuredClone(models);changed[0].Overview='Canonical snapshot freshness verification marker';isolated.save(changed);fs.unlinkSync(path.join(fixture,'boatmodels.json'));
 build();const revised=verify(output,changed,store.contract());assert.notEqual(revised.release,production.release);assert(fs.readFileSync(path.join(output,stalePage),'utf8').includes(changed[0].Overview));assert.equal(fs.readFileSync(path.join(fixture,stalePage),'utf8'),'STALE TRACKED PAGE');
 const good=digests(output),required=path.join(fixture,manifest.rootFiles[0]);fs.renameSync(required,required+'.held');
 assert.throws(build);assert.deepEqual(digests(output),good,'Failed build replaced the previous artifact');fs.renameSync(required+'.held',required);
 const failRename=path.join(fixture,'.bscout-data/fail-publish.cjs');
 fs.writeFileSync(failRename,"const fs=require('fs'),path=require('path'),rename=fs.renameSync;fs.renameSync=(from,to)=>{if(from.endsWith(path.sep+'site')&&to===path.resolve('dist'))throw Error('Injected publish rename failure');return rename(from,to);};");
 assert.throws(()=>cp.execFileSync(process.execPath,['--require',failRename,'developer/build-public-site.js'],{cwd:fixture,env:{...process.env,SOURCE_DATE_EPOCH:'1792627200'},stdio:'pipe'}),error=>error.stderr?.toString().includes('Injected publish rename failure'));
 assert.deepEqual(digests(output),good,'Failed replacement did not restore the previous artifact');
 const journal=path.join(fixture,'.bscout-data/canonical-write-journal.json');fs.writeFileSync(journal,JSON.stringify({before:models,after:changed}));assert.throws(build);assert.deepEqual(digests(output),good,'Incomplete canonical write replaced the previous artifact');
}finally{
 assert(fixture.startsWith(path.resolve('.bscout-data')+path.sep));fs.rmSync(fixture,{recursive:true,force:true});
}
console.log(JSON.stringify({status:'PASS',models:models.length,shards:production.shards.length,shardBytes:production.shards.reduce((n,s)=>n+s.bytes,0),largestShard:Math.max(...production.shards.map(s=>s.bytes)),manifestBytes:fs.statSync('dist/data/generated/models/manifest.json').size,lossless:true,deterministic:true,sourceIsolation:true,seoFreshness:true,failedBuildPreservesPrevious:true}));
