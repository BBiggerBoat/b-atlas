'use strict';
// Use the application image resolver for generated pages too; no new image authority.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context={};
vm.runInNewContext(fs.readFileSync(path.join(root,'imageassetmanager.js'),'utf8'),context);
const models=require('./canonical-store.cjs').load();
const fetchImpl=async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,file.split('?')[0]),'utf8'))});
(async()=>{
 await context.ImageAssetManager.loadImageAssetRegistry(fetchImpl);
 const imageSources=Object.fromEntries(models.map(model=>{
  const selected=context.ImageAssetManager.resolveBoatImage(model);
  const usable=/^https?:\/\//.test(selected)||fs.existsSync(path.join(root,selected));
  return [model.BoatModelID,usable?selected:context.ImageAssetManager.PLACEHOLDER_PATH];
 }));
 process.stdout.write(JSON.stringify({models,imageSources}));
})().catch(e=>{console.error(e);process.exitCode=1});
