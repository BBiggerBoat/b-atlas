(function(root){
"use strict";

const TOKEN_KEY="bscoutAdminTokenV1";
const API_BASE="https://api.b-atlas.org";
const apiUrl=path=>`${API_BASE}${path}`;
const api=root.BScoutCommunityAPI||{};

async function adminRequest(path,options={}){
  const normalized=String(path||"");
  if(!normalized.startsWith("/api/admin/")) throw new Error("Moderator client may only call /api/admin/ routes");
  const token=sessionStorage.getItem(TOKEN_KEY);
  if(!token) throw new Error("Moderator authentication required");
  const headers={
    "Accept":"application/json",
    "Content-Type":"application/json",
    "Authorization":`Bearer ${token}`,
    ...(options.headers||{})
  };
  const res=await fetch(apiUrl(normalized),{...options,headers,credentials:"omit"});
  let body=null;try{body=await res.json()}catch{}
  if(res.status===401||res.status===403) sessionStorage.removeItem(TOKEN_KEY);
  if(!res.ok) throw new Error(body?.error||`${res.status} ${res.statusText}`);
  if(options.method && options.method!=="GET")root.BScoutDataRepository?.getRepository().invalidate();
  return body;
}

async function adminSnapshot(){const snapshot=await adminRequest("/api/admin/snapshot");root.BScoutDataRepository?.getRepository().invalidate();return snapshot}
async function saveAdminSnapshot(snapshot){return adminRequest("/api/admin/snapshot",{method:"PUT",body:JSON.stringify(snapshot)})}
async function publish(){return adminRequest("/api/admin/publish",{method:"POST",body:"{}"})}
async function backup(){return adminRequest("/api/admin/backup")}
async function canonicalHistory(){return adminRequest("/api/admin/canonical-history")}
async function revertCanonicalChange(changeId){return adminRequest(`/api/admin/canonical-history/${encodeURIComponent(changeId)}/revert`,{method:"POST",body:"{}"})}

async function reconciliation(){
  if(typeof api.publicOverlays!=="function") throw new Error("Public B-Atlas API client is unavailable");
  const repository=root.BScoutDataRepository.getRepository();
  const [data,publishedOverlay]=await Promise.all([repository.loadBaseline(),repository.loadOverlay()]);
  if(!publishedOverlay)throw Error("Published overlays unavailable; reconciliation cannot be verified");
  const baselineMeta={baselineVersion:data.baselineVersion},models=data.boats,manufacturers=data.manufacturers,published=publishedOverlay||{};
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

async function promote(contribution){
  // A failed required baseline must stop promotion, never submit an empty duplicate-check list.
  const data=await root.BScoutDataRepository.getRepository().loadBaseline();
  const baseline={
    models:data.boats.map(x=>({BoatModelID:x.BoatModelID,ManufacturerID:x.ManufacturerID,Manufacturer:x.Manufacturer,Model:x.Model,Variant:x.Variant,CanonicalSlug:x.CanonicalSlug,CanonicalPath:x.CanonicalPath,CanonicalURL:x.CanonicalURL})),
    manufacturers:data.manufacturers.map(x=>({ManufacturerCode:x.ManufacturerCode,CanonicalName:x.CanonicalName}))
  };
  return adminRequest("/api/admin/promote",{method:"POST",body:JSON.stringify({contribution,baseline})});
}

function setAdminToken(token){
  const value=String(token||"").trim();
  if(value) sessionStorage.setItem(TOKEN_KEY,value);
  else sessionStorage.removeItem(TOKEN_KEY);
}
function hasAdminToken(){return !!sessionStorage.getItem(TOKEN_KEY)}

async function fetchAttachment(id){
  const token=sessionStorage.getItem(TOKEN_KEY);
  if(!token) throw new Error("Moderator authentication required");
  const res=await fetch(apiUrl(`/api/admin/attachments/${encodeURIComponent(id)}`),{
    headers:{"Authorization":`Bearer ${token}`},
    credentials:"omit"
  });
  if(!res.ok) throw new Error("Attachment could not be loaded");
  return res.blob();
}

Object.assign(api,{
  adminSnapshot,
  saveAdminSnapshot,
  publish,
  backup,
  canonicalHistory,
  revertCanonicalChange,
  reconciliation,
  promote,
  setAdminToken,
  hasAdminToken,
  fetchAttachment
});

root.BScoutCommunityAPI=api;
})(window);
