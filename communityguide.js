(function(root){
"use strict";
const KNOWLEDGE_KEY="bscoutCommunityKnowledgeItemsV1";
const REVIEWED_KEY="bscoutReviewedContributionsV1";
const ATTACHMENT_DB="bscoutContributionAttachmentsV1";
const ATTACHMENT_STORE="files";
let staticKnowledge=[];
let staticEvidence=[];
let staticReviewed=[];
let readyPromise=null,readyEpoch=-1;
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const read=key=>{try{const v=JSON.parse(root.localStorage?.getItem(key)||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const safeUrl=v=>{try{const u=new URL(String(v||""),root.location?.href);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}};
const uniqBy=(rows,key)=>{const m=new Map();for(const r of rows||[]){const k=r?.[key];if(k)m.set(k,r)}return [...m.values()]};
async function init(){
 const repository=root.BScoutDataRepository.getRepository();
 if(readyPromise&&readyEpoch===repository.epoch)return readyPromise;
 readyEpoch=repository.epoch;
 readyPromise=repository.loadSearchData().then(data=>{
  const k=data.communityKnowledgeItems,e=data.communityKnowledgeEvidence,r=data.communityReviewedContributions,live=data.communityOverlay;
  staticKnowledge=uniqBy([...(Array.isArray(k)?k:[]),...(Array.isArray(live?.knowledgeItems)?live.knowledgeItems:[])],"KnowledgeItemID");
  staticEvidence=uniqBy([...(Array.isArray(e)?e:[]),...(Array.isArray(live?.knowledgeEvidence)?live.knowledgeEvidence:[])],"KnowledgeEvidenceID");
  staticReviewed=uniqBy([...(Array.isArray(r)?r:[]),...(Array.isArray(live?.reviewedContributions)?live.reviewedContributions:[])],"ContributionID");
  return true
 }).catch(error=>{readyPromise=null;throw error;});
 return readyPromise;
}
function itemsForModel(modelId){
 const rows=uniqBy([...staticKnowledge,...read(KNOWLEDGE_KEY)],"KnowledgeItemID");
 return rows.filter(i=>String(i.BoatModelID)===String(modelId)&&i.Status!=="archived"&&(i.EvidenceSummary?.ReportCount||0)>0);
}
function reviewedForModel(modelId,types){
 const typeSet=new Set(types||[]);
 return uniqBy([...staticReviewed,...read(REVIEWED_KEY)],"ContributionID").filter(r=>String(r.ModelID)===String(modelId)&&r.ModerationStatus==="approved"&&(!typeSet.size||typeSet.has(r.ContributionType)));
}
function stateText(item){
 const map={confirmed:"Confirmed",community_supported:"Community-supported",limited_evidence:"Limited evidence",conflicting_information:"Conflicting information",applicability_uncertain:"Applicability uncertain"};
 return map[item.KnowledgeState]||"Community evidence";
}
function applicability(item){
 const a=item.Applicability||{}; const bits=[];
 if(a.YearFrom||a.YearTo) bits.push(a.YearFrom&&a.YearTo&&a.YearFrom===a.YearTo?String(a.YearFrom):`${a.YearFrom||"?"}–${a.YearTo||"?"}`);
 if(Array.isArray(a.Variants)&&a.Variants.length) bits.push(a.Variants.join(", "));
 if(a.Confidence&&a.Confidence!=="known") bits.push(`applicability ${a.Confidence}`);
 return bits.join(" · ");
}
function knowledgeCard(item){
 const s=item.EvidenceSummary||{}; const conflict=s.ConflictingReportCount||0; const qualify=s.QualifyingReportCount||0; const app=applicability(item);
 const summary=item.Summary||"Community evidence has been reviewed for this model; a normalized summary has not yet been written.";
 return `<article class="community-knowledge-card${conflict?" has-conflict":""}">
  <div class="community-knowledge-head"><h4>${esc(item.Title)}</h4><span class="community-evidence-pill">${esc(s.PublicLabel||"Community evidence")}</span></div>
  <p>${esc(summary)}</p>
  <div class="community-knowledge-meta"><span>${esc(stateText(item))}</span>${app?`<span>${esc(app)}</span>`:""}</div>
  <details class="community-evidence-details"><summary>Evidence details</summary><div><p>${s.ReportCount||0} reviewed report${s.ReportCount===1?"":"s"}: ${s.SupportingReportCount||0} supporting${conflict?`, ${conflict} contradicting`:""}${qualify?`, ${qualify} qualifying`:""}.</p>${item.ConflictSummary?`<p><strong>Uncertainty:</strong> ${esc(item.ConflictSummary)}</p>`:""}<p class="workspace-note">Community reports are evidence, not votes. B-Atlas preserves conflicting and uncertain information.</p></div></details>
 </article>`;
}
function renderResearch(modelId){
 const rows=itemsForModel(modelId).filter(i=>["ownership_experience","problem_weakness","other"].includes(i.Category));
 if(!rows.length)return"";
 return `<div class="community-knowledge-list">${rows.map(knowledgeCard).join("")}</div>`;
}
function renderBuyer(modelId){
 const rows=itemsForModel(modelId).filter(i=>["buyer_inspection_advice","problem_weakness"].includes(i.Category));
 if(!rows.length)return"";
 return `<div class="community-knowledge-list">${rows.map(knowledgeCard).join("")}</div>`;
}
function resourceLabel(t){return ({owners_manual:"Owner's manual",engine_manual:"Engine manual",service_manual:"Service manual",parts_manual:"Parts manual",wiring_diagram:"Wiring diagram",brochure:"Brochure",specifications:"Specifications",technical_bulletin:"Technical bulletin",survey_example:"Survey / example survey",club:"Club",association:"Association",forum:"Forum / community",video:"Video",virtual_tour:"Virtual tour",technical_website:"Technical website",other:"Other"})[t]||"Resource"}
function renderResources(modelId){
 const rows=reviewedForModel(modelId,["manual_document","resource"]); if(!rows.length)return"";
 const docs=rows.filter(r=>r.ContributionType==="manual_document"); const resources=rows.filter(r=>r.ContributionType==="resource");
 const list=group=>`<ul class="workspace-resource-list">${group.map(r=>{const p=r.Payload||{};const title=p.DocumentTitle||p.ResourceTitle||"Community resource";const type=p.DocumentType||p.ResourceType;const url=safeUrl(r.SourceURL);const att=(r.AttachmentRefs||[])[0];const published=(r.PublishedAttachmentURLs||[])[0];const action=url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`:published?`<a href="${esc(published)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`:att?`<button type="button" class="community-attachment-link" data-community-attachment="${esc(att)}">${esc(title)}</button>`:`<strong>${esc(title)}</strong>`;return `<li><div>${action}<span>${esc(resourceLabel(type))} · Community submitted · Reviewed</span>${p.DocumentNotes||p.ResourceNotes?`<p>${esc(p.DocumentNotes||p.ResourceNotes)}</p>`:""}</div></li>`}).join("")}</ul>`;
 return `<div class="workspace-section-stack community-resource-stack">${docs.length?`<section class="workspace-card"><h3>Community-added Manuals & Documents</h3>${list(docs)}</section>`:""}${resources.length?`<section class="workspace-card"><h3>Community-added Resources</h3>${list(resources)}</section>`:""}</div>`;
}
function renderPhotos(modelId){
 const rows=reviewedForModel(modelId,["photo"]); if(!rows.length)return"";
 const cards=[];
 for(const r of rows){
  const p=r.Payload||{};
  const refs=Array.isArray(r.AttachmentRefs)?r.AttachmentRefs:[];
  const publishedUrls=Array.isArray(r.PublishedAttachmentURLs)?r.PublishedAttachmentURLs:[];
  const photoCount=Math.max(refs.length,publishedUrls.length,1);
  for(let i=0;i<photoCount;i+=1){
   const att=refs[i]||null;
   const published=publishedUrls[i]||null;
   cards.push(`<figure class="community-photo-card"${!published&&att?` data-community-photo="${esc(att)}"`:""}>${published?`<img src="${esc(published)}" alt="Community-contributed model photo">`:`<div class="community-photo-placeholder">Owner photo</div>`}<figcaption><strong>${esc(p.PhotoCategory||"Photo")}</strong>${r.ModelYear?` · ${esc(r.ModelYear)}`:""}${r.Variant?` · ${esc(r.Variant)}`:""}${p.PhotoState?` · ${esc(p.PhotoState)}`:""}${p.Caption?`<span>${esc(p.Caption)}</span>`:""}${r.DisplayName?`<small>Credit: ${esc(r.DisplayName)}</small>`:""}</figcaption></figure>`);
  }
 }
 return `<div class="community-photo-grid">${cards.join("")}</div>`;
}
function openDb(){return new Promise((resolve,reject)=>{if(!root.indexedDB){reject(new Error("Attachment storage unavailable"));return}const q=root.indexedDB.open(ATTACHMENT_DB,1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
async function getAttachment(id){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,"readonly");const q=tx.objectStore(ATTACHMENT_STORE).get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})}finally{db.close()}}
async function enhance(container){
 if(!container)return;
 for(const fig of container.querySelectorAll("[data-community-photo]")){try{const row=await getAttachment(fig.dataset.communityPhoto);if(row?.Blob){const url=URL.createObjectURL(row.Blob);const holder=fig.querySelector(".community-photo-placeholder");if(holder){const img=document.createElement("img");img.src=url;img.alt=fig.querySelector("figcaption strong")?.textContent||"Community-contributed model photo";img.onload=()=>URL.revokeObjectURL(url);holder.replaceWith(img)}}}catch{/* attachment may live in another moderator browser */}}
 container.querySelectorAll("[data-community-attachment]").forEach(btn=>btn.addEventListener("click",async()=>{try{const row=await getAttachment(btn.dataset.communityAttachment);if(!row?.Blob)throw new Error();const url=URL.createObjectURL(row.Blob);root.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000)}catch{root.alert?.("This approved attachment is not stored in this browser. The shared contribution service will make cross-device attachments available in a later infrastructure phase.")}}));
}
function counts(modelId){const photoRows=reviewedForModel(modelId,["photo"]);const photoCount=photoRows.reduce((sum,r)=>sum+Math.max((r.AttachmentRefs||[]).length,(r.PublishedAttachmentURLs||[]).length,1),0);return {research:itemsForModel(modelId).filter(i=>["ownership_experience","problem_weakness","other"].includes(i.Category)).length,buyer:itemsForModel(modelId).filter(i=>["buyer_inspection_advice","problem_weakness"].includes(i.Category)).length,photos:photoCount,resources:reviewedForModel(modelId,["manual_document","resource"]).length}}
root.BScoutCommunityGuide={init,itemsForModel,renderResearch,renderBuyer,renderResources,renderPhotos,enhance,counts};
if(typeof document!=="undefined")init().then(()=>{try{root.BScoutBoatWorkspace?.refreshActiveTab?.()}catch{}});
})(typeof globalThis!=="undefined"?globalThis:this);
