import json, re, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TODAY='2026-09-12'; VER='6.81.0'

def load(rel): return json.loads((ROOT/rel).read_text(encoding='utf-8'))
def save(rel,obj):
 p=ROOT/rel; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+"\n",encoding='utf-8')

def norm(s): return re.sub(r'[^a-z0-9]+',' ',str(s or '').lower()).strip()

models=load('boatmodels.json'); registry=load('data/registry/boat-registry.json')
identity=load('developer/reports/data-health-identity-review-v6.79.json')

family_specs={
 ('Albin','27'):('ALBN-27','distinct_layout_variants','Family Cruiser and Sport Cruiser are distinct marketed layouts within the Albin 27 family.'),
 ('Albin','28 Tournament Express'):('ALBN-28-TE','distinct_configuration_generations','Engine Box and Flush Deck are distinct factory configurations/generations and should remain separately searchable.'),
 ('Beneteau','Antares 9'):('BENE-ANT-9','distinct_generations','Generation 2 succeeds Generation 1 under the same marketed name but is a materially revised design.'),
 ('Camano','28/31'):('CAMA-28-31','same_hull_distinct_variants','Gnome and Troll share the Camano hull family; Gnome omits the flybridge while Troll/28/31 is the flybridge variant.'),
 ('Cape Dory','28'):('CPDR-28','distinct_factory_variants','Cruiser, Flybridge Cruiser and Open Fisherman are distinct factory configurations.'),
 ('CHB','34'):('CHBB-34','ambiguous_historical_family','Sedan is distinct from aft-cabin boats. Double Cabin and Tri-Cabin naming overlaps historically, so no destructive merge is justified yet.'),
 ('Grand Banks','36'):('GRBK-36','distinct_layout_variants','Classic and Europa are distinct accommodation/superstructure variants.'),
 ('Mainship','34'):('MNSH-34','distinct_generations_and_name_reuse','MK I/II/III are historical generations/configurations; the 2005-09 34 Trawler is a later materially different model reusing the size designation.'),
 ('Marine Trader','34'):('MTRA-34','distinct_layout_variants','Europa and Sedan are distinct superstructure/layout variants.'),
 ('Marine Trader','38'):('MRTR-38','distinct_lines_needs_phase_research','Double Cabin and Sundeck remain separate. The Sundeck record contains evidence from different eras and requires phase-level cleanup.'),
 ('Meridian','341 Sedan'):('MERI-341','distinct_generations','The 2003-04 Bayliner-3488-lineage boat and all-new 2005-14 341 are materially different boats despite the shared model name.'),
 ('Ranger Tugs','R-21'):('RNGR-R21','distinct_generations','Classic and EC are recognized distinct Ranger Tugs model generations.'),
 ('Ranger Tugs','R-25'):('RNGR-R25','distinct_generations_propulsion','Classic diesel, SC diesel and current outboard R-25 are materially different generations/configurations.'),
 ('Ranger Tugs','R-27'):('RNGR-R27','distinct_generations_propulsion','Classic diesel, single-outboard and current twin-outboard versions are materially different generations.'),
 ('Rosborough','RF-246'):('ROSB-RF246','distinct_factory_configurations','Custom Wheelhouse and legacy Sedan Cruiser Diesel represent materially different configurations; preserve separately.'),
 ('Sea Ray','340 Sundancer'):('SEAR-340-SU','distinct_generations','The three 340 Sundancer records represent separated design generations and should remain distinct.'),
}

families=[]
reg_by_id={r.get('BoatModelID'):r for r in registry}
model_by_id={m.get('BoatModelID'):m for m in models}
removed_aliases=[]
for g in identity['Groups']:
 key=(g['Manufacturer'],g['Model']); fid,disp,reason=family_specs[key]
 members=[r['BoatModelID'] for r in g['Records']]
 # collect alias collisions within family, move them to family-level shared aliases
 alias_map={}
 for mid in members:
  rr=reg_by_id.get(mid,{})
  for a in rr.get('Aliases') or []:
   alias_map.setdefault(norm(a),[]).append((mid,a))
 shared=[]
 for nk, vals in alias_map.items():
  mids={x[0] for x in vals}
  if len(mids)>1:
   # Keep one human form at family level and remove from every member.
   shared.append(vals[0][1])
   for mid,a in vals:
    rr=reg_by_id[mid]
    rr['Aliases']=[x for x in (rr.get('Aliases') or []) if norm(x)!=nk]
    removed_aliases.append({'BoatModelID':mid,'Alias':a,'MovedToFamilyID':fid})
 # explicitly clean known cross-identity bad aliases in CHB family
 if fid=='CHBB-34':
  bad_by_id={
   'CHBY-34-SE':{'CHB 34 Sedan','CHB-34-SE'},
   'CHBB-34-TC':{'CHB 34 Double Cabin'},
  }
  for mid,bads in bad_by_id.items():
   rr=reg_by_id[mid]
   keep=[]
   for a in rr.get('Aliases') or []:
    if a in bads:
     removed_aliases.append({'BoatModelID':mid,'Alias':a,'RemovedAs':'cross-identity alias collision'})
    else: keep.append(a)
   rr['Aliases']=keep
 for mid in members:
  model_by_id[mid]['ModelIdentityFamilyID']=fid
  reg_by_id[mid]['ModelIdentityFamilyID']=fid
  reg_by_id[mid]['IdentityDisposition']=disp
 families.append({
  'ModelIdentityFamilyID':fid,'Manufacturer':g['Manufacturer'],'ModelDesignation':g['Model'],
  'Disposition':disp,'AutoMerge':False,'MemberBoatModelIDs':members,
  'SharedAliases':sorted(set(shared)), 'Resolution':reason,
  'ReviewedOn':TODAY,'Release':'v'+VER
 })

# Resolve conflicts where current evidence is now adequate.
FT=.3048
resolved=[]
def setft(mid,field,feet,source,note):
 m=model_by_id[mid]; m[field]=round(feet*FT,6)
 resolved.append({'BoatModelID':mid,'Field':field,'ValueFeet':feet,'CanonicalMetres':m[field],'Source':source,'Note':note})
# CHB 34 family: published dimensional set 33'6 x 11'9 x 3'6 appears consistently for the underlying 34-ft hull family.
for mid in ('CHBB-34-SE','CHBB-34-TC'):
 setft(mid,'LOA',33.5,'HMY Powerboat Guide / CHB family evidence','Use published hull LOA rather than rounded 34-ft marketing designation.')
 setft(mid,'Beam',11.75,'HMY Powerboat Guide / CHB family evidence','Use published 11 ft 9 in beam.')
 setft(mid,'Draft',3.5,'HMY Powerboat Guide / CHB family evidence','Use published 3 ft 6 in draft; historical examples should still be verified individually.')
# Cutwater factory manual explicitly distinguishes molded 30 ft from rigged overall 35 ft 8 in; B-Atlas LOA is fit/overall envelope.
setft('CUTW-30-P','LOA',35+8/12,'Cutwater C30 owner manual','Use factory rigged LOA (with swim platform and pulpit) for overall-envelope filtering; molded hull length is 30 ft.')

# Archive legacy parallel fields before removing them from canonical storage.
legacy_keys=['LOA_ft','LengthFt','LWL_ft','Beam_ft','BeamFt','Draft_ft','DraftFt','AirDraft_ft','Headroom_ft','Displacement_lb','YearStart','YearEnd']
archive=[]
for m in models:
 vals={k:m.get(k) for k in legacy_keys if k in m and m.get(k) not in (None,'')}
 if vals: archive.append({'BoatModelID':m.get('BoatModelID'),'LegacyValues':vals})
 for k in legacy_keys: m.pop(k,None)

# Current unresolved canonical measurement list after retirement.
unresolved=[]
for mid,field,note in [
 ('MRTR-38-SD2','Beam','Sundeck evidence spans materially different eras; phase-level identity research required.'),
 ('MRTR-38-SD2','Draft','Sundeck evidence spans materially different eras; phase-level identity research required.'),
 ('ROSB-246-LS','Draft','Published/model listing evidence conflicts between 18 in and 24 in; preserve unknown pending configuration-specific resolution.')]:
 if model_by_id[mid].get(field) is None:
  unresolved.append({'BoatModelID':mid,'Field':field,'Action':'manual_phase_or_configuration_research','Reason':note})

# Write canonical datasets.
save('boatmodels.json',models)
save('data/registry/boat-registry.json',registry)
save('data/model-families.json',families)
save('developer/archive/legacy-parallel-fields-v6.80.json',{'ArchivedFrom':'v6.80.0','ArchivedOn':TODAY,'RecordCount':len(archive),'Fields':legacy_keys,'Records':archive})
save('developer/reports/IDENTITY_CONSOLIDATION_V6_81.json',{
 'Version':'v'+VER,'ReviewedFamilies':len(families),'DestructiveMerges':0,
 'Policy':'No records were merged where a layout, generation, propulsion change, or historical naming ambiguity could materially mislead a buyer.',
 'Families':families,'AliasesRemovedOrMoved':removed_aliases,'MeasurementsResolved':resolved,'RemainingMeasurementIssues':unresolved
})
save('developer/reports/data-health-identity-review-v6.81.json',{
 'Version':VER,'GroupCount':len(families),'Groups':families,'OpenManualIdentityGroups':['CHBB-34','MRTR-38']
})
save('developer/reports/data-health-measurement-conflicts-v6.81.json',{'Version':VER,'ConflictCount':len(unresolved),'Conflicts':unresolved})

# Manifest
manifest=load('data/data-manifest.json')
manifest['Release']='v'+VER
manifest['release']='v6.81.0-identity-and-canonical-storage-consolidation'
manifest['lastUpdated']=TODAY; manifest['LastUpdated']=TODAY
manifest['phase']='Model identity and canonical storage consolidation'
manifest['notes']='v6.81.0 resolves overlapping model identities into explicit non-destructive families, removes ambiguous per-model alias collisions, retires parallel legacy measurement/year fields from canonical boatmodels storage, and preserves those values in a developer archive. Runtime compatibility is synthesized from canonical data.'
managed=manifest.get('managed',[])
if not any((x.get('path') if isinstance(x,dict) else x)=='data/model-families.json' for x in managed):
 managed.insert(9,{'path':'data/model-families.json','role':'Explicit identity-family relationships for variants, generations, renamed hulls and historically ambiguous model designations.'})
manifest['managed']=managed
save('data/data-manifest.json',manifest)

# Version badges
idx=(ROOT/'index.html').read_text(encoding='utf-8').replace('v6.80.0','v6.81.0').replace('Version 6.80.0','Version 6.81.0')
(ROOT/'index.html').write_text(idx,encoding='utf-8')

print(json.dumps({'families':len(families),'removedAliases':len(removed_aliases),'resolvedMeasurements':len(resolved),'unresolvedMeasurements':len(unresolved),'archivedLegacyRecords':len(archive)},indent=2))
