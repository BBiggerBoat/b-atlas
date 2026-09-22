const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const out=path.join(root,"dist");
const manifestPath=path.join(root,"deployment","public-manifest.json");
const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));

function resetDir(dir){
  fs.rmSync(dir,{recursive:true,force:true});
  fs.mkdirSync(dir,{recursive:true});
}
function copyFile(rel){
  const src=path.join(root,rel);
  const dst=path.join(out,rel);
  if(!fs.existsSync(src)) throw new Error(`Missing allowlisted file: ${rel}`);
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
}
function copyDir(rel){
  const src=path.join(root,rel);
  const dst=path.join(out,rel);
  if(!fs.existsSync(src)) throw new Error(`Missing allowlisted directory: ${rel}`);
  fs.cpSync(src,dst,{recursive:true});
}

resetDir(out);
for(const rel of manifest.rootFiles) copyFile(rel);
for(const rel of manifest.publicDirectories) copyDir(rel);
for(const rel of manifest.temporaryModeratorFiles) copyFile(rel);

const marker={
  schema:"batlas-public-build-v1",
  builtAt:new Date().toISOString(),
  baseline:manifest.version,
  rootFileCount:manifest.rootFiles.length,
  publicDirectoryCount:manifest.publicDirectories.length,
  temporaryModeratorFileCount:manifest.temporaryModeratorFiles.length
};
fs.writeFileSync(path.join(out,"public-build.json"),JSON.stringify(marker,null,2)+"\n");
console.log(`B-Atlas public build created in dist/ with ${manifest.rootFiles.length} root files, ${manifest.publicDirectories.length} public directories and ${manifest.temporaryModeratorFiles.length} temporary moderator files.`);
