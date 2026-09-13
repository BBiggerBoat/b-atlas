#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const assert=(cond,msg)=>{if(!cond) throw new Error(msg)};
assert(fs.existsSync(path.join(ROOT,'boatmodels.json')),'boatmodels.json must exist');
assert(!fs.existsSync(path.join(ROOT,'knowledge/data/facts.json')),'active facts.json must remain retired');
const cards=read('knowledge/data/knowledgecards.json');
assert(cards.every(c=>!Object.prototype.hasOwnProperty.call(c,'specifications')),'knowledge cards must not duplicate model specifications');
const manifest=read('data/data-manifest.json');
const pkg=read('package.json');
assert(manifest.Release===`v${pkg.version}`,`manifest release must match package version v${pkg.version}`);
const managed=(manifest.managed||[]).map(x=>typeof x==='string'?x:x.path);
assert(!managed.includes('knowledge/data/facts.json'),'facts.json must not be managed');
const specFields=new Set(['FirstYear','LastYear','LOA','LWL','Beam','Draft','AirDraft','Displacement','FuelCapacity','WaterCapacity','HoldingCapacity','Berths','Cabins','Heads','HullType','Construction','KeelType','Fuel','EngineConfiguration','Propulsion','Flybridge','AftCabin','SideDecks','NormalizedFuel','NormalizedPropulsion','NormalizedHullForm','NormalizedHullConfiguration','NormalizedStyle','Headroom','RudderType','KeelConfiguration']);
const allowed=new Set(['boatmodels.json','data/production-phases.json','data/community-reviewed-contributions.json','data/community-contribution.example.json']);
function walkFiles(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const rel=path.relative(ROOT,path.join(dir,ent.name)).replace(/\\/g,'/'); if(rel.startsWith('developer/')) continue; if(ent.isDirectory()) walkFiles(path.join(dir,ent.name),out); else if(ent.name.endsWith('.json')) out.push(rel);} return out;}
const violations=[];
function scan(node,file){if(Array.isArray(node)){node.forEach(x=>scan(x,file));return;} if(!node||typeof node!=='object')return; if(node.BoatModelID){for(const k of specFields){if(Object.prototype.hasOwnProperty.call(node,k) && node[k]!==null && node[k]!=='' && !allowed.has(file)) violations.push(`${file}: ${node.BoatModelID}.${k}`);}}
 if(Object.prototype.hasOwnProperty.call(node,'AttributeID') && Object.prototype.hasOwnProperty.call(node,'Value') && node.BoatModelID && !allowed.has(file)) violations.push(`${file}: ${node.BoatModelID}.${node.AttributeID} via AttributeID/Value`);
 Object.values(node).forEach(v=>scan(v,file));}
for(const file of walkFiles(ROOT)){if(file==='boatmodels.json')continue; scan(read(file),file);}
assert(violations.length===0,`duplicate active model specifications found:\n${violations.slice(0,40).join('\n')}`);
console.log(`v${pkg.version} single-source model-data tests passed`);
