(function(global){
"use strict";
const FACTORS={m:1,cm:.01,ft:.3048,in:.0254,kg:1,lb:.45359237,L:1,us_gal:3.785411784,imp_gal:4.54609,kW:1,hp:.745699872,kn:1,nm:1,L_h:1,us_gal_h:3.785411784,imp_gal_h:4.54609};
const CANON={length:"m",mass:"kg",volume:"L",power:"kW",speed:"kn",distance:"nm",fuel_flow:"L_h"};
const UNIT_PROFILE_KEY="batlas.unitProfile";
const VALID_PROFILES=new Set(["imperial","metric","both"]);
function n(v){if(v===undefined||v===null||v==="")return null;const x=Number(v);return Number.isFinite(x)?x:null;}
function toCanonical(value,unit){const x=n(value),f=FACTORS[unit];return x===null||!f?null:x*f;}
function fromCanonical(value,unit){const x=n(value),f=FACTORS[unit];return x===null||!f?null:x/f;}
function first(row,keys){for(const k of keys||[]){if(row&&row[k]!==undefined&&row[k]!==null&&row[k]!=="")return row[k];}return null;}
function canonicalMeasurement(row,key,legacy){const hasCanonical=!!row&&Object.prototype.hasOwnProperty.call(row,key);const direct=n(row?.[key]);if(direct!==null)return direct;if(hasCanonical)return null;for(const item of legacy||[]){const raw=n(row?.[item.key]);if(raw===null||item.unit==="gal_unknown")continue;const cv=toCanonical(raw,item.unit);if(cv!==null)return cv;}return null;}
function feet(row,key,legacy){const m=canonicalMeasurement(row,key,legacy);return m===null?null:fromCanonical(m,"ft");}
function inches(row,key,legacy){const m=canonicalMeasurement(row,key,legacy);return m===null?null:fromCanonical(m,"in");}
function enumCode(row,key,legacyKeys){const direct=first(row,[key]);if(direct!==null)return String(direct);return first(row,legacyKeys||[]);}
function formatFeetInches(m){const total=fromCanonical(m,"in");if(total===null)return null;let rounded=Math.round(total);let ft=Math.floor(rounded/12),inch=rounded-ft*12;if(inch===12){ft++;inch=0;}return `${ft}′ ${inch}″`;}
function getUnitProfile(){ return "both"; }
function setUnitProfile(profile){
 const next="both";
 try{global.localStorage?.removeItem(UNIT_PROFILE_KEY);}catch{}
 if(global.document){global.document.documentElement.dataset.unitProfile=next;global.document.dispatchEvent(new CustomEvent("batlas:unitprofilechange",{detail:{profile:next}}));}
 return next;
}
function formatSingle(value,dimension,profile){
 const x=n(value); if(x===null)return null;
 if(dimension==="speed")return `${x.toFixed(1).replace(/\.0$/,'')} kn`;
 if(dimension==="distance")return `${x.toFixed(0)} nm`;
 if(dimension==="fuel_flow"){ if(profile==="metric")return `${x.toFixed(1).replace(/\.0$/,'')} L/h`; return `${fromCanonical(x,"us_gal_h").toFixed(2).replace(/0+$/,'').replace(/\.$/,'')} US gal/h`; }
 if(profile==="metric"){
  if(dimension==="length")return `${x.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')} m`;
  if(dimension==="mass")return `${Math.round(x).toLocaleString()} kg`;
  if(dimension==="volume")return `${Math.round(x).toLocaleString()} L`;
  if(dimension==="power")return `${x.toFixed(1).replace(/\.0$/,'')} kW`;
 }
 if(dimension==="length")return formatFeetInches(x);
 if(dimension==="mass")return `${Math.round(fromCanonical(x,"lb")).toLocaleString()} lb`;
 if(dimension==="volume")return `${Math.round(fromCanonical(x,"us_gal")).toLocaleString()} US gal`;
 if(dimension==="power")return `${Math.round(fromCanonical(x,"hp"))} hp`;
 return String(x);
}
function formatMeasurement(value,dimension,profile=getUnitProfile()){
 const x=n(value); if(x===null)return null;
 if(dimension==="fuel_flow" && profile==="both"){const i=formatSingle(x,dimension,"imperial"),m=formatSingle(x,dimension,"metric");return `${i} / ${m}`;}
 if(profile==="both" && !["speed","distance"].includes(dimension)){
  const imperial=formatSingle(x,dimension,"imperial"), metric=formatSingle(x,dimension,"metric");
  return imperial&&metric?`${imperial} / ${metric}`:(imperial||metric);
 }
 return formatSingle(x,dimension,profile);
}
function safeCanonicalMeasurement(row,key,dimension,legacy=[]){
 const direct=n(row?.[key]);
 if(direct!==null)return direct;
 return canonicalMeasurement(row,key,legacy);
}
function productionPhaseValues(row,fieldId){
 const vals=[];
 for(const phase of (Array.isArray(row?.ProductionPhases)?row.ProductionPhases:[])){
  const v=n(phaseOverride(phase,fieldId));
  if(v!==null&&!vals.some(x=>Math.abs(x-v)<1e-9)) vals.push(v);
 }
 return vals.sort((a,b)=>a-b);
}
function canonicalRange(row,fieldId){
 const direct=n(row?.[fieldId]);
 const values=productionPhaseValues(row,fieldId);
 if(values.length>1)return {min:values[0],max:values[values.length-1],values,source:direct!==null?"model_and_production_phase":"production_phase",variable:true,representative:direct};
 if(values.length===1)return {min:values[0],max:values[0],values,source:direct!==null?"model_and_production_phase":"production_phase",variable:false,representative:direct};
 if(direct!==null)return {min:direct,max:direct,values:[direct],source:"model",variable:false,representative:direct};
 return null;
}
function specificationConfidence(row,key){
 const meta=row?.SpecificationConfidence?.[key];
 if(!meta||typeof meta!=="object")return null;
 return {level:String(meta.Level||""),status:String(meta.Status||""),note:String(meta.Note||""),evidenceRefs:Array.isArray(meta.EvidenceRefs)?meta.EvidenceRefs:[]};
}
function formatBoatMeasurement(row,key,dimension,legacy=[],profile=getUnitProfile()){
 const range=canonicalRange(row,key);
 if(range?.variable)return `${formatMeasurement(range.min,dimension,profile)}–${formatMeasurement(range.max,dimension,profile)}`;
 const value=safeCanonicalMeasurement(row,key,dimension,legacy);
 if(value===null)return range?formatMeasurement(range.min,dimension,profile):null;
 const text=formatMeasurement(value,dimension,profile);
 const meta=specificationConfidence(row,key);
 return meta?.status==="estimated"?`~${text}`:text;
}
function formatUnverifiedVolume(row,key,legacyKey){
 const canonical=n(row?.[key]);
 const legacy=n(row?.[legacyKey]);
 const status=row?.[`${key}UnitStatus`];
 if(status==="canonical_litres" && canonical!==null)return formatMeasurement(canonical,"volume",getUnitProfile());
 if(status==="canonical_litres_assumed_us_gal" && canonical!==null)return `${formatMeasurement(canonical,"volume",getUnitProfile())} (US-gal conversion basis pending verification)`;
 if(status==="source_us_gal" && legacy!==null)return formatMeasurement(toCanonical(legacy,"us_gal"),"volume",getUnitProfile());
 if(status==="source_imp_gal" && legacy!==null)return formatMeasurement(toCanonical(legacy,"imp_gal"),"volume",getUnitProfile());
 if(status==="conflicting_legacy_capacity_values")return "Conflicting capacity values — verify source units";
 if(legacy!==null)return `${legacy.toLocaleString()} gal (basis unverified) / metric not verified`;
 if(canonical!==null)return `${canonical.toLocaleString()} (unit unverified)`;
 return null;
}

function phaseMatchesContext(phase,context={}){
 const y=Number(context.year);
 if(Number.isFinite(y)){
  const sy=Number(phase?.StartYear), ey=Number(phase?.EndYear);
  if(Number.isFinite(sy)&&y<sy)return false;
  if(Number.isFinite(ey)&&y>ey)return false;
 }
 const material=context.HullMaterialCode||context.hullMaterialCode;
 if(material){
  const materialFact=(phase?.FactOverrides||[]).find(f=>f.FieldID==="HullMaterialCode"&&f.ValueState==="known");
  if(materialFact&&String(materialFact.CanonicalValue)!==String(material))return false;
 }
 return true;
}
function resolveProductionPhase(row,context={}){
 const phases=Array.isArray(row?.ProductionPhases)?row.ProductionPhases:[];
 const matches=phases.filter(p=>phaseMatchesContext(p,context));
 return {status:matches.length===1?"resolved":matches.length>1?"ambiguous":"none",phase:matches.length===1?matches[0]:null,matches};
}
function phaseOverride(phase,fieldId){
 const fact=(phase?.FactOverrides||[]).find(f=>String(f.FieldID)===String(fieldId));
 return fact&&fact.ValueState==="known"?fact.CanonicalValue:null;
}
function effectiveCanonicalValue(row,fieldId,context={}){
 const result=resolveProductionPhase(row,context);
 if(result.status==="resolved"){
  const value=phaseOverride(result.phase,fieldId);
  if(value!==null&&value!==undefined)return {value,source:"production_phase",phase:result.phase,status:"known"};
 }
 const direct=row?.[fieldId];
 if(direct!==undefined&&direct!==null&&direct!=="")return {value:direct,source:"model",phase:null,status:"known"};
 return {value:null,source:result.status==="ambiguous"?"production_phase_ambiguous":"model",phase:null,status:result.status==="ambiguous"?"ambiguous":"unknown"};
}

function formatFuelEconomy(speedKn,fuelBurnLh){
 const s=n(speedKn),b=n(fuelBurnLh); if(s===null||b===null||s<=0||b<=0)return null;
 const nmPerUsGal=s/(b/3.785411784), litresPerNm=b/s;
 return `${nmPerUsGal.toFixed(2)} nm/US gal / ${litresPerNm.toFixed(2)} L/nm`;
}
function formatCruisePerformance(row,speedKey,burnKey,profile=getUnitProfile()){
 const speed=n(row?.[speedKey]),burn=n(row?.[burnKey]);
 if(speed===null&&burn===null)return null;
 const parts=[]; if(speed!==null)parts.push(formatMeasurement(speed,"speed",profile)); if(burn!==null)parts.push(formatMeasurement(burn,"fuel_flow",profile));
 const econ=formatFuelEconomy(speed,burn); if(econ)parts.push(econ);
 return parts.join(" · ");
}

global.BAtlasCanonical={FACTORS,CANON,toCanonical,fromCanonical,canonicalMeasurement,feet,inches,enumCode,formatMeasurement,formatBoatMeasurement,formatUnverifiedVolume,getUnitProfile,setUnitProfile,phaseMatchesContext,resolveProductionPhase,phaseOverride,effectiveCanonicalValue,productionPhaseValues,canonicalRange,specificationConfidence,formatFuelEconomy,formatCruisePerformance};
})(typeof window!=="undefined"?window:globalThis);
