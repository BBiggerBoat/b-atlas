const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=process.cwd(),out=path.resolve('.bscout-data/phase4-architecture/phase3-runtime');
for(const file of ['index.html','datarepository.js','appbootstrap.js','boatworkspace.js','communityguide.js','contributionentry.js','knowledge/knowledgecardui.js','privacy/index.html','saved-models/index.html','developer/public-model-artifacts.cjs']){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,cp.execFileSync('git',['show','4990f6a:'+file],{maxBuffer:2000000}));}
const store=require(path.join(root,'developer/canonical-store.cjs'));
const manifest=require(path.join(out,'developer/public-model-artifacts.cjs')).writeModels(out,store.load(),store.contract(),{sourceRoot:root});
if(manifest.release!=='7c50425ccd25ed65072fed18c43c653717c0d9f1303df8ef5bd0af3641866243')throw Error('Phase 3 reconstruction does not match completed receipt');
console.log('Phase 3 runtime reconstructed and release verified.');
