const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const ignoredDirs=new Set([".git","node_modules","dist"]);
const forbiddenNames=[
  /^\.env(?:\.|$)/,
  /^\.dev\.vars(?:\.|$)/,
  /^credentials\.json$/i,
  /^secrets\.json$/i,
  /\.(?:pem|key|p12|pfx)$/i
];
const contentRules=[
  {name:"private key",re:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/},
  {name:"Cloudflare API token assignment",re:/CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i},
  {name:"B-Atlas admin token assignment",re:/BSCOUT_ADMIN_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i},
  {name:"AWS access key",re:/AKIA[0-9A-Z]{16}/}
];

const findings=[];

function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignoredDirs.has(ent.name)) continue;
    const full=path.join(dir,ent.name);
    const rel=path.relative(root,full).replace(/\\/g,"/");
    if(ent.isDirectory()){ walk(full); continue; }
    if(!ent.isFile()) continue;

    if(forbiddenNames.some(re=>re.test(ent.name))){
      findings.push(`${rel}: forbidden secret/local filename`);
      continue;
    }

    let stat;
    try{stat=fs.statSync(full)}catch{continue}
    if(stat.size>2*1024*1024) continue;

    let text;
    try{text=fs.readFileSync(full,"utf8")}catch{continue}
    for(const rule of contentRules){
      if(rule.re.test(text)) findings.push(`${rel}: possible ${rule.name}`);
    }
  }
}

walk(root);

if(findings.length){
  console.error("B-Atlas secret guard failed:");
  for(const f of findings) console.error(` - ${f}`);
  process.exit(1);
}
console.log("B-Atlas secret guard OK: no forbidden local secret files or obvious committed credentials found.");
