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
async function publish(){return request("/api/admin/publish",{method:"POST",admin:true,body:"{}"})}
async function backup(){return request("/api/admin/backup",{admin:true})}
async function canonicalHistory(){return request("/api/admin/canonical-history",{admin:true})}
async function revertCanonicalChange(changeId){return request(`/api/admin/canonical-history/${encodeURIComponent(changeId)}/revert`,{method:"POST",admin:true,body:"{}"})}
async function reconciliation(){
  const [baselineMeta,models,manufacturers,published]=await Promise.all([
    fetch("/baseline-version.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Baseline version manifest unavailable");return r.json()}),
    fetch("/boatmodels.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Baseline boat models unavailable");return r.json()}),
    fetch("/data/registry/manufacturers.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Baseline manufacturer registry unavailable");return r.json()}),
    request("/api/public/overlays")
  ]);
  const modelRows=Array.isArray(models)?models:[], manufacturerRows=Array.isArray(manufacturers)?manufacturers:[];
  const byModel=new Map(modelRows.map(x=>[String(x.BoatModelID||""),x]));
  const byManufacturer=new Map(manufacturerRows.map(x=>[String(x.ManufacturerCode||""),x]));
  const patches=published.modelPatches||{}, addedModels=published.addedModels||[], addedManufacturers=published.addedManufacturers||[];
  const patchRows=Object.entries(patches).map(([modelId,patch])=>({
    modelId,
    baselinePresent:byModel.has(modelId),
    fields:Object.keys(patch||{}).filter(k=>!["LastUpdated","ReviewedBy"].includes(k)),
    lastUpdated:patch?.LastUpdated||null
  }));
  const duplicateAddedModels=addedModels.filter(x=>x?.BoatModelID&&byModel.has(String(x.BoatModelID))).map(x=>x.BoatModelID);
  const duplicateAddedManufacturers=addedManufacturers.filter(x=>x?.ManufacturerCode&&byManufacturer.has(String(x.ManufacturerCode))).map(x=>x.ManufacturerCode);
  return {
    schema:"batlas-reconciliation-v1",
    generatedAt:new Date().toISOString(),
    baselineVersion:baselineMeta.baselineVersion||null,
    baseline:{models:modelRows.length,manufacturers:manufacturerRows.length},
    overlay:{
      patchedModels:patchRows.length,
      patchFields:patchRows.reduce((n,x)=>n+x.fields.length,0),
      addedModels:addedModels.length,
      addedManufacturers:addedManufacturers.length,
      reviewedContributions:(published.reviewedContributions||[]).length,
      knowledgeItems:(published.knowledgeItems||[]).length,
      knowledgeEvidence:(published.knowledgeEvidence||[]).length,
      resourceAdditions:(published.resourceAdditions||[]).length
    },
    issues:{
      patchesWithoutBaselineModel:patchRows.filter(x=>!x.baselinePresent).map(x=>x.modelId),
      addedModelsAlreadyInBaseline:duplicateAddedModels,
      addedManufacturersAlreadyInBaseline:duplicateAddedManufacturers
    },
    patches:patchRows,
    status:(patchRows.some(x=>!x.baselinePresent)||duplicateAddedModels.length||duplicateAddedManufacturers.length)?"attention":"ok"
  };
}
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
root.BScoutCommunityAPI={status,submit,adminSnapshot,saveAdminSnapshot,publish,backup,canonicalHistory,revertCanonicalChange,reconciliation,promote,publicOverlays,setAdminToken,hasAdminToken,fetchAttachment};
})(window);
