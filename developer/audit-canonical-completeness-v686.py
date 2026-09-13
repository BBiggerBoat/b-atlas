#!/usr/bin/env python3
import json, pathlib, datetime, collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
MODELS=ROOT/'boatmodels.json'
REGISTRY=ROOT/'data/field-registry.json'
OUT_AUDIT=ROOT/'data/canonical-completeness-audit-v6.86.json'
OUT_QUEUE=ROOT/'data/canonical-missing-data-queue-v6.86.json'

models=json.load(open(MODELS,encoding='utf-8'))
registry=json.load(open(REGISTRY,encoding='utf-8'))
fields=registry['fields']
by_id={f['fieldId']:f for f in fields}

# Higher weights mean missing data more directly affects elimination, route-fit, handling, or buyer suitability.
PRIORITY={
 'LOA':10,'Beam':10,'Draft':10,'AirDraft':9,'FuelCode':10,'MechanicalPropulsionCode':10,
 'HullBehaviourCode':9,'HullConfigurationCode':8,'KeelConfigurationCode':8,'RudderTypeCode':8,
 'EngineCount':7,'BoatFamilyCode':7,'SideDecksCode':7,'FlybridgeCode':6,'AftCabin':6,
 'Trailerable':6,'Headroom':8,'GalleyUpWithHelm':6,'WalkthroughTransom':6,'SideHelmDoor':7,
 'RemovableFlybridge':4,'ShowerTypeCode':4,'RunningGearProtectionCode':5,
 'FuelCapacity':5,'WaterCapacity':3,'HoldingCapacity':3,'Displacement':4,'LWL':3,
 'FirstYear':4,'LastYear':4,'HullMaterialCode':4,'EnginePowerPerEngine':3,
 'CruiseSpeed':3,'MaxSpeed':2,'Range':3,'Configuration':3,'Cabins':2,'Berths':2,'Heads':2,
 'VBerthLength':2,'TotalBuilt':1,'Designer':1,'Builder':1,'BuilderCountryCode':1,'DesignCountryCode':1,
}
DEFAULT_WEIGHT=1
FILTER_CRITICAL={'LOA','Beam','Draft','AirDraft','Headroom','FuelCode','MechanicalPropulsionCode','HullBehaviourCode','HullConfigurationCode','KeelConfigurationCode','RudderTypeCode','EngineCount','BoatFamilyCode','FlybridgeCode','AftCabin','SideDecksCode','Trailerable','GalleyUpWithHelm','WalkthroughTransom','SideHelmDoor','RemovableFlybridge','ShowerTypeCode'}

# Fields that are structurally registered but not yet adopted fleet-wide. Treat as program-level work, not 259 model failures.
SYSTEMIC_LOW_ADOPTION={
 'Brand','Builder','BuilderCountryCode','DesignCountryCode',
 'CruiseSpeed','MaxSpeed','Range','TotalInstalledPower','SteeringTypeCode','PropellerCount','AuxiliaryEnginePresent',
 'GalleyUpWithHelm','WalkthroughTransom','SideHelmDoor','RemovableFlybridge','CECategoryCode','CertificationNotes',
 'VBerthLength','HeadroomSalon','HeadroomHelm','HeadroomGalley','HeadroomHead','HeadroomForwardCabin'
}

# Explicit N/A only where the schema itself provides applicability rules.
def model_category(m):
    return m.get('VesselCategoryCode')

def present(v):
    if v is None: return False
    if isinstance(v,str): return bool(v.strip()) and v.strip().lower() not in {'unknown','not known','not researched','tbd','n/a','na','not available','unverified'}
    if isinstance(v,(list,dict)): return len(v)>0
    return True

pop_counts={f['fieldId']:sum(1 for m in models if present(m.get(f['fieldId']))) for f in fields}

def legacy_present(m,f):
    for k in f.get('legacyKeys') or []:
        if present(m.get(k)):
            return k
    return None

def status_for(m,f):
    fid=f['fieldId']
    if present(m.get(fid)):
        return 'present', None
    apps=f.get('applicability')
    if apps and model_category(m) not in apps:
        return 'not_applicable', 'schema_applicability'
    pcs=m.get('PlanCriticalStatus') or {}
    if fid in pcs:
        val=pcs[fid]
        if val=='researched_unknown': return 'researched_unknown','plan_critical_status'
        if val=='configuration_or_production_mixed': return 'variable_by_configuration','plan_critical_status'
    # Active/current model with no LastYear is an open production range, not a research miss.
    if fid=='LastYear' and (m.get('Active') is True or str(m.get('Status','')).lower()=='current'):
        return 'open_ended_current','active_model'
    lk=legacy_present(m,f)
    # Only fields with deterministic, validated legacy-to-canonical mappings remain normalization tasks.
    # Shower and keel legacy text is internally inconsistent and therefore requires evidence/research, not blind migration.
    if lk and fid in {'StyleCode','CoolingCode','FlybridgeCode','SideDecksCode'}:
        return 'normalization_gap', lk
    if pop_counts[fid] <= 5 and fid in SYSTEMIC_LOW_ADOPTION:
        return 'systemic_program_gap','fleet_wide_low_adoption'
    return 'missing_research',None

field_summary=[]
field_status_counts={}
model_records=[]
for f in fields:
    fid=f['fieldId']
    counts=collections.Counter()
    reasons=collections.Counter()
    for m in models:
        st,why=status_for(m,f); counts[st]+=1
        if why: reasons[why]+=1
    field_status_counts[fid]=counts
    field_summary.append({
        'field':fid,'group':f.get('groupId'),'dataClass':f.get('dataClass'),'matchInput':bool(f.get('matchInput')),
        'priorityWeight':PRIORITY.get(fid,DEFAULT_WEIGHT),'present':counts['present'],'missingResearch':counts['missing_research'],
        'researchedUnknown':counts['researched_unknown'],'variableByConfiguration':counts['variable_by_configuration'],
        'notApplicable':counts['not_applicable'],'normalizationGap':counts['normalization_gap'],
        'systemicProgramGap':counts['systemic_program_gap'],'openEndedCurrent':counts['open_ended_current'],
        'populationPercent':round(100*counts['present']/len(models),1),
        'legacyKeys':f.get('legacyKeys') or [],'applicability':f.get('applicability'),
        'reasonCounts':dict(reasons)
    })

for m in models:
    missing=[]; normalization=[]; unknown=[]; variable=[]; systemic=[]; na=[]; openended=[]
    score=0; filter_score=0
    for f in fields:
        fid=f['fieldId']; st,why=status_for(m,f)
        rec={'field':fid,'group':f.get('groupId'),'weight':PRIORITY.get(fid,DEFAULT_WEIGHT)}
        if why: rec['reason']=why
        if st=='missing_research':
            missing.append(rec); score += rec['weight']; filter_score += rec['weight'] if fid in FILTER_CRITICAL else 0
        elif st=='normalization_gap': normalization.append(rec)
        elif st=='researched_unknown': unknown.append(rec)
        elif st=='variable_by_configuration': variable.append(rec)
        elif st=='systemic_program_gap': systemic.append(rec)
        elif st=='not_applicable': na.append(rec)
        elif st=='open_ended_current': openended.append(rec)
    model_records.append({
        'BoatModelID':m.get('BoatModelID'),'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant') or '',
        'FilterCriticalPriorityScore':filter_score,'ResearchPriorityScore':score,'MissingResearchFields':[x['field'] for x in missing],
        'NormalizationGapFields':[x['field'] for x in normalization],
        'ResearchedUnknownFields':[x['field'] for x in unknown],
        'VariableByConfigurationFields':[x['field'] for x in variable],
        'SystemicProgramGapFields':[x['field'] for x in systemic],
        'NotApplicableFields':[x['field'] for x in na],
        'OpenEndedCurrentFields':[x['field'] for x in openended]
    })

# Prioritize models by actual research gaps, not schema migration or fleet-wide programs.
ranked=sorted(model_records,key=lambda r:(-r['FilterCriticalPriorityScore'],-r['ResearchPriorityScore'],-len(r['MissingResearchFields']),r['Manufacturer'],r['Model'],r['Variant']))
# Field-level research queue excludes pure schema/migration gaps.
research_fields=sorted(
    [x for x in field_summary if x['missingResearch']>0],
    key=lambda x:(-(x['missingResearch']*x['priorityWeight']),-x['priorityWeight'],-x['missingResearch'],x['field'])
)
normalization_fields=sorted(
    [x for x in field_summary if x['normalizationGap']>0],
    key=lambda x:(-x['normalizationGap'],-x['priorityWeight'],x['field'])
)
systemic_fields=sorted(
    [x for x in field_summary if x['systemicProgramGap']>0],
    key=lambda x:(-x['priorityWeight'],x['field'])
)

summary={
 'release':'v6.86.0','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'modelCount':len(models),'registeredFieldCount':len(fields),
 'classificationDefinitions':{
   'present':'Canonical field contains a usable value.',
   'not_applicable':'Schema applicability excludes this vessel category.',
   'researched_unknown':'Field was researched and remains unsupported/unknown; keep candidate eligible.',
   'variable_by_configuration':'A single model-wide value would be misleading because production/configuration varies.',
   'normalization_gap':'Equivalent/source-backed value already exists in boatmodels.json under a legacy/source field and should be normalized, not re-researched.',
   'systemic_program_gap':'Field is registered but unpopulated fleet-wide; treat as a field-program/schema adoption task, not hundreds of model failures.',
   'open_ended_current':'Blank LastYear represents current/active production.',
   'missing_research':'Applicable field lacks a canonical value and no evidence marks it intentionally unknown/variable.'
 },
 'fieldSummary':field_summary,
 'models':ranked
}
queue={
 'release':'v6.86.0','generatedAt':summary['generatedAt'],'modelCount':len(models),
 'researchQueue':ranked,
 'fieldResearchPriorities':research_fields,
 'normalizationQueue':normalization_fields,
 'systemicFieldPrograms':systemic_fields,
 'notes':[
  'Missing information remains eligible and must not be treated as an exclusion.',
  'Normalization gaps should be resolved from existing canonical-record evidence before external research.',
  'Systemic program gaps are intentionally separated from model-level research priorities.',
  'Production-phase-specific facts remain in data/production-phases.json and are not counted as duplicate model-wide values.'
 ]
}
json.dump(summary,open(OUT_AUDIT,'w',encoding='utf-8'),indent=2,ensure_ascii=False); open(OUT_AUDIT,'a').write('\n')
json.dump(queue,open(OUT_QUEUE,'w',encoding='utf-8'),indent=2,ensure_ascii=False); open(OUT_QUEUE,'a').write('\n')

print('models',len(models),'fields',len(fields))
print('top missing fields:')
for x in research_fields[:20]: print(x['field'],x['missingResearch'],'weight',x['priorityWeight'],'pop%',x['populationPercent'])
print('normalization:',[(x['field'],x['normalizationGap']) for x in normalization_fields])
print('systemic:',[(x['field'],x['systemicProgramGap']) for x in systemic_fields])
print('top models:')
for r in ranked[:20]: print(r['ResearchPriorityScore'],r['BoatModelID'],len(r['MissingResearchFields']),','.join(r['MissingResearchFields'][:12]))
