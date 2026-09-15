// B-Atlas v7.06.2 IndexNow helper. Run AFTER the site is deployed: node developer/submit-indexnow.js
const fs = require('fs');
const path = require('path');
const key = '7ec2c4a2ebce4b11a764cb71628ae16c';
const sitemap = fs.readFileSync(path.join(__dirname,'..','sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
const payload = {host:'b-atlas.org',key,keyLocation:`https://b-atlas.org/${key}.txt`,urlList:urls};
(async()=>{const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify(payload)}); console.log(`IndexNow: ${r.status} ${r.statusText}; URLs submitted: ${urls.length}`); if(!r.ok) process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1});
