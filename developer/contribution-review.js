(function(root){
"use strict";
const PENDING_KEY="bscoutPendingContributionsV1";
const REVIEWED_KEY="bscoutReviewedContributionsV1";
const KNOWLEDGE_KEY="bscoutCommunityKnowledgeItemsV1";
const KNOWLEDGE_EVIDENCE_KEY="bscoutCommunityKnowledgeEvidenceV1";
const ATTACHMENT_DB="bscoutContributionAttachmentsV1";
const ATTACHMENT_STORE="files";
const KNOWLEDGE_TYPES=new Set(["ownership_experience","problem_weakness","buyer_inspection_advice","other"]);
let taxonomy=[];
let selectedId=null;
let sharedConnected=false;
let hydratingShared=false;
let sharedSyncTimer=null;
let objectUrls=[];
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const read=(key)=>{try{const v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const write=(key,rows)=>{localStorage.setItem(key,JSON.stringify(rows));scheduleSharedSync()};
function localSnapshot(){return {pending:read(PENDING_KEY),reviewed:read(REVIEWED_KEY),knowledgeItems:read(KNOWLEDGE_KEY),knowledgeEvidence:read(KNOWLEDGE_EVIDENCE_KEY)}}
function scheduleSharedSync(){if(!sharedConnected||hydratingShared||!root.BScoutCommunityAPI)return;clearTimeout(sharedSyncTimer);sharedSyncTimer=setTimeout(()=>root.BScoutCommunityAPI.saveAdminSnapshot(localSnapshot()).catch(e=>sharedMessage(`Shared sync failed: ${e.message}`)),350)}
function sharedMessage(text){const el=$("sharedBackendMessage");if(el){el.hidden=!text;el.textContent=text||""}}
function sharedStatus(text){const el=$("sharedBackendStatus");if(el)el.textContent=text}
async function hydrateFromShared(){let snap=await root.BScoutCommunityAPI.adminSnapshot();const local=localSnapshot();const sharedRows=(snap.pending||[]).length+(snap.reviewed||[]).length;if(sharedRows===0&&(local.pending.length||local.reviewed.length)){snap={...snap,...local};await root.BScoutCommunityAPI.saveAdminSnapshot(snap);sharedMessage("The empty shared queue was initialized from this browser's existing moderator records.")}hydratingShared=true;try{localStorage.setItem(PENDING_KEY,JSON.stringify(snap.pending||[]));localStorage.setItem(REVIEWED_KEY,JSON.stringify(snap.reviewed||[]));localStorage.setItem(KNOWLEDGE_KEY,JSON.stringify(snap.knowledgeItems||[]));localStorage.setItem(KNOWLEDGE_EVIDENCE_KEY,JSON.stringify(snap.knowledgeEvidence||[]))}finally{hydratingShared=false}sharedConnected=true;sharedStatus(`Connected to shared queue · updated ${snap.updatedAt?new Date(snap.updatedAt).toLocaleString():"now"}`);refreshKnowledgeSummaries();renderQueue();if(selectedId&&allRows().some(r=>r.ContributionID===selectedId))openRecord(selectedId)}
async function connectShared(){if(!root.BScoutCommunityAPI)return;let token=prompt("Enter the B-Atlas moderator token. It is kept only for this browser session.");if(!token)return;root.BScoutCommunityAPI.setAdminToken(token.trim());try{await hydrateFromShared()}catch(e){root.BScoutCommunityAPI.setAdminToken("");sharedConnected=false;sharedStatus("Shared backend available, moderator not connected.");sharedMessage(e.message)}}
async function refreshShared(){try{await hydrateFromShared()}catch(e){sharedMessage(e.message)}}
async function publishShared(){try{if(!sharedConnected)throw new Error("Connect as moderator first.");await root.BScoutCommunityAPI.saveAdminSnapshot(localSnapshot());const r=await root.BScoutCommunityAPI.publish();sharedMessage(`Published ${r.knowledgeItems} knowledge item(s), ${r.knowledgeEvidence} evidence link(s), ${r.reviewedContributions||0} reviewed contribution(s), and ${r.canonicalCorrections||0} canonical correction(s).`);sharedStatus("Shared queue connected · published") }catch(e){sharedMessage(`Publish failed: ${e.message}`)}}
async function reconciliationShared(){try{if(!sharedConnected)throw new Error("Connect as moderator first.");const r=await root.BScoutCommunityAPI.reconciliation();const i=r.issues||{},issueCount=(i.patchesWithoutBaselineModel||[]).length+(i.addedModelsAlreadyInBaseline||[]).length+(i.addedManufacturersAlreadyInBaseline||[]).length;sharedMessage(`Reconciliation ${r.status==="ok"?"OK":"needs attention"} · baseline v${r.baselineVersion||"unknown"} · ${r.baseline.models} baseline models · ${r.overlay.patchedModels} patched model(s) / ${r.overlay.patchFields} field(s) · ${r.overlay.addedModels} D1-added model(s) · ${r.overlay.addedManufacturers} D1-added manufacturer(s)${issueCount?` · ${issueCount} integrity issue(s)`:" · no structural conflicts"}.`);return r}catch(e){sharedMessage(`Reconciliation failed: ${e.message}`)}} 
async function backupShared(){try{if(!sharedConnected)throw new Error("Connect as moderator first.");const data=await root.BScoutCommunityAPI.backup();const stamp=new Date().toISOString().replace(/[:.]/g,"-");const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`B-Atlas_Backup_${stamp}.json`;a.click();URL.revokeObjectURL(url);sharedMessage(`Backup downloaded: ${data.snapshot?.pending?.length||0} pending, ${data.snapshot?.reviewed?.length||0} reviewed, ${data.attachments?.count||0} attachment reference(s).`)}catch(e){sharedMessage(`Backup failed: ${e.message}`)}}
async function initShared(){if(!root.BScoutCommunityAPI){sharedStatus("Shared backend client unavailable.");return}const st=await root.BScoutCommunityAPI.status();if(!st.shared){sharedStatus("Shared backend not running. Moderator is using browser-local prototype data.");return}if(!st.adminConfigured){sharedStatus("Shared backend is running, but BSCOUT_ADMIN_TOKEN is not configured on the server.");return}sharedStatus("Shared backend available. Connect as moderator to load the central queue.");if(root.BScoutCommunityAPI.hasAdminToken()){try{await hydrateFromShared()}catch{}}}
const allRows=()=>[...read(PENDING_KEY),...read(REVIEWED_KEY)];
const typeLabel=id=>taxonomy.find(x=>x.id===id)?.label||String(id||"").replaceAll("_"," ");
const statusLabel=s=>String(s||"pending").replaceAll("_"," ");
const slug=s=>String(s||"").toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,38)||"ITEM";
const makeId=(prefix)=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

const CANONICAL_DRAFT_FIELDS={
 new_manufacturer:[
  ["CanonicalName","Canonical manufacturer name","text","wide"],
  ["ManufacturerCode","Manufacturer code","text"],
  ["Country","Country","text"],
  ["YearStart","Established / first known year","number"],
  ["YearEnd","Last active year","number"],
  ["Website","Website / primary source","url","wide"],
  ["Aliases","Aliases / alternate names","text","wide"],
  ["Status","Status","text"]
 ],
 new_model:[
  ["Manufacturer","Canonical manufacturer","text"],
  ["ManufacturerCode","Manufacturer code","text"],
  ["Model","Canonical model name","text"],
  ["Variant","Variant / layout","text"],
  ["YearStart","First production year","number"],
  ["YearEnd","Last production year","number"],
  ["LengthFt","Length (ft)","number"],
  ["BeamFt","Beam (ft)","number"],
  ["DraftFt","Draft (ft)","number"],
  ["DisplacementLb","Displacement (lb)","number"],
  ["BoatFamily","Boat family","text"],
  ["Fuel","Fuel","text"],
  ["Propulsion","Propulsion","text"],
  ["HullBehaviour","Hull behaviour","text"],
  ["EngineConfiguration","Engine configuration","text"],
  ["Designer","Designer","text"],
  ["Construction","Construction","text","wide"],
  ["SourceURL","Primary source","url","wide"]
 ]
};
function isCanonicalDraftType(row){return !!row&&["new_manufacturer","new_model"].includes(row.ContributionType)}
function draftDefaults(row){const p=row.Payload||{};if(row.ContributionType==="new_manufacturer")return {CanonicalName:p.ProposedManufacturer||row.ManufacturerName||"",ManufacturerCode:"",Country:p.ProposedCountry||"",YearStart:p.ProposedYearStart||"",YearEnd:p.ProposedYearEnd||"",Website:row.SourceURL||"",Aliases:"",Status:""};return {Manufacturer:p.ProposedManufacturer||row.ManufacturerName||"",ManufacturerCode:"",Model:p.ProposedModel||row.ModelName||"",Variant:p.ProposedVariant||row.Variant||"",YearStart:p.ProposedYearStart||"",YearEnd:p.ProposedYearEnd||"",LengthFt:p.ProposedLengthFt||"",BeamFt:p.ProposedBeamFt||"",DraftFt:"",DisplacementLb:"",BoatFamily:p.ProposedBoatFamily||"",Fuel:p.ProposedFuel||"",Propulsion:p.ProposedPropulsion||"",HullBehaviour:p.ProposedHullType||"",EngineConfiguration:"",Designer:"",Construction:"",SourceURL:row.SourceURL||""}}
function draftState(row){return row.CanonicalDraft||{RecordType:row.ContributionType==="new_manufacturer"?"manufacturer":"model",Fields:draftDefaults(row),AdditionalFields:[],ResearchNotes:""}}
function renderCanonicalDraft(row){const box=$("canonicalDraftBox");if(!isCanonicalDraftType(row)){box.hidden=true;return}box.hidden=false;const state=draftState(row),defs=CANONICAL_DRAFT_FIELDS[row.ContributionType]||[];$("canonicalDraftFields").innerHTML=defs.map(([key,label,type,wide])=>`<label class="${wide||""}">${esc(label)}<input data-canonical-key="${esc(key)}" type="${esc(type)}" ${type==="number"?'step="any"':''} value="${esc(state.Fields?.[key]??"")}"></label>`).join("");$("canonicalResearchNotes").value=state.ResearchNotes||"";renderAdditionalCanonicalFields(state.AdditionalFields||[])}
function renderAdditionalCanonicalFields(rows=[]){const target=$("canonicalAdditionalFields");target.innerHTML=rows.map((r,i)=>`<div class="canonical-extra-row" data-extra-index="${i}"><input class="canonical-extra-key" type="text" maxlength="80" placeholder="Field name" value="${esc(r.Key||"")}"><input class="canonical-extra-value" type="text" maxlength="500" placeholder="Value" value="${esc(r.Value||"")}"><button type="button" class="remove-canonical-field">Remove</button></div>`).join("")}
function addCanonicalField(){const target=$("canonicalAdditionalFields"),div=document.createElement("div");div.className="canonical-extra-row";div.innerHTML='<input class="canonical-extra-key" type="text" maxlength="80" placeholder="Field name"><input class="canonical-extra-value" type="text" maxlength="500" placeholder="Value"><button type="button" class="remove-canonical-field">Remove</button>';target.appendChild(div);div.querySelector("input")?.focus()}
function collectCanonicalDraft(row){if(!isCanonicalDraftType(row))return null;const fields={};document.querySelectorAll("[data-canonical-key]").forEach(el=>{fields[el.dataset.canonicalKey]=String(el.value||"").trim()});const extras=[...document.querySelectorAll(".canonical-extra-row")].map(el=>({Key:el.querySelector(".canonical-extra-key")?.value.trim()||"",Value:el.querySelector(".canonical-extra-value")?.value.trim()||""})).filter(x=>x.Key||x.Value);return {RecordType:row.ContributionType==="new_manufacturer"?"manufacturer":"model",Fields:fields,AdditionalFields:extras,ResearchNotes:$("canonicalResearchNotes").value.trim()||null,UpdatedAt:new Date().toISOString()}}
function validateCanonicalDraft(row,draft){if(!draft)return;if(row.ContributionType==="new_manufacturer"&&!draft.Fields.CanonicalName)throw new Error("Enter the canonical manufacturer name before promotion.");if(row.ContributionType==="new_model"&&(!draft.Fields.Manufacturer||!draft.Fields.Model))throw new Error("Enter the canonical manufacturer and model name before promotion.")}
function buildAiResearchBrief(row){const state=collectCanonicalDraft(row)||draftState(row),fields=state.Fields||{},empty=Object.entries(fields).filter(([,v])=>!String(v||"").trim()).map(([k])=>k);const submitted=JSON.stringify(row.Payload||{},null,2);return `Research this proposed B-Atlas ${state.RecordType} record using reliable primary or authoritative sources. Preserve uncertainty: do not invent missing values and identify conflicts explicitly.\n\nSubmitted contribution:\n${submitted}\n\nCurrent moderator draft:\n${JSON.stringify(fields,null,2)}\n\nMissing fields to investigate where evidence exists:\n${empty.join(", ")||"None"}\n\nReturn: (1) corrected canonical name/identity, (2) researched field values with source attribution, (3) aliases or lineage notes, (4) unresolved/conflicting information, and (5) a concise recommendation for what B-Atlas should promote. Do not treat marketplace listing claims as authoritative when better sources exist.`}
async function copyAiResearchBrief(){const row=allRows().find(r=>r.ContributionID===selectedId);if(!row||!isCanonicalDraftType(row))return;const text=buildAiResearchBrief(row),msg=$("aiResearchMessage");try{await navigator.clipboard.writeText(text);msg.textContent="AI research brief copied. Paste it into ChatGPT or another research workflow, then enter verified results in the draft canonical record."}catch{msg.textContent="Could not access the clipboard. Select and copy the research brief from your browser console or use a secure context."}msg.hidden=false}

async function loadTaxonomy(){
 try{const r=await fetch("../data/contribution-types.json",{cache:"no-store"});const d=await r.json();taxonomy=(d.groups||[]).flatMap(g=>g.types||[])}catch{taxonomy=[]}
 const sel=$("typeFilter");taxonomy.forEach(t=>{const o=document.createElement("option");o.value=t.id;o.textContent=t.label;sel.appendChild(o)})
}
function counts(){const pending=read(PENDING_KEY),reviewed=read(REVIEWED_KEY),all=[...pending,...reviewed],p=pending.length,r=reviewed.length,k=read(KNOWLEDGE_KEY).length,other=all.filter(x=>x.ContributionType==="other").length;$("pendingCount").textContent=p;$("reviewedCount").textContent=r;$("knowledgeCount").textContent=k;$("otherCount").textContent=other;renderTaxonomyFeedback(pending,reviewed)}
function normalizeSignal(value){return String(value||"").trim().replace(/\s+/g," ").slice(0,80)}
function renderTaxonomyFeedback(pending=read(PENDING_KEY),reviewed=read(REVIEWED_KEY)){
 const all=[...pending,...reviewed];$("otherPendingCount").textContent=pending.filter(r=>r.ContributionType==="other").length;$("clarificationCount").textContent=all.filter(r=>r.ModerationStatus==="needs_clarification").length;
 const groups=new Map();for(const row of all){const raw=normalizeSignal(row.TaxonomySignal);if(!raw)continue;const key=raw.toLowerCase();if(!groups.has(key))groups.set(key,{label:raw,count:0,other:0});const g=groups.get(key);g.count++;if(row.ContributionType==="other")g.other++}
 const ranked=[...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));const target=$("taxonomySignalList");if(!ranked.length){target.innerHTML='<p class="muted">No taxonomy signals recorded yet.</p>';return}target.innerHTML=ranked.slice(0,8).map(g=>`<div class="signal-row"><strong>${esc(g.label)}</strong><span>${g.count} submission${g.count===1?"":"s"}${g.other?` · ${g.other} from Something else`:""}</span></div>`).join("")
}
function summaryText(row){const p=row.Payload||{};return p.Title||p.DocumentTitle||p.ResourceTitle||p.ProposedModel||p.ProposedManufacturer||p.Narrative||p.Advice||p.Explanation||p.NewModelNotes||p.NewManufacturerNotes||"No summary provided"}
function rowTitle(row){if(row.ContributionType==="new_manufacturer")return row.Payload?.ProposedManufacturer||row.ManufacturerName||"New manufacturer";if(row.ContributionType==="new_model")return [row.Payload?.ProposedManufacturer||row.ManufacturerName,row.Payload?.ProposedModel||row.ModelName].filter(Boolean).join(" ")||"New model";return [row.ManufacturerName,row.ModelName,row.Variant].filter(Boolean).join(" ")||"General contribution"}
function filteredRows(){
 const status=$("statusFilter").value,type=$("typeFilter").value,q=$("queueSearch").value.trim().toLowerCase();
 return allRows().filter(r=>(status==="all"||r.ModerationStatus===status)&&(type==="all"||r.ContributionType===type)&&(!q||JSON.stringify(r).toLowerCase().includes(q))).sort((a,b)=>String(b.DateSubmitted||"").localeCompare(String(a.DateSubmitted||"")));
}
function renderQueue(){
 counts();const rows=filteredRows(),target=$("queueList");
 if(!rows.length){target.innerHTML='<div class="empty-list">No contributions match this view.</div>';return}
 target.innerHTML=rows.map(r=>`<button type="button" class="queue-item ${r.ContributionID===selectedId?"selected":""}" data-id="${esc(r.ContributionID)}"><div class="queue-item-top"><strong>${esc(rowTitle(r))}</strong><span class="queue-item-type">${esc(typeLabel(r.ContributionType))}</span></div><small>${esc(summaryText(r)).slice(0,130)}</small><small>${esc(new Date(r.DateSubmitted).toLocaleString())} · ${esc(statusLabel(r.ModerationStatus))}</small></button>`).join("");
}
function field(label,value,wide=false){if(value===null||value===undefined||String(value).trim()==="")return"";return `<div class="field-block ${wide?"wide":""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}
function payloadLabel(key){return key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ").replace(/^./,c=>c.toUpperCase())}
function clearUrls(){objectUrls.forEach(u=>URL.revokeObjectURL(u));objectUrls=[]}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(ATTACHMENT_DB,1);req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(ATTACHMENT_STORE))db.createObjectStore(ATTACHMENT_STORE,{keyPath:"AttachmentID"})}})}
async function getAttachment(id){try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(ATTACHMENT_STORE,"readonly"),req=tx.objectStore(ATTACHMENT_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}catch{return null}}
async function renderAttachments(row){
 clearUrls();const target=$("reviewAttachments"),refs=row.AttachmentRefs||[];
 if(!refs.length){target.hidden=true;target.innerHTML="";return}target.hidden=false;target.innerHTML="<h3>Attachments</h3>";
 for(const id of refs){const a=await getAttachment(id);if(!a){if(sharedConnected&&root.BScoutCommunityAPI){try{const blob=await root.BScoutCommunityAPI.fetchAttachment(id);const url=URL.createObjectURL(blob);objectUrls.push(url);target.insertAdjacentHTML("beforeend",`<div class="attachment-card"><div><strong>${esc(id)}</strong><p>Attachment loaded from the shared moderation service.</p><div class="attachment-actions"><a href="${url}" target="_blank" rel="noopener">Open shared attachment</a></div></div></div>`);continue}catch{}}target.insertAdjacentHTML("beforeend",`<div class="attachment-card"><div><strong>${esc(id)}</strong><p>Attachment is not available in this browser or the shared service.</p></div></div>`);continue}
  const blob=a.Blob||a.blob||a.File||a.file;const name=a.FileName||a.fileName||a.Name||"Attachment";const mime=a.MimeType||a.mimeType||blob?.type||"";let url="";if(blob instanceof Blob){url=URL.createObjectURL(blob);objectUrls.push(url)}
  target.insertAdjacentHTML("beforeend",`<div class="attachment-card">${mime.startsWith("image/")&&url?`<img src="${url}" alt="Submitted attachment">`:""}<div><strong>${esc(name)}</strong><p>${esc(mime||"Unknown file type")}</p><div class="attachment-actions">${url?`<a href="${url}" target="_blank" rel="noopener">Open attachment</a><a href="${url}" download="${esc(name)}">Download</a>`:""}</div></div></div>`)
 }
}
function evidenceSummary(itemId){
 const links=read(KNOWLEDGE_EVIDENCE_KEY).filter(e=>e.KnowledgeItemID===itemId);
 const ownerTypes=new Set(["direct_owner_observation","multiple_boats"]),docTypes=new Set(["professional_inspection","manufacturer_documentation","manual_brochure","survey"]);
 const supports=links.filter(e=>(e.Relationship||"supports")==="supports").length,conflicts=links.filter(e=>e.Relationship==="contradicts").length,qualifies=links.filter(e=>e.Relationship==="qualifies").length;
 const owner=links.filter(e=>ownerTypes.has(e.EvidenceType)).length,docs=links.filter(e=>docTypes.has(e.EvidenceType)).length,total=links.length;
 let label="No community evidence",band="None";
 if(conflicts>0){label="Conflicting community reports";band=total>=3?"Moderate":"Limited"}
 else if(docs>=1&&total>=2){label="Well documented";band="Strong"}
 else if(owner>=5){label="Commonly reported by owners";band="Strong"}
 else if(owner>=2){label="Reported by several owners";band="Moderate"}
 else if(owner===1){label="Reported by an owner";band="Limited"}
 else if(total>=3){label="Several community reports";band="Moderate"}
 else if(total>=1){label="Community evidence available";band="Limited"}
 if(total>=2&&band==="Limited"&&conflicts===0)band="Emerging";
 return {ReportCount:total,OwnerReportCount:owner,DocumentedEvidenceCount:docs,SupportingReportCount:supports,ConflictingReportCount:conflicts,QualifyingReportCount:qualifies,ConfidenceBand:band,PublicLabel:label};
}
function refreshKnowledgeSummaries(){
 let items=read(KNOWLEDGE_KEY),changed=false;items=items.map(i=>{const s=evidenceSummary(i.KnowledgeItemID);if(JSON.stringify(s)!==JSON.stringify(i.EvidenceSummary)){changed=true;return {...i,EvidenceSummary:s,KnowledgeState:s.ConflictingReportCount>0?"conflicting_information":(i.KnowledgeState||"limited_evidence"),UpdatedAt:new Date().toISOString()}}return i});if(changed)write(KNOWLEDGE_KEY,items);return items;
}
function modelKnowledge(row){return refreshKnowledgeSummaries().filter(i=>row.ModelID&&i.BoatModelID===row.ModelID&&i.Status!=="archived")}
function stateLabel(v){return String(v||"limited_evidence").replaceAll("_"," ")}
function renderModelKnowledge(row){
 const box=$("modelKnowledge"),list=$("modelKnowledgeList"),items=modelKnowledge(row);if(!row.ModelID){box.hidden=true;return}box.hidden=false;$("modelKnowledgeCount").textContent=`${items.length} item${items.length===1?"":"s"}`;
 list.innerHTML=items.length?items.map(i=>`<div class="knowledge-item"><div class="knowledge-item-top"><strong>${esc(i.Title)}</strong><span class="evidence-label">${esc(i.EvidenceSummary?.PublicLabel||"No evidence")}</span></div><div style="margin-top:6px"><span class="knowledge-state">${esc(stateLabel(i.KnowledgeState))}</span></div>${i.Summary?`<small>${esc(i.Summary)}</small>`:""}${i.ConflictSummary?`<div class="conflict-note">${esc(i.ConflictSummary)}</div>`:""}<div class="evidence-detail">${i.EvidenceSummary?.ReportCount||0} report${i.EvidenceSummary?.ReportCount===1?"":"s"} · ${i.EvidenceSummary?.OwnerReportCount||0} owner report${i.EvidenceSummary?.OwnerReportCount===1?"":"s"} · ${i.EvidenceSummary?.DocumentedEvidenceCount||0} documented source${i.EvidenceSummary?.DocumentedEvidenceCount===1?"":"s"}</div><div class="evidence-split">${i.EvidenceSummary?.SupportingReportCount||0} supporting · ${i.EvidenceSummary?.ConflictingReportCount||0} contradicting · ${i.EvidenceSummary?.QualifyingReportCount||0} qualifying</div><div class="knowledge-id">${esc(i.KnowledgeItemID)}</div></div>`).join(""):'<div class="empty-list">No normalized community knowledge items for this model yet.</div>';
 const sel=$("mergeTarget");sel.innerHTML='<option value="">Choose a knowledge item</option>'+items.map(i=>`<option value="${esc(i.KnowledgeItemID)}">${esc(i.Title)} — ${esc(i.EvidenceSummary?.PublicLabel||"No evidence")}</option>`).join("");
}
function defaultKnowledgeTitle(row){const p=row.Payload||{};return p.Title||p.Area||p.Advice?.slice(0,90)||summaryText(row).slice(0,120)}
async function openRecord(id){
 selectedId=id;renderQueue();const row=allRows().find(r=>r.ContributionID===id);if(!row)return;
 $("emptyReview").hidden=true;$("reviewCard").hidden=false;$("reviewType").textContent=typeLabel(row.ContributionType);$("reviewTitle").textContent=rowTitle(row);$("reviewMeta").textContent=`${row.ContributionID} · Submitted ${new Date(row.DateSubmitted).toLocaleString()}`;$("reviewStatus").textContent=statusLabel(row.ModerationStatus);
 $("reviewContext").innerHTML=`<h3>Context</h3><div class="context-grid">${field("Manufacturer",row.ManufacturerName)}${field("Model",row.ModelName)}${field("Model year",row.ModelYear)}${field("Variant / layout",row.Variant)}${field("Evidence",statusLabel(row.EvidenceType))}${field("Rights",statusLabel(row.RightsStatus))}${field("Display name",row.DisplayName)}${field("Private contact email",row.ContactEmail)}</div>`;
 const entries=Object.entries(row.Payload||{});$("reviewPayload").innerHTML=`<h3>Submitted information</h3><div class="payload-grid">${entries.map(([k,v])=>field(payloadLabel(k),v,["Narrative","Advice","Why","Explanation","Repair","DocumentNotes","ResourceNotes","NewModelNotes","NewManufacturerNotes"].includes(k))).join("")||'<p>No structured payload.</p>'}</div>`;
 const source=$("reviewSource");if(row.SourceURL){source.hidden=false;source.innerHTML=`<h3>Source</h3><a href="${esc(row.SourceURL)}" target="_blank" rel="noopener">${esc(row.SourceURL)}</a>`}else{source.hidden=true;source.innerHTML=""}
 $("moderatorNotes").value=row.ModeratorNotes||"";$("taxonomySignal").value=row.TaxonomySignal||"";
 const defaultAction=row.ReviewAction||(["approved","merged","knowledge_created","needs_clarification","rejected"].includes(row.ModerationStatus)?row.ModerationStatus:(["new_model","new_manufacturer"].includes(row.ContributionType)?"created":(row.ContributionType==="correction"?"corrected":"")));
 $("moderationAction").value=defaultAction;$("canonicalActionRef").value=row.CanonicalActionRef||"";$("knowledgeTitle").value=row.CreatedKnowledgeTitle||defaultKnowledgeTitle(row)||"";$("knowledgeCategory").value=KNOWLEDGE_TYPES.has(row.ContributionType)?row.ContributionType:"other";$("knowledgeSummary").value=row.CreatedKnowledgeSummary||"";$("evidenceRelationship").value=row.EvidenceRelationship||"supports";$("knowledgeState").value=row.KnowledgeState||"limited_evidence";$("applicabilityConfidence").value=row.ApplicabilityConfidence||"uncertain";$("knowledgeYearFrom").value=row.KnowledgeYearFrom||row.ModelYear||"";$("knowledgeYearTo").value=row.KnowledgeYearTo||row.ModelYear||"";$("knowledgeVariants").value=row.KnowledgeVariants||row.Variant||"";$("conflictSummary").value=row.ConflictSummary||"";renderCanonicalDraft(row);renderModelKnowledge(row);$("mergeTarget").value=row.MergedKnowledgeItemID||"";toggleDecisionFields(row);await renderAttachments(row);
}
function toggleDecisionFields(row=allRows().find(r=>r.ContributionID===selectedId)){const a=$("moderationAction").value,isK=KNOWLEDGE_TYPES.has(row?.ContributionType),knowledgeAction=a==="merged"||a==="knowledge_created";$("mergeTargetField").hidden=a!=="merged";$("evidenceRelationshipField").hidden=!knowledgeAction;$("knowledgeTitleField").hidden=a!=="knowledge_created";$("knowledgeCategoryField").hidden=a!=="knowledge_created";$("knowledgeSummaryField").hidden=a!=="knowledge_created";$("knowledgeStateField").hidden=!knowledgeAction;$("applicabilityConfidenceField").hidden=!knowledgeAction;$("yearFromField").hidden=!knowledgeAction;$("yearToField").hidden=!knowledgeAction;$("variantsField").hidden=!knowledgeAction;$("conflictSummaryField").hidden=!knowledgeAction;$("canonicalActionField").hidden=a!=="corrected"&&a!=="created";
 [...$("moderationAction").options].forEach(o=>{if(o.value==="knowledge_created")o.disabled=!isK||!row?.ModelID;if(o.value==="merged")o.disabled=!isK||!row?.ModelID;if(o.value==="corrected")o.disabled=row?.ContributionType!=="correction";if(o.value==="created")o.disabled=!(["new_model","new_manufacturer"].includes(row?.ContributionType))});}
function removeEvidenceForContribution(contributionId){let links=read(KNOWLEDGE_EVIDENCE_KEY);const removed=links.filter(e=>e.ContributionID===contributionId);links=links.filter(e=>e.ContributionID!==contributionId);write(KNOWLEDGE_EVIDENCE_KEY,links);return removed}
function pruneEmptyCreatedKnowledge(removedLinks){if(!removedLinks.length)return;let items=read(KNOWLEDGE_KEY),links=read(KNOWLEDGE_EVIDENCE_KEY);const candidateIds=new Set(removedLinks.map(e=>e.KnowledgeItemID));items=items.filter(i=>!(candidateIds.has(i.KnowledgeItemID)&&i.Status==="candidate"&&!links.some(e=>e.KnowledgeItemID===i.KnowledgeItemID)));write(KNOWLEDGE_KEY,items)}
function addEvidence(row,itemId){let links=read(KNOWLEDGE_EVIDENCE_KEY);if(links.some(e=>e.ContributionID===row.ContributionID&&e.KnowledgeItemID===itemId))return;links.push({KnowledgeEvidenceID:makeId("KEV"),KnowledgeItemID:itemId,ContributionID:row.ContributionID,BoatModelID:row.ModelID,EvidenceType:row.EvidenceType||null,ModelYear:row.ModelYear||null,Variant:row.Variant||null,SourceURL:row.SourceURL||null,AddedAt:new Date().toISOString(),Relationship:$("evidenceRelationship")?.value||"supports",ModeratorNotes:$("moderatorNotes").value.trim()||null});write(KNOWLEDGE_EVIDENCE_KEY,links)}
function currentApplicability(){const yf=parseInt($("knowledgeYearFrom").value,10),yt=parseInt($("knowledgeYearTo").value,10);return {YearFrom:Number.isFinite(yf)?yf:null,YearTo:Number.isFinite(yt)?yt:null,Variants:$("knowledgeVariants").value.split(",").map(v=>v.trim()).filter(Boolean),Confidence:$("applicabilityConfidence").value||"uncertain"}}
function updateKnowledgeMetadata(itemId){let items=read(KNOWLEDGE_KEY);items=items.map(i=>i.KnowledgeItemID===itemId?{...i,KnowledgeState:$("knowledgeState").value||i.KnowledgeState||"limited_evidence",ConflictSummary:$("conflictSummary").value.trim()||null,Applicability:currentApplicability(),UpdatedAt:new Date().toISOString()}:i);write(KNOWLEDGE_KEY,items)}
function createKnowledge(row){const title=$("knowledgeTitle").value.trim();if(!title)throw new Error("Enter a knowledge item title.");if(!row.ModelID)throw new Error("A knowledge item must attach to an existing model.");const id=`KN-${slug(row.ModelID)}-${slug(title).slice(0,28)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`,now=new Date().toISOString();let items=read(KNOWLEDGE_KEY);items.push({KnowledgeItemID:id,BoatModelID:row.ModelID,ManufacturerName:row.ManufacturerName||null,ModelName:row.ModelName||null,Title:title,Category:$("knowledgeCategory").value,Summary:$("knowledgeSummary").value.trim()||null,KnowledgeState:$("knowledgeState").value||"limited_evidence",ConflictSummary:$("conflictSummary").value.trim()||null,Applicability:currentApplicability(),Status:"candidate",EvidenceSummary:{ReportCount:0,OwnerReportCount:0,DocumentedEvidenceCount:0,SupportingReportCount:0,ConflictingReportCount:0,QualifyingReportCount:0,ConfidenceBand:"None",PublicLabel:"No community evidence"},CreatedAt:now,UpdatedAt:now,ModeratorNotes:$("moderatorNotes").value.trim()||null});write(KNOWLEDGE_KEY,items);addEvidence(row,id);refreshKnowledgeSummaries();return id}
async function saveDecision(){
 if(!selectedId)return;const action=$("moderationAction").value;if(!action){alert("Choose a moderation action.");return}
 let pending=read(PENDING_KEY),reviewed=read(REVIEWED_KEY);let row=pending.find(r=>r.ContributionID===selectedId)||reviewed.find(r=>r.ContributionID===selectedId);if(!row)return;
 if(action==="merged"&&!$("mergeTarget").value){alert("Choose the existing knowledge item this report supports.");return}
 if(action==="created"&&!sharedConnected){alert("Canonical manufacturer/model promotion requires the shared backend. Start B-Atlas with npm start, connect as moderator, then promote the edited record.");return}
 let canonicalDraft=null;try{canonicalDraft=collectCanonicalDraft(row);if(action==="created")validateCanonicalDraft(row,canonicalDraft)}catch(e){alert(e.message||String(e));return}
 let promoted=null;
 if(action==="created"&&root.BScoutCommunityAPI){try{promoted=await root.BScoutCommunityAPI.promote({...row,CanonicalDraft:canonicalDraft})}catch(e){alert(`Canonical promotion failed: ${e.message}`);return}}
 try{
  const removed=removeEvidenceForContribution(row.ContributionID);pruneEmptyCreatedKnowledge(removed);
  let knowledgeId=null;if(action==="merged"){knowledgeId=$("mergeTarget").value;addEvidence(row,knowledgeId);updateKnowledgeMetadata(knowledgeId)}else if(action==="knowledge_created"){knowledgeId=createKnowledge(row)}
  const status=(action==="corrected"||action==="created"||action==="knowledge_created")?"approved":action;
  row={...row,CanonicalDraft:canonicalDraft||row.CanonicalDraft||null,ModerationStatus:status,ReviewAction:action,ModeratorNotes:$("moderatorNotes").value.trim()||null,TaxonomySignal:normalizeSignal($("taxonomySignal").value)||null,MergedKnowledgeItemID:knowledgeId,CanonicalActionRef:["corrected","created"].includes(action)?($("canonicalActionRef").value.trim()||(promoted?.id?`${promoted.type}:${promoted.id}`:(action==="created"?"Promote moderator-enriched canonical draft":null))):null,CreatedKnowledgeTitle:action==="knowledge_created"?$("knowledgeTitle").value.trim():null,CreatedKnowledgeSummary:action==="knowledge_created"?($("knowledgeSummary").value.trim()||null):null,EvidenceRelationship:knowledgeId?$("evidenceRelationship").value:null,KnowledgeState:knowledgeId?$("knowledgeState").value:null,ApplicabilityConfidence:knowledgeId?$("applicabilityConfidence").value:null,KnowledgeYearFrom:knowledgeId?($("knowledgeYearFrom").value||null):null,KnowledgeYearTo:knowledgeId?($("knowledgeYearTo").value||null):null,KnowledgeVariants:knowledgeId?($("knowledgeVariants").value.trim()||null):null,ConflictSummary:knowledgeId?($("conflictSummary").value.trim()||null):null,ReviewedAt:new Date().toISOString()};
  pending=pending.filter(r=>r.ContributionID!==selectedId);reviewed=reviewed.filter(r=>r.ContributionID!==selectedId);reviewed.push(row);write(PENDING_KEY,pending);write(REVIEWED_KEY,reviewed);refreshKnowledgeSummaries();
  if(sharedConnected&&root.BScoutCommunityAPI) {
    await root.BScoutCommunityAPI.saveAdminSnapshot(localSnapshot());
    const published = await root.BScoutCommunityAPI.publish();
    if(action==="created"&&promoted) sharedMessage(`Promoted ${promoted.type} ${promoted.id}. The moderation decision is saved and public data has been refreshed.`);
    else sharedMessage(`Moderation decision saved and published. ${published?.canonicalCorrections || 0} canonical correction${published?.canonicalCorrections===1?"":"s"} applied in this publish.`);
  } else sharedMessage("Moderation decision saved in this browser-local test queue.");
  renderQueue();await openRecord(selectedId)
 }catch(e){alert(e.message||String(e))}
}

function restorePending(){
 if(!selectedId)return;let pending=read(PENDING_KEY),reviewed=read(REVIEWED_KEY);let row=reviewed.find(r=>r.ContributionID===selectedId)||pending.find(r=>r.ContributionID===selectedId);if(!row)return;const removed=removeEvidenceForContribution(row.ContributionID);pruneEmptyCreatedKnowledge(removed);row={...row,ModerationStatus:"pending",ReviewAction:null,ModeratorNotes:$("moderatorNotes").value.trim()||null,TaxonomySignal:normalizeSignal($("taxonomySignal").value)||row.TaxonomySignal||null,MergedKnowledgeItemID:null,CanonicalActionRef:null,CreatedKnowledgeTitle:null,CreatedKnowledgeSummary:null,ReviewedAt:null};reviewed=reviewed.filter(r=>r.ContributionID!==selectedId);pending=pending.filter(r=>r.ContributionID!==selectedId);pending.push(row);write(PENDING_KEY,pending);write(REVIEWED_KEY,reviewed);refreshKnowledgeSummaries();renderQueue();openRecord(selectedId)
}
function exportQueue(){const data={schema:"batlas-contribution-review-export-v5",exportedAt:new Date().toISOString(),pending:read(PENDING_KEY),reviewed:read(REVIEWED_KEY),knowledgeItems:refreshKnowledgeSummaries(),knowledgeEvidence:read(KNOWLEDGE_EVIDENCE_KEY)};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`batlas-contributions-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)}
async function importQueue(file){
 const msg=$("utilityMessage");try{const parsed=JSON.parse(await file.text());let incoming=[];if(Array.isArray(parsed))incoming=parsed;else incoming=[...(parsed.pending||[]),...(parsed.reviewed||[])];if(!incoming.length&&!parsed.knowledgeItems?.length)throw new Error("No contribution or knowledge records found.");let pending=read(PENDING_KEY),reviewed=read(REVIEWED_KEY),known=new Set([...pending,...reviewed].map(r=>r.ContributionID));let added=0;for(const r of incoming){if(!r?.ContributionID||known.has(r.ContributionID))continue;known.add(r.ContributionID);(r.ModerationStatus&&r.ModerationStatus!=="pending"?reviewed:pending).push(r);added++}write(PENDING_KEY,pending);write(REVIEWED_KEY,reviewed);
  if(Array.isArray(parsed.knowledgeItems)){let items=read(KNOWLEDGE_KEY),ids=new Set(items.map(i=>i.KnowledgeItemID));for(const i of parsed.knowledgeItems)if(i?.KnowledgeItemID&&!ids.has(i.KnowledgeItemID)){items.push(i);ids.add(i.KnowledgeItemID)}write(KNOWLEDGE_KEY,items)}
  if(Array.isArray(parsed.knowledgeEvidence)){let links=read(KNOWLEDGE_EVIDENCE_KEY),ids=new Set(links.map(e=>e.KnowledgeEvidenceID));for(const e of parsed.knowledgeEvidence)if(e?.KnowledgeEvidenceID&&!ids.has(e.KnowledgeEvidenceID)){links.push(e);ids.add(e.KnowledgeEvidenceID)}write(KNOWLEDGE_EVIDENCE_KEY,links)}
  refreshKnowledgeSummaries();msg.hidden=false;msg.textContent=`Imported ${added} new contribution record${added===1?"":"s"}. Knowledge items/evidence were merged when present. Attachment files are not included in JSON imports.`;renderQueue();if(selectedId)openRecord(selectedId)
 }catch(e){msg.hidden=false;msg.textContent=`Import failed: ${e.message}`}}

document.addEventListener("click",e=>{const item=e.target.closest(".queue-item");if(item)openRecord(item.dataset.id)});["statusFilter","typeFilter"].forEach(id=>$(id).addEventListener("change",renderQueue));$("queueSearch").addEventListener("input",renderQueue);$("moderationAction").addEventListener("change",()=>toggleDecisionFields());$("saveDecisionBtn").addEventListener("click",saveDecision);$("restorePendingBtn").addEventListener("click",restorePending);$("exportQueueBtn").addEventListener("click",exportQueue);$("importQueueInput").addEventListener("change",e=>{const f=e.target.files?.[0];if(f)importQueue(f);e.target.value=""});$("addCanonicalFieldBtn").addEventListener("click",addCanonicalField);$("copyAiResearchBriefBtn").addEventListener("click",copyAiResearchBrief);$("connectSharedBtn")?.addEventListener("click",connectShared);$("refreshSharedBtn")?.addEventListener("click",refreshShared);$("publishSharedBtn")?.addEventListener("click",publishShared);$("backupSharedBtn")?.addEventListener("click",backupShared);$("reconciliationSharedBtn")?.addEventListener("click",reconciliationShared);$("canonicalAdditionalFields").addEventListener("click",e=>{if(e.target.closest(".remove-canonical-field"))e.target.closest(".canonical-extra-row")?.remove()});
(async()=>{await loadTaxonomy();await initShared();refreshKnowledgeSummaries();renderQueue();try{const id=new URLSearchParams(location.search).get("contribution");if(id&&allRows().some(r=>r.ContributionID===id))openRecord(id)}catch{}})();
})(window);
