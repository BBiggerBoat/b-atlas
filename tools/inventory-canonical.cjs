"use strict";
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
function files(dir,base='') {
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
   if(['.git','node_modules','dist','.bscout-data'].includes(e.name)) return [];
   const rel=base+e.name;
   return e.isDirectory()?files(path.join(dir,e.name),rel+'/'):[rel];
 });
}
const all=files(root), rules=read('data/canonical/ownership.json');
const sources=all.filter(p=>/\.(js|cjs|py|html|yml)$/.test(p)&&!p.startsWith('archive/'));
const texts=new Map(sources.map(p=>[p,fs.readFileSync(path.join(root,p),'utf8')]));
const publicManifest=read('deployment/public-manifest.json');
const role=p=>p.startsWith('archive/')?'historical archive':Object.values(rules.datasets).includes(p)?'authoritative model owner':p==='boatmodels.json'?'generated public view':/phase2-|enrichment|evidence\/|decision-data-patches/.test(p)?'historical research':/schema|field-registry|unit-registry/.test(p)?'schema or field metadata':/registry\//.test(p)?'identity decisions or manufacturer registry':/production-phases/.test(p)?'scoped production overrides':/knowledge\//.test(p)?'evidence or resources': 'application configuration or auxiliary data';
const json=all.filter(p=>p.endsWith('.json')&&p!=='reports/canonical-inventory.json').map(p=>{
 const bytes=fs.readFileSync(path.join(root,p)); let value;
 try {value=JSON.parse(bytes)} catch(e) {throw Error(`Invalid JSON ${p}: ${e.message}`)}
 return {path:p,role:role(p),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),records:Array.isArray(value)?value.length:null,keys:Array.isArray(value)?[...new Set(value.flatMap(x=>x&&typeof x==='object'?Object.keys(x):[]))].sort():Object.keys(value||{}),consumers:[...texts].filter(([,t])=>t.includes(p)||t.includes(path.posix.basename(p))).map(([f])=>f)};
});
const fields=Object.entries(rules.fields).map(([field,owner])=>({field,owner,dataset:rules.datasets[owner],consumers:[...texts].filter(([,text])=>new RegExp('\\b'+field+'\\b').test(text)).map(([p])=>p)}));
const report={schemaVersion:1,note:'Static string/reference inventory, including dynamic consumer candidates; runtime behavior is separately tested. The inventory excludes its own output. boatmodels.json is the only published model-wide view.',dependencies:read('package.json'),datasets:json,otherDataFiles:all.filter(p=>/\.(sql|jsonc|csv|tsv|ya?ml)$/.test(p)),fields,publicExclusions:publicManifest.sourceOnlyNeverPublish};
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports/canonical-inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Inventoried ${json.length} JSON files, ${fields.length} fields, ${sources.length} source consumers.`);
