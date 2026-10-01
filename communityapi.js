(function(root){
"use strict";
const API_BASE="https://api.b-atlas.org";
const apiUrl=path=>`${API_BASE}${path}`;

async function request(path,options={}){
  const normalized=String(path||"");
  if(normalized.startsWith("/api/admin/")) throw new Error("Administrative API routes are not available from the public B-Atlas client");
  const headers={"Accept":"application/json","Content-Type":"application/json",...(options.headers||{})};
  const res=await fetch(apiUrl(normalized),{...options,headers,credentials:"omit"});
  let body=null;try{body=await res.json()}catch{}
  if(!res.ok) throw new Error(body?.error||`${res.status} ${res.statusText}`);
  return body;
}

async function status(){
  try{return await request("/api/health")}
  catch{return {shared:false}}
}

async function submit(record,attachments=[]){
  return request("/api/contributions",{method:"POST",body:JSON.stringify({record,attachments})});
}

async function publicOverlays(){
  try{return await request("/api/public/overlays")}
  catch{return {modelPatches:{},addedModels:[],addedManufacturers:[],reviewedContributions:[],knowledgeItems:[],knowledgeEvidence:[],resourceAdditions:[]}}
}

root.BScoutCommunityAPI={status,submit,publicOverlays};
})(window);
