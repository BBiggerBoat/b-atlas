#!/usr/bin/env python3
import json, pathlib, collections, copy
ROOT=pathlib.Path(__file__).resolve().parents[1]
P=ROOT/'boatmodels.json'
models=json.load(open(P,encoding='utf-8'))
changes=[]

def set_if_blank(m, field, value, source):
    if value is None: return
    if m.get(field) not in (None,''): return
    m[field]=value
    changes.append({'BoatModelID':m.get('BoatModelID'),'field':field,'value':value,'source':source})

# 1) StyleCode: registry defines this as normalized text with legacy NormalizedStyle/Style.
for m in models:
    src=m.get('NormalizedStyle') or m.get('Style')
    if src: set_if_blank(m,'StyleCode',src,'NormalizedStyle' if m.get('NormalizedStyle') else 'Style')

# 2) CoolingCode: exact semantic normalization.
def cooling_code(v):
    if v is None: return None
    s=str(v).strip().lower()
    if s in {'fresh water','fresh-water-cooled diesel'}: return 'cooling.fresh_water'
    if s=='raw water': return 'cooling.raw_water'
    if s=='fresh/raw': return 'cooling.fresh_raw'
    if s in {'outboard','raw-water-cooled outboard','raw outboard'}: return 'cooling.outboard'
    return None
for m in models:
    set_if_blank(m,'CoolingCode',cooling_code(m.get('Cooling')),'Cooling')

# 3) FlybridgeCode: direct categorical normalization.
fly={'yes':'availability.yes','no':'availability.no','optional':'availability.optional','varies':'availability.varies','varies by factory configuration':'availability.varies'}
for m in models:
    v=m.get('Flybridge')
    if v is not None: set_if_blank(m,'FlybridgeCode',fly.get(str(v).strip().lower()),'Flybridge')

# 4) SideDecksCode: conservative, explicit mappings only.
side={
 'wide':'side_decks.wide','wide covered':'side_decks.wide','wide walkaround':'side_decks.wide',
 'moderate':'side_decks.moderate','medium':'side_decks.moderate',
 'narrow':'side_decks.narrow','asymmetric':'side_decks.asymmetric','no':'side_decks.none',
 'narrow to moderate':'side_decks.varies','yes on standard cruiser; verify other variants':'side_decks.varies'
}
for m in models:
    v=m.get('SideDecks')
    if v is not None: set_if_blank(m,'SideDecksCode',side.get(str(v).strip().lower()),'SideDecks')

# 5) KeelConfigurationCode: fill only when the same exact KeelType already maps unanimously
# across >=2 existing coded records. This leverages internal precedent without guessing.
precedent=collections.defaultdict(list)
for m in models:
    kt=m.get('KeelType'); kc=m.get('KeelConfigurationCode')
    if kt and kc: precedent[str(kt).strip()].append(kc)
consensus={k:vals[0] for k,vals in precedent.items() if len(vals)>=2 and len(set(vals))==1}
# Exclude generic/verification labels even if they accidentally have precedent.
for bad in list(consensus):
    low=bad.lower()
    if 'verify' in low or 'model-specific' in low or 'varies' in low:
        consensus.pop(bad,None)
for m in models:
    kt=m.get('KeelType')
    if kt: set_if_blank(m,'KeelConfigurationCode',consensus.get(str(kt).strip()),'KeelType consensus')

json.dump(models,open(P,'w',encoding='utf-8'),indent=2,ensure_ascii=False); open(P,'a').write('\n')
report={
 'release':'v6.85.0','changeCount':len(changes),
 'byField':dict(collections.Counter(c['field'] for c in changes)),
 'changes':changes,
 'notes':[
  'Mappings use existing values in the same canonical boatmodels.json record; no external research was introduced.',
  'ShowerTypeCode blanks were not normalized from Shower because the legacy Shower field is internally inconsistent.',
  'KeelConfigurationCode was filled only from unanimous exact-text precedent with at least two already-coded records.',
  'Ambiguous SideDecks descriptions were intentionally left blank.'
 ]
}
json.dump(report,open(ROOT/'data/canonical-normalization-report-v6.85.json','w',encoding='utf-8'),indent=2,ensure_ascii=False); open(ROOT/'data/canonical-normalization-report-v6.85.json','a').write('\n')
print(json.dumps(report['byField'],indent=2)); print('total',len(changes))
