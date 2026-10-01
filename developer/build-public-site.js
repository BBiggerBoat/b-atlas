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

// Static SEO pages remain crawlable, but human navigation should return to the
// full interactive application instead of chaining through the simplified
// landing-page shell.
function walkHtml(dir, files=[]){
  if(!fs.existsSync(dir)) return files;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walkHtml(full,files);
    else if(entry.isFile()&&entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}
const boats=JSON.parse(fs.readFileSync(path.join(root,"boatmodels.json"),"utf8"));
const slugToId=new Map((Array.isArray(boats)?boats:[]).map(row=>[String(row.CanonicalSlug||"").trim(),String(row.BoatModelID||"").trim()]).filter(([slug,id])=>slug&&id));
for(const file of walkHtml(out)){
  let html=fs.readFileSync(file,"utf8");

  // Top-level Boat Models links on static pages return to the interactive catalogue.
  html=html.replace(/href="(?:\.\.\/)*models\/?"/g,'href="/#boat-models"');
  html=html.replace(/href="\/models\/?"/g,'href="/#boat-models"');

  // Links from static index/manufacturer/criteria pages to individual model
  // landing pages open the interactive guide directly.
  html=html.replace(/href="([^"]*?models\/([^/"?#]+)\/?)"/g,(match,href,slug)=>{
    const id=slugToId.get(slug);
    return id?`href="/?model=${encodeURIComponent(id)}"`:match;
  });
  html=html.replace(/href="\.\.\/([^/"?#]+)\/"/g,(match,slug)=>{
    if(!file.includes(path.join(out,"models"))) return match;
    const id=slugToId.get(slug);
    return id?`href="/?model=${encodeURIComponent(id)}"`:match;
  });

  fs.writeFileSync(file,html);
}

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
