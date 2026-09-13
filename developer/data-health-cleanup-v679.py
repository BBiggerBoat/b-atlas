import json, os, shutil, hashlib, collections, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RELEASE='v6.79.0'
TODAY='2026-09-12'

def load(rel):
    with open(ROOT/rel,encoding='utf-8') as f:return json.load(f)
def save(rel,data):
    p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True)
    with open(p,'w',encoding='utf-8') as f:json.dump(data,f,indent=2,ensure_ascii=False);f.write('\n')
def ftm(v):return round(float(v)*0.3048,4)

models=load('boatmodels.json')
byid={m['BoatModelID']:m for m in models}

# Conservative promotions: existing model-specific evidence supports the value, no known phase conflict,
# and legacy representations are either consistent or only one value exists.
promotions={
 'CDRY-25-TC': {'Draft':1.5},
 'CDRY-26-PA': {'LOA':26,'Beam':8.5,'Draft':1.5},
 'CARV-356-AF': {'LOA':39.33},
 'CHBY-40': {'LOA':40,'Beam':13,'Draft':4},
 'DUFF-29': {'LOA':29,'Beam':10,'Draft':3},
 'DUFF-39': {'LOA':39,'Beam':13,'Draft':4},
 'FJRD-36': {'Draft':3},
 'MNSH-30-PI': {'Draft':2.92},
 'NPAC-28': {'Draft':2.42},
 'ROSB-246-WH': {'Draft':1.5},
 'ROSB-246': {'Draft':1.5},
 'SSPT-27': {'Draft':2.67},
 'TRUN-34': {'LOA':34.33},
}
changes=[]
for mid,fields in promotions.items():
    m=byid[mid]
    for field,feet in fields.items():
        old=m.get(field)
        if old is None:
            m[field]=ftm(feet)
            changes.append({'BoatModelID':mid,'Field':field,'LegacyFeet':feet,'CanonicalMetres':m[field],'Action':'promoted_existing_supported_value'})
    m['LastUpdated']=TODAY

save('boatmodels.json',models)

# Build a current plan-critical exception file from actual canonical state.
legacy_map={
 'LOA':['LOA_ft','LengthFt'], 'Beam':['Beam_ft','BeamFt'], 'Draft':['Draft_ft','DraftFt'], 'AirDraft':['AirDraft_ft']
}
exceptions=[]
for m in models:
    unknown=[]; legacy={}
    for field,olds in legacy_map.items():
        if m.get(field) is None:
            unknown.append(field)
            vals=[m.get(k) for k in olds if isinstance(m.get(k),(int,float))]
            legacy[field]=vals[0] if vals else None
    if unknown:
        exceptions.append({
          'BoatModelID':m['BoatModelID'],'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),
          'ResearchedUnknownFields':unknown,'LegacyValues':legacy,'PlanBehavior':'retain_candidate_reduce_confidence'
        })
plan={
 'Version':'6.79.0','Purpose':'Current plan-critical canonical unknowns after conservative data-health reconciliation. Canonical null remains authoritative where evidence is conflicting, phase-specific, configuration-specific or insufficient.',
 'Counts':{'ModelsWithPlanCriticalExceptions':len(exceptions),'FieldCounts':{f:sum(f in x['ResearchedUnknownFields'] for x in exceptions) for f in legacy_map}},
 'Exceptions':exceptions
}
save('data/plan-critical-exceptions-v6.79.json',plan)

# Identity overlap review queue: never auto-merge variants based only on shared manufacturer/model.
groups=collections.defaultdict(list)
for m in models:
    key=(str(m.get('Manufacturer') or '').strip().casefold(),str(m.get('Model') or '').strip().casefold())
    groups[key].append(m)
identity=[]
for key,rows in sorted(groups.items()):
    if len(rows)<2:continue
    identity.append({
      'Manufacturer':rows[0].get('Manufacturer'),'Model':rows[0].get('Model'),'RecordCount':len(rows),
      'Records':[{'BoatModelID':r.get('BoatModelID'),'Variant':r.get('Variant'),'FirstYear':r.get('FirstYear'),'LastYear':r.get('LastYear')} for r in rows],
      'Action':'manual_identity_review','AutoMerge':False,
      'Reason':'Shared manufacturer/model designation may represent legitimate variants, generations, importer names or duplicate identities.'
    })
save('developer/reports/data-health-identity-review-v6.79.json',{'Version':'6.79.0','GroupCount':len(identity),'Groups':identity})

# Measurement conflict report.
conf=[]
for m in models:
    for field,olds in legacy_map.items():
        vals=[]
        for k in olds:
            v=m.get(k)
            if isinstance(v,(int,float)):vals.append((k,float(v)))
        if len(vals)>1:
            unique={round(v,3) for _,v in vals}
            if len(unique)>1:
                conf.append({'BoatModelID':m['BoatModelID'],'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),'Field':field,'CanonicalMetres':m.get(field),'LegacyValuesFeet':dict(vals),'Action':'manual_reconciliation'})
save('developer/reports/data-health-measurement-conflicts-v6.79.json',{'Version':'6.79.0','ConflictCount':len(conf),'Conflicts':conf})

# Year conflict report (no destructive migration because semantics/production phases may differ).
yearconf=[]
for m in models:
    for a,b,label in [('FirstYear','YearStart','start'),('LastYear','YearEnd','end')]:
        if m.get(a) is not None and m.get(b) is not None and m[a]!=m[b]:
            yearconf.append({'BoatModelID':m['BoatModelID'],'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),'Boundary':label,a:m[a],b:m[b],'Action':'manual_reconciliation'})
save('developer/reports/data-health-year-conflicts-v6.79.json',{'Version':'6.79.0','ConflictCount':len(yearconf),'Conflicts':yearconf})

# Archive historical specification workflow snapshots and already-retired duplicate data.
archive=ROOT/'developer/archive/data-health-v6.79'
archive.mkdir(parents=True,exist_ok=True)
patterns=['data/specification-research-queue-v*.json','data/specification-completion-batch-*-v*.json','data/specification-tail-status-v*.json','data/global-residual-gap-audit-v*.json']
archived=[]
for pattern in patterns:
    for src in ROOT.glob(pattern):
        dest=archive/src.name
        shutil.move(str(src),str(dest));archived.append(str(src.relative_to(ROOT)))
retired=[
 'missions.json','data/registry/boat-registry-validation.json','data/registry/identity-code-audit.json',
 'data/taxonomy/taxonomy-validation.json','knowledge/data/knowledge-layer-summary.json','data/registry/legacy-id-map.json',
 'knowledge/data/boatintelligence.json','data/plan-critical-exceptions-v6.62.json'
]
for rel in retired:
    src=ROOT/rel
    if src.exists():
        dest=archive/(rel.replace('/','__'))
        shutil.move(str(src),str(dest));archived.append(rel)

# Update runtime boat-intelligence loader to use the authoritative model record directly.
kui=ROOT/'knowledge/knowledgecardui.js'
txt=kui.read_text(encoding='utf-8')
txt=txt.replace("const INTELLIGENCE_PATH = 'knowledge/data/boatintelligence.json';","const INTELLIGENCE_PATH = 'boatmodels.json';")
kui.write_text(txt,encoding='utf-8')

# Refresh manifest to describe current ownership rather than old migration phases.
manifest=load('data/data-manifest.json')
manifest['release']=RELEASE+'-canonical-data-health-consolidation'
manifest['Release']=RELEASE
manifest['lastUpdated']=TODAY
manifest['LastUpdated']=TODAY
manifest['modelCount']=len(models)
manifest['phase']='Canonical data health consolidation'
manifest['purpose']='Document authoritative runtime data after canonical measurement reconciliation, historical snapshot archiving and duplicate-source cleanup.'
manifest['notes']='v6.79.0 consolidates active data ownership, archives historical specification workflow snapshots, retires the runtime boatintelligence duplicate, promotes only evidence-supported canonical measurements, and creates explicit identity/measurement/year reconciliation reports for ambiguous cases.'
manifest['archives']=[x for x in manifest.get('archives',[]) if isinstance(x,dict)]
manifest['archives'].append({'path':'developer/archive/data-health-v6.79/','role':'Historical specification workflow snapshots and retired duplicate data sources; not loaded at runtime.'})
# Retired files are now physically archived; keep retirement history but mark archive destination.
for item in manifest.get('retired',[]):
    if isinstance(item,dict): item['archivedIn']='developer/archive/data-health-v6.79/'
manifest['generated']=[x for x in manifest.get('generated',[]) if not (isinstance(x,dict) and x.get('path')=='knowledge/data/knowledge-coverage.json')]
manifest['developerReports']=[x for x in manifest.get('developerReports',[]) if isinstance(x,dict)]
manifest['developerReports'] += [
 {'path':'developer/reports/data-health-identity-review-v6.79.json','role':'Potential overlapping model identities requiring manual review; no automatic merges.'},
 {'path':'developer/reports/data-health-measurement-conflicts-v6.79.json','role':'Conflicting legacy measurement representations requiring manual reconciliation.'},
 {'path':'developer/reports/data-health-year-conflicts-v6.79.json','role':'Conflicting production-year representations requiring manual reconciliation.'}
]
# Update knowledge ownership to remove active dependency on legacy intelligence file.
ko=manifest.get('knowledgeOwnership',{})
ko['knowledge/data/boatintelligence.json']='Retired and archived in v6.79.0; runtime intelligence is read from SupplementalIntelligence in boatmodels.json.'
manifest['knowledgeOwnership']=ko
save('data/data-manifest.json',manifest)

# Audit record for this release.
audit={
 'Version':'6.79.0','Date':TODAY,'ModelCount':len(models),'CanonicalMeasurementPromotions':changes,
 'PromotionCount':len(changes),'ArchivedFiles':sorted(archived),'ArchivedFileCount':len(archived),
 'IdentityReviewGroupCount':len(identity),'MeasurementConflictCount':len(conf),'YearConflictCount':len(yearconf),
 'Policy':{
  'CanonicalNull':'Remains authoritative; no generic legacy fallback was re-enabled.',
  'Promotion':'Only explicitly reviewed, evidence-supported, non-phase-conflicting values were promoted.',
  'Identity':'No model records were auto-merged. Ambiguous groups are queued for manual review.',
  'HistoricalData':'Old workflow snapshots and retired duplicate files were moved out of active data paths.'
 }
}
save('developer/reports/DATA_HEALTH_V6_79.json',audit)
print(json.dumps({'promotions':len(changes),'archived':len(archived),'identityGroups':len(identity),'measurementConflicts':len(conf),'yearConflicts':len(yearconf),'exceptions':len(exceptions)},indent=2))
