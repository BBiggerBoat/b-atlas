(function(root){
  "use strict";
  const STORAGE_KEY = "bscout.ownedBoats.v1";
  let activeOwnedBoatId = null;

  const $ = id => document.getElementById(id);
  const text = value => value == null ? "" : String(value);
  const nowIso = () => new Date().toISOString();
  const boatModelName = boat => [boat?.Manufacturer, boat?.Model, boat?.Variant].filter(Boolean).join(" ") || "Unknown model";
  const uid = () => `OWN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  function read(){ try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); return Array.isArray(value)?value:[]; } catch { return []; } }
  function write(records){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
  function findModel(id){ return (root.allBoats||[]).find(b=>String(b.BoatModelID)===String(id))||null; }
  function findListing(id){ return typeof root.getListingById === "function" ? root.getListingById(id) : null; }
  function relationFor(id){ return typeof root.getBoatRelationship === "function" ? root.getBoatRelationship(id) : null; }
  function researchSnapshot(modelId){
    const rel=relationFor(modelId);
    return rel ? JSON.parse(JSON.stringify({Status:rel.Status||"", Research:rel.Research||{}, History:rel.History||[], Captured:nowIso()})) : null;
  }
  function listingSnapshot(listing){ return listing ? JSON.parse(JSON.stringify(listing)) : null; }
  function baseRecord(model, listing){
    const year=listing?.Year || model?.FirstYear || "";
    return {
      OwnedBoatID:uid(), BoatModelID:model?.BoatModelID||listing?.BoatModelID||"", ModelIdentity:{Manufacturer:model?.Manufacturer||"",Model:model?.Model||"",Variant:model?.Variant||""},
      BoatName:"", Year:year, HIN:"", Registration:"", HomePort:"",
      Purchase:{Date:"",Price:listing?.Price||"",Currency:listing?.Currency||"CAD",Source:listing?.Broker||listing?.Source||"",URL:listing?.URL||"",Notes:listing?.Notes||""},
      Engine:{Make:"",Model:"",Year:"",Horsepower:"",Fuel:model?.Fuel||"",Propulsion:model?.Propulsion||"",Hours:"",Serial:"",Notes:""},
      Documents:"", MaintenanceNotes:"", Upgrades:"",
      Contributions:{Problem:"",Maintenance:"",BuyerAdvice:"",ReadyForReview:false},
      SaleReadiness:{Identity:false,Engine:false,Maintenance:false,Documents:false,Upgrades:false,Concerns:false,Notes:""},
      SourceListing:listingSnapshot(listing), ResearchHistory:researchSnapshot(model?.BoatModelID||listing?.BoatModelID),
      Created:nowIso(), LastUpdated:nowIso()
    };
  }
  function createFromModel(modelId, listingId){
    const listing=listingId?findListing(listingId):null;
    const model=findModel(modelId||listing?.BoatModelID);
    if(!model) return null;
    const records=read();
    const record=baseRecord(model, listing);
    records.push(record); write(records);
    const rel=relationFor(model.BoatModelID);
    if(rel){ rel.OwnedBoatID=record.OwnedBoatID; rel.LastUpdated=nowIso(); if(Array.isArray(rel.History)) rel.History.push({Type:"ownership",Label:"Purchased boat",Timestamp:nowIso(),Details:listing?.Title||boatModelName(model)}); if(typeof root.persistCurrentSearchProfile==="function") root.persistCurrentSearchProfile(); }
    openMyBoats(record.OwnedBoatID);
    return record;
  }
  function esc(v){ return text(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function displayName(record){ return record.BoatName || [record.Year, record.ModelIdentity?.Manufacturer,record.ModelIdentity?.Model,record.ModelIdentity?.Variant].filter(Boolean).join(" ") || "My Boat"; }
  function renderList(){
    const list=$("ownedBoatsList"); if(!list) return;
    const records=read();
    $("ownedBoatRecord")?.setAttribute("hidden",""); list.hidden=false;
    if(!records.length){ list.innerHTML='<section class="owned-boats-empty"><span class="owned-boats-empty-icon" aria-hidden="true">⚓</span><h2>No owned boats yet</h2><p>Open a saved model or candidate listing and choose <strong>I bought this boat</strong>. B-Atlas will preserve the model, listing and research history.</p><button type="button" class="workspace-primary-btn" data-app-action="saved-models">Open Saved Models</button></section>'; return; }
    list.innerHTML=`<div class="owned-boats-card-grid">${records.map(r=>`<button type="button" class="owned-boat-card" data-owned-id="${esc(r.OwnedBoatID)}"><span class="workspace-eyebrow">Individual Boat</span><strong>${esc(displayName(r))}</strong><span>${esc(boatModelName(r.ModelIdentity))}</span><small>${r.Purchase?.Date?`Purchased ${esc(r.Purchase.Date)}`:"Purchase date unknown"}</small></button>`).join("")}</div>`;
    list.querySelectorAll("[data-owned-id]").forEach(btn=>btn.addEventListener("click",()=>{openRecord(btn.dataset.ownedId);focusSaleReadiness();}));
  }
  const fields={
    ownedBoatName:"BoatName",ownedBoatYear:"Year",ownedBoatHin:"HIN",ownedBoatRegistration:"Registration",ownedBoatHomePort:"HomePort",
    ownedBoatPurchaseDate:"Purchase.Date",ownedBoatPurchasePrice:"Purchase.Price",ownedBoatCurrency:"Purchase.Currency",ownedBoatPurchaseSource:"Purchase.Source",ownedBoatListingUrl:"Purchase.URL",ownedBoatPurchaseNotes:"Purchase.Notes",
    ownedEngineMake:"Engine.Make",ownedEngineModel:"Engine.Model",ownedEngineYear:"Engine.Year",ownedEngineHp:"Engine.Horsepower",ownedEngineFuel:"Engine.Fuel",ownedEnginePropulsion:"Engine.Propulsion",ownedEngineHours:"Engine.Hours",ownedEngineSerial:"Engine.Serial",ownedEngineNotes:"Engine.Notes",
    ownedBoatDocuments:"Documents",ownedBoatMaintenance:"MaintenanceNotes",ownedBoatUpgrades:"Upgrades",ownedContributionProblem:"Contributions.Problem",ownedContributionMaintenance:"Contributions.Maintenance",ownedContributionBuyerAdvice:"Contributions.BuyerAdvice",ownedContributionShare:"Contributions.ReadyForReview",
    saleIdentityComplete:"SaleReadiness.Identity",saleEngineComplete:"SaleReadiness.Engine",saleMaintenanceComplete:"SaleReadiness.Maintenance",saleDocumentsComplete:"SaleReadiness.Documents",saleUpgradesComplete:"SaleReadiness.Upgrades",saleConcernsComplete:"SaleReadiness.Concerns",ownedSaleNotes:"SaleReadiness.Notes"
  };
  function getPath(obj,path){ return path.split(".").reduce((a,k)=>a?.[k],obj); }
  function setPath(obj,path,value){ const parts=path.split("."); let cur=obj; parts.slice(0,-1).forEach(k=>cur=cur[k]||(cur[k]={})); cur[parts.at(-1)]=value; }
  function openRecord(id){
    const record=read().find(r=>r.OwnedBoatID===id); if(!record) return;
    activeOwnedBoatId=id; $("ownedBoatsList").hidden=true; $("ownedBoatRecord").hidden=false;
    $("ownedBoatTitle").textContent=displayName(record); $("ownedBoatModelLink").textContent=`${boatModelName(record.ModelIdentity)} · Purchased research and listing details preserved`;
    $("ownedBoatModel").value=boatModelName(record.ModelIdentity);
    Object.entries(fields).forEach(([id,path])=>{ const el=$(id); if(!el)return; const value=getPath(record,path); if(el.type==="checkbox") el.checked=Boolean(value); else el.value=value??""; });
    $("ownedBoatRecord").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function saveActive(){
    if(!activeOwnedBoatId) return;
    const records=read(); const record=records.find(r=>r.OwnedBoatID===activeOwnedBoatId); if(!record) return;
    Object.entries(fields).forEach(([id,path])=>{ const el=$(id); if(!el)return; let value=el.type==="checkbox"?el.checked:el.value; if(["ownedBoatYear","ownedBoatPurchasePrice","ownedEngineYear","ownedEngineHp","ownedEngineHours"].includes(id) && value!=="") value=Number(value); setPath(record,path,value); });
    record.LastUpdated=nowIso(); write(records); $("ownedBoatTitle").textContent=displayName(record); const status=$("ownedBoatSaveStatus"); if(status){status.textContent="Boat record saved.";setTimeout(()=>status.textContent="",2200);} renderList(); openRecord(activeOwnedBoatId);
  }
  function showOwnedView(){
    ["lifecycleHome","discoverView","guidedMatchView","boatGuideView","decisionWorkspaceModal","informationModal"].forEach(id=>$(id)?.setAttribute("hidden",""));
    const view=$("ownedBoatsView"); if(view){view.hidden=false;view.scrollIntoView({behavior:"smooth",block:"start"});}
  }
  function applyLifecycleMode(mode){
        activeLifecycleMode = "own";
        const eyebrow=$("ownedBoatsEyebrow"), title=$("ownedBoatsPageTitle"), desc=$("ownedBoatsPageDescription");
        if(eyebrow) eyebrow.textContent="My Boats";
        if(title) title.textContent="My Boats";
        if(desc) desc.textContent="Permanent records for individual boats you own.";
    }
    function focusSaleReadiness(){ return; }
    function openMyBoats(recordId,mode="own"){ applyLifecycleMode(mode); showOwnedView(); renderList(); if(recordId){ openRecord(recordId); focusSaleReadiness(); } }
  function hideOwnedView(){ $("ownedBoatsView")?.setAttribute("hidden",""); }
  function currentRecord(){ return read().find(r=>r.OwnedBoatID===activeOwnedBoatId)||null; }

  document.addEventListener("click",event=>{
    const ownedTarget=event.target.closest("[data-owned-target]"); if(ownedTarget){ const target=$(ownedTarget.dataset.ownedTarget); if(target){target.open=true;target.scrollIntoView({behavior:"smooth",block:"start"});} }
  });
  $("backToOwnedBoats")?.addEventListener("click",()=>{activeOwnedBoatId=null;renderList();});
  $("saveOwnedBoat")?.addEventListener("click",saveActive);
  $("openOwnedBoatGuide")?.addEventListener("click",()=>{const record=currentRecord();const model=record&&findModel(record.BoatModelID);if(model&&root.BScoutBoatWorkspace)root.BScoutBoatWorkspace.open(model,"owning");});
  $("buyListingBoat")?.addEventListener("click",()=>{ if(root.activeListingBoatId || root.activeListingId){ if(typeof root.saveListingWorkspaceRecord==="function") root.saveListingWorkspaceRecord(); createFromModel(root.activeListingBoatId,root.activeListingId); $("listingWorkspaceModal").style.display="none"; } });

  root.BScoutOwnership={openMyBoats,hideOwnedView,createFromModel,renderList,openRecord,read};
})(window);
