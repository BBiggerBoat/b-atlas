'use strict';
// Isolated review server only. Rewrites API URLs in served responses, never in
// published files, so browser contribution tests cannot contact production.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..','dist');
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(path.join(__dirname,'../cloudflare/schema.sql'),'utf8'));
const db={prepare(sql){let args=[];const s=sqlite.prepare(sql);return {bind(...v){args=v;return this},async first(){return s.get(...args)||null},async run(){return s.run(...args)},async all(){return {results:s.all(...args)}}}},async batch(items){const out=[];for(const item of items)out.push(await item.run());return out}};
const files=new Map(),env={BSCOUT_DB:db,BSCOUT_ADMIN_TOKEN:crypto.randomUUID(),BSCOUT_FILES:{async get(k){return files.get(k)||null},async put(k,v){files.set(k,v)},async list(){return {keys:[...files.keys()].map(name=>({name})),list_complete:true}}}};
const port=Number(process.env.PORT||8765);
(async()=>{
 const worker=(await import(pathToFileURL(path.join(__dirname,'../cloudflare/worker.js')))).default;
 const server=http.createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,'http://127.0.0.1:'+port);
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const c of req)chunks.push(c);
    const headers=new Headers(req.headers);headers.set('Origin','https://b-atlas.org');headers.set('CF-Connecting-IP','127.0.0.1');
    const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const response=await worker.fetch(request,env,{waitUntil:p=>p.catch(()=>{})});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   let filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));
   if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(404);res.end();return}
   if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
   if(!fs.existsSync(filename)){res.writeHead(404);res.end();return}
   const ext=path.extname(filename),mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'}[ext]||'application/octet-stream';
   let body=fs.readFileSync(filename);
   if(ext==='.js')body=Buffer.from(body.toString('utf8').replaceAll('https://api.b-atlas.org','http://127.0.0.1:'+port));
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(body);
  }catch(e){res.writeHead(500);res.end(e.message)}
 });
 server.listen(port,'127.0.0.1',()=>console.log('Isolated readiness preview at http://127.0.0.1:'+port+'; contribution writes stay in memory.'));
})().catch(e=>{console.error(e);process.exitCode=1});
