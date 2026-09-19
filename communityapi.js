(function(root){
"use strict";
const TOKEN_KEY="bscoutAdminTokenV1";
const API_BASE="https://api.b-atlas.org";
const apiUrl=path=>`${API_BASE}${path}`;
async function request(path,options={}){
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  const token=sessionStorage.getItem(TOKEN_KEY);
  if(options.admin&&token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(apiUrl(path),{...options,headers});
  let body=null;try{body=await res.json()}catch{}
  if(!res.ok) throw new Error(body?.error||`${res.status} ${res.statusText}`);
  return body;
}
async function status(){try{return await request("/api/health")}catch{return {shared:false}}}
async function submit(record,attachments=[]){return request("/api/contributions",{method:"POST",body:JSON.stringify({record,attachments})})}
async function adminSnapshot(){return request("/api/admin/snapshot",{admin:true})}
async function saveAdminSnapshot(snapshot){return request("/api/admin/snapshot",{method:"PUT",admin:true,body:JSON.stringify(snapshot)})}
async function publish(){return request("/api/admin/publish",{method:"POST",admin:true,body:"{}"})}\nasync function backup(){return request("/api/admin/backup",{admin:true})}
async function publicOverlays(){try{return await request("/api/public/overlays")}catch{return {modelPatches:{},addedModels:[],addedManufacturers:[],reviewedContributions:[],knowledgeItems:[],knowledgeEvidence:[],resourceAdditions:[]}}}
async function promote(contribution){
  let baseline={models:[],manufacturers:[]};
  try{
    const [models,manufacturers]=await Promise.all([
      fetch("boatmodels.json",{cache:"no-store"}).then(r=>r.ok?r.json():[]),
      fetch("data/registry/manufacturers.json",{cache:"no-store"}).then(r=>r.ok?r.json():[])
    ]);
    baseline={models:Array.isArray(models)?models.map(x=>({BoatModelID:x.BoatModelID,ManufacturerID:x.ManufacturerID,Manufacturer:x.Manufacturer,Model:x.Model,Variant:x.Variant,CanonicalSlug:x.CanonicalSlug,CanonicalPath:x.CanonicalPath,CanonicalURL:x.CanonicalURL})):[],manufacturers:Array.isArray(manufacturers)?manufacturers.map(x=>({ManufacturerCode:x.ManufacturerCode,CanonicalName:x.CanonicalName})):[]};
  }catch{}
  return request("/api/admin/promote",{method:"POST",admin:true,body:JSON.stringify({contribution,baseline})})
}
function setAdminToken(token){if(token)sessionStorage.setItem(TOKEN_KEY,token);else sessionStorage.removeItem(TOKEN_KEY)}
function hasAdminToken(){return !!sessionStorage.getItem(TOKEN_KEY)}
async function fetchAttachment(id){const token=sessionStorage.getItem(TOKEN_KEY)||"";const res=await fetch(apiUrl(`/api/admin/attachments/${encodeURIComponent(id)}`),{headers:{Authorization:`Bearer ${token}`}});if(!res.ok)throw new Error("Attachment could not be loaded");return res.blob()}
root.BScoutCommunityAPI={status,submit,adminSnapshot,saveAdminSnapshot,publish,backup,promote,publicOverlays,setAdminToken,hasAdminToken,fetchAttachment};
})(window);
