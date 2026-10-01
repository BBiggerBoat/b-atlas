const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const storePath=path.join(root,"functions","_lib","bscout-store.js");
const apiPath=path.join(root,"functions","api","[[path]].js");
const workerPath=path.join(root,"cloudflare","worker.js");
const outPath=path.join(root,"cloudflare","batlas-api-standalone.js");

let store=fs.readFileSync(storePath,"utf8").replace(/\bexport\s+/g,"");
let api=fs.readFileSync(apiPath,"utf8")
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+"\.\.\/_lib\/bscout-store\.js";\s*/,"")
  .replace(/\bexport\s+async function onRequest/,"async function onRequest");

let worker=fs.readFileSync(workerPath,"utf8")
  .replace(/^import\s+\{\s*onRequest\s*\}\s+from\s+"\.\.\/functions\/api\/\[\[path\]\]\.js";\s*/,"");

const banner=`// B-Atlas standalone Cloudflare Worker bundle.
// GENERATED FILE — do not hand edit.
// Sources: functions/_lib/bscout-store.js, functions/api/[[path]].js, cloudflare/worker.js.
// Regenerate with: npm run build:worker

`;

const output=banner+store.trim()+"\n\n"+api.trim()+"\n\n"+worker.trim()+"\n";
fs.writeFileSync(outPath,output);
console.log(`Generated ${path.relative(root,outPath)} (${output.split("\n").length} lines).`);
