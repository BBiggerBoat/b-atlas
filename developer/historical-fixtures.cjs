'use strict';
// Frozen historical bytes, independent of current owners and local Git history.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../archive/phase5-fixtures');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function manifest(){const value=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));if(value.schema!=='batlas-historical-fixtures-v1'||value.maxPartBytes!==150000)throw Error('Unknown historical fixture schema');return value;}
function read(name){
 const entries=manifest().entries;
 if(!Object.hasOwn(entries,name))throw Error('Unknown historical fixture: '+name);
 const entry=entries[name];
 let bytes=Buffer.concat(entry.parts.map(part=>{
  if(!/^[a-f0-9]{64}\.txt$/.test(part.file)||part.file!==part.sha256+'.txt')throw Error('Unsafe historical fixture path');
  const value=fs.readFileSync(path.join(root,'parts',part.file));
  if(value.length!==part.bytes||sha(value)!==part.sha256||value.length>150000)throw Error('Historical fixture part integrity failure: '+name);
  return value;
 }));
 if(entry.restoreLineEndings==='crlf')bytes=Buffer.from(bytes.toString('utf8').replace(/\n/g,'\r\n'));
 else if(entry.restoreLineEndings!==undefined)throw Error('Unknown historical line-ending encoding');
 if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('Historical fixture integrity failure: '+name);
 return bytes;
}
function json(name){return JSON.parse(read(name).toString('utf8'));}
function verify(){const m=manifest();for(const name of Object.keys(m.entries))read(name);return {entries:Object.keys(m.entries).length,parts:new Set(Object.values(m.entries).flatMap(e=>e.parts.map(p=>p.file))).size};}
module.exports={read,json,manifest,verify};
if(require.main===module)console.log(JSON.stringify({status:'PASS',...verify()}));
