import json, glob, collections, os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TODAY='2026-09-12'; VER='6.80.0'
def load(rel):
    with open(ROOT/rel,encoding='utf-8') as f:return json.load(f)
def save(rel,data):
    p=ROOT/rel; p.parent.mkdir(parents=True,exist_ok=True)
    with open(p,'w',encoding='utf-8') as f: json.dump(data,f,indent=2,ensure_ascii=False); f.write('\n')
def m_to_ft(v): return round(float(v)/0.3048,4)
models=load('boatmodels.json'); byid={m['BoatModelID']:m for m in models}
old_conf=load('developer/reports/data-health-measurement-conflicts-v6.79.json')['Conflicts']
old_year=load('developer/reports/data-health-year-conflicts-v6.79.json')['Conflicts']
# Evidence index
evidence=collections.defaultdict(list)
for p in (ROOT/'knowledge/data/evidence').glob('*.json'):
    d=json.load(open(p,encoding='utf-8'))
    for a in d.get('assertions',[]):
        if a.get('BoatModelID') and a.get('FieldID'):
            evidence[(a['BoatModelID'],a['FieldID'])].append(a)
legacy_fields={'LOA':['LOA_ft','LengthFt'],'Beam':['Beam_ft','BeamFt'],'Draft':['Draft_ft','DraftFt'],'AirDraft':['AirDraft_ft']}
resolved=[]; unresolved=[]
# Canonical non-null values are the researched runtime values. Normalize compatibility mirrors to them.
for c in old_conf:
    m=byid[c['BoatModelID']]; field=c['Field']; canon=m.get(field)
    ev=[a for a in evidence.get((m['BoatModelID'],field),[]) if a.get('AssertionState')=='supports' and a.get('NormalizedCandidateValue') is not None and a.get('Applicability',{}).get('scope')=='model']
    if canon is not None:
        feet=m_to_ft(canon)
        before={k:m.get(k) for k in legacy_fields[field]}
        for k in legacy_fields[field]:
            if k in m: m[k]=feet
        m['LastUpdated']=TODAY
        resolved.append({'BoatModelID':m['BoatModelID'],'Field':field,'Action':'synchronized_legacy_mirrors_to_canonical','CanonicalMetres':canon,'CanonicalFeet':feet,'PreviousLegacyValues':before,'EvidenceRefs':[a.get('EvidenceAssertionID') for a in ev]})
    else:
        # Promote only if exactly one model-scope supported candidate exists.
        vals={round(float(a['NormalizedCandidateValue']),6) for a in ev}
        if len(vals)==1:
            canon=next(iter(vals)); m[field]=canon; feet=m_to_ft(canon)
            before={k:m.get(k) for k in legacy_fields[field]}
            for k in legacy_fields[field]:
                if k in m: m[k]=feet
            m['LastUpdated']=TODAY
            resolved.append({'BoatModelID':m['BoatModelID'],'Field':field,'Action':'promoted_supported_canonical_and_synchronized_mirrors','CanonicalMetres':canon,'CanonicalFeet':feet,'PreviousLegacyValues':before,'EvidenceRefs':[a.get('EvidenceAssertionID') for a in ev]})
        else:
            unresolved.append(c)
# Production-year duplicates: FirstYear/LastYear are current runtime identity fields. Synchronize duplicate YearStart/YearEnd except explicit unresolved evidence.
year_res=[]; year_unres=[]
for c in old_year:
    m=byid[c['BoatModelID']]
    active='FirstYear' if c['Boundary']=='start' else 'LastYear'; mirror='YearStart' if c['Boundary']=='start' else 'YearEnd'
    unresolved_ev=[a for a in evidence.get((m['BoatModelID'],active),[]) if a.get('AssertionState')=='unresolved']
    if unresolved_ev:
        year_unres.append({**c,'Reason':'explicit_unresolved_evidence','EvidenceRefs':[a.get('EvidenceAssertionID') for a in unresolved_ev]})
        continue
    before=m.get(mirror); m[mirror]=m.get(active); m['LastUpdated']=TODAY
    year_res.append({'BoatModelID':m['BoatModelID'],'Boundary':c['Boundary'],'AuthoritativeField':active,'Value':m.get(active),'MirrorField':mirror,'PreviousMirrorValue':before,'Action':'synchronized_year_mirror_to_runtime_identity'})
save('boatmodels.json',models)
# Rebuild conflict reports
meas=[]
for m in models:
  for field,olds in legacy_fields.items():
    vals=[(k,m.get(k)) for k in olds if isinstance(m.get(k),(int,float))]
    if len(vals)>1 and len({round(float(v),3) for _,v in vals})>1:
      meas.append({'BoatModelID':m['BoatModelID'],'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),'Field':field,'CanonicalMetres':m.get(field),'LegacyValuesFeet':dict(vals),'Action':'manual_reconciliation'})
yearconf=[]
for m in models:
  for a,b,label in [('FirstYear','YearStart','start'),('LastYear','YearEnd','end')]:
    if m.get(a) is not None and m.get(b) is not None and m[a]!=m[b]:
      yearconf.append({'BoatModelID':m['BoatModelID'],'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),'Boundary':label,a:m[a],b:m[b],'Action':'manual_reconciliation'})
save('developer/reports/data-health-measurement-conflicts-v6.80.json',{'Version':VER,'ConflictCount':len(meas),'Conflicts':meas})
save('developer/reports/data-health-year-conflicts-v6.80.json',{'Version':VER,'ConflictCount':len(yearconf),'Conflicts':yearconf})
save('developer/reports/RECONCILIATION_V6_80.json',{'Version':VER,'Date':TODAY,'MeasurementResolvedCount':len(resolved),'MeasurementRemainingCount':len(meas),'MeasurementActions':resolved,'YearResolvedCount':len(year_res),'YearRemainingCount':len(yearconf),'YearActions':year_res,'Policy':{'Measurements':'Canonical non-null values remain authoritative; compatibility mirrors are synchronized. Canonical null is promoted only with one supported model-scope evidence value.','Years':'FirstYear/LastYear remain runtime identity authority for this release; YearStart/YearEnd are synchronized unless explicit evidence marks the boundary unresolved.'}})
# Plan critical exceptions rebuild
exceptions=[]
for m in models:
    unknown=[]; legacy={}
    for field,olds in legacy_fields.items():
      if m.get(field) is None:
        unknown.append(field); vals=[m.get(k) for k in olds if isinstance(m.get(k),(int,float))]; legacy[field]=vals[0] if vals else None
    if unknown: exceptions.append({'BoatModelID':m['BoatModelID'],'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),'ResearchedUnknownFields':unknown,'LegacyValues':legacy,'PlanBehavior':'retain_candidate_reduce_confidence'})
save('data/plan-critical-exceptions-v6.80.json',{'Version':VER,'Purpose':'Current plan-critical canonical unknowns after measurement/year reconciliation. Canonical null remains authoritative where evidence is conflicting, phase-specific, configuration-specific or insufficient.','Counts':{'ModelsWithPlanCriticalExceptions':len(exceptions),'FieldCounts':{f:sum(f in x['ResearchedUnknownFields'] for x in exceptions) for f in legacy_fields}},'Exceptions':exceptions})
# Manifest
manifest=load('data/data-manifest.json'); manifest['Release']='v6.80.0'; manifest['release']='v6.80.0-measurement-year-reconciliation'; manifest['lastUpdated']=TODAY; manifest['LastUpdated']=TODAY; manifest['phase']='Measurement and production-year reconciliation'; manifest['notes']='v6.80.0 synchronizes stale legacy measurement mirrors to researched canonical values, preserves unresolved canonical nulls, and reconciles duplicate production-year fields against active runtime identity fields except where evidence explicitly remains unresolved.'
manifest.setdefault('developerReports',[]); manifest['developerReports']=[x for x in manifest['developerReports'] if not (isinstance(x,dict) and ('measurement-conflicts' in x.get('path','') or 'year-conflicts' in x.get('path','')))] + [
 {'path':'developer/reports/data-health-measurement-conflicts-v6.80.json','role':'Remaining unresolved measurement conflicts after reconciliation.'},
 {'path':'developer/reports/data-health-year-conflicts-v6.80.json','role':'Remaining unresolved production-year conflicts after reconciliation.'},
 {'path':'developer/reports/RECONCILIATION_V6_80.json','role':'Actions and policy for v6.80.0 reconciliation.'}]
save('data/data-manifest.json',manifest)
print(json.dumps({'measurementResolved':len(resolved),'measurementRemaining':len(meas),'yearResolved':len(year_res),'yearRemaining':len(yearconf),'planCriticalModels':len(exceptions)},indent=2))
