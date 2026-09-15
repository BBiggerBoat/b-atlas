import json, os, re, html, shutil
from pathlib import Path
from datetime import date
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://b-atlas.org/'
TODAY = date.today().isoformat()
models = json.loads((ROOT/'boatmodels.json').read_text(encoding='utf-8'))

# Runtime-equivalent canonical compatibility for generated public pages.
# Canonical SI/code fields win when known; legacy fields remain fallbacks.
FT_PER_M = 3.280839895013123
LB_PER_KG = 2.2046226218487757
ENUM_LABELS = {
    'fuel.diesel':'Diesel','fuel.gasoline':'Gasoline','fuel.mixed':'Mixed Diesel/Gasoline',
    'mechanical_propulsion.shaft':'Shaft','mechanical_propulsion.v_drive':'Shaft/V-Drive',
    'mechanical_propulsion.sterndrive':'Sterndrive','mechanical_propulsion.stern_drive':'Sterndrive',
    'mechanical_propulsion.outboard':'Outboard','mechanical_propulsion.pod':'Pod',
    'hull_behaviour.displacement':'Displacement','hull_behaviour.semi_displacement':'Semi-Displacement','hull_behaviour.planing':'Planing'
}
for m in models:
    for canon,legacy,factor in [('LOA','LOA_ft',FT_PER_M),('Beam','Beam_ft',FT_PER_M),('Draft','Draft_ft',FT_PER_M),('AirDraft','AirDraft_ft',FT_PER_M),('Displacement','Displacement_lb',LB_PER_KG)]:
        if isinstance(m.get(canon),(int,float)):
            m[legacy]=m[canon]*factor
    if m.get('FuelCode'): m['NormalizedFuel']=ENUM_LABELS.get(m['FuelCode'], str(m['FuelCode']).split('.')[-1].replace('_',' ').title())
    if m.get('MechanicalPropulsionCode'): m['NormalizedPropulsion']=ENUM_LABELS.get(m['MechanicalPropulsionCode'], str(m['MechanicalPropulsionCode']).split('.')[-1].replace('_',' ').title())
    if m.get('HullBehaviourCode'): m['HullBehaviour']=ENUM_LABELS.get(m['HullBehaviourCode'], str(m['HullBehaviourCode']).split('.')[-1].replace('_',' ').title())
    if m.get('BoatFamilyCode'): m['BoatFamily']=str(m['BoatFamilyCode']).split('.')[-1].replace('_',' ').title()


def slugify(s):
    s = str(s or '').lower().strip()
    s = s.replace('&',' and ')
    s = re.sub(r"['’]", '', s)
    s = re.sub(r'[^a-z0-9]+','-',s).strip('-')
    return s or 'item'

def name(m):
    parts=[m.get('Manufacturer',''),m.get('Model',''),m.get('Variant','')]
    return ' '.join(str(x).strip() for x in parts if str(x or '').strip())

def model_slug(m):
    return str(m.get('CanonicalSlug') or '').strip() or slugify(name(m))

def num(m,*keys):
    for k in keys:
        v=m.get(k)
        if isinstance(v,(int,float)): return float(v)
        try:
            if v not in (None,''): return float(v)
        except Exception: pass
    return None

def text(m,*keys):
    for k in keys:
        v=m.get(k)
        if v not in (None,''): return str(v)
    return ''

def year_text(m):
    a=m.get('YearStart') or m.get('FirstYear')
    b=m.get('YearEnd') or m.get('LastYear')
    if a and b and str(a)!=str(b): return f'{a}–{b}'
    if a and b: return str(a)
    if a: return f'From {a}'
    return 'Production years not confirmed'

def esc(s): return html.escape(str(s or ''), quote=True)
def trunc(s,n=160):
    s=' '.join(str(s or '').split())
    return s if len(s)<=n else s[:n-1].rsplit(' ',1)[0]+'…'

def fmt(v, suffix=''):
    if v is None: return 'Unknown'
    if abs(v-round(v))<1e-8: return f'{int(round(v))}{suffix}'
    return f'{v:.2f}'.rstrip('0').rstrip('.')+suffix


def fmt_length_dual(m, canonical_key, *legacy_ft_keys):
    metres=None
    v=m.get(canonical_key)
    if isinstance(v,(int,float)):
        metres=float(v)
    elif v not in (None,''):
        try: metres=float(v)
        except Exception: metres=None
    if metres is None:
        for key in legacy_ft_keys:
            raw=m.get(key)
            try:
                if raw not in (None,''):
                    metres=float(raw)/FT_PER_M; break
            except Exception: pass
    if metres is None: return 'Unknown'
    total_inches=round(metres*FT_PER_M*12)
    feet=total_inches//12; inches=total_inches%12
    imp=f"{feet}′" + (f" {inches}″" if inches else '')
    metric=f"{metres:.2f}".rstrip('0').rstrip('.')+' m'
    return f"{imp} / {metric}"


def fmt_cruise(m, speed_key, burn_key):
    speed=num(m,speed_key); burn=num(m,burn_key)
    if speed is None and burn is None: return 'Unknown'
    parts=[]
    if speed is not None: parts.append(f"{speed:.1f}".rstrip('0').rstrip('.')+' kn')
    if burn is not None:
        usg=burn/3.785411784
        parts.append(f"{usg:.2f} US gal/h / {burn:.2f} L/h")
    if speed is not None and burn is not None and speed>0 and burn>0:
        nm_usg=speed/(burn/3.785411784); l_nm=burn/speed
        parts.append(f"{nm_usg:.2f} nm/US gal / {l_nm:.2f} L/nm")
    return ' · '.join(parts)

def bool_yes(v): return v is True or str(v).strip().lower() in ('yes','true','1')
def diesel(m): return 'diesel' in text(m,'NormalizedFuel','Fuel').lower()
def shaft(m): return 'shaft' in text(m,'NormalizedPropulsion','Propulsion').lower()
def single(m):
    if m.get('EngineCount') == 1: return True
    return 'single' in text(m,'EngineConfiguration').lower()
def twin(m):
    if m.get('EngineCount') == 2: return True
    return 'twin' in text(m,'EngineConfiguration').lower()
def trawler(m): return 'trawler' in text(m,'BoatFamily','NormalizedStyle','Style').lower()
def pilothouse(m): return any(x in text(m,'Configuration','Style','Variant','NormalizedStyle').lower() for x in ('pilothouse','pilot'))
def flybridge(m): return bool_yes(m.get('Flybridge')) or 'flybridge' in text(m,'Variant','Configuration','Style').lower()
def trailerable(m): return bool_yes(m.get('Trailerable')) or any(str(x).lower()=='trailerable' for x in (m.get('Features') or []))
def displacement(m):
    s=text(m,'HullBehaviour','NormalizedHullType','HullType').lower()
    return 'displacement' in s and 'semi' not in s
def semidisplacement(m): return 'semi' in text(m,'HullBehaviour','NormalizedHullType','HullType').lower()

# Preserve v6.23.2 model URLs where possible by reading existing pages.
id_to_slug={}
models_dir=ROOT/'models'
if models_dir.exists():
    for p in models_dir.glob('*/index.html'):
        mt=re.search(r'\?model=([^"&]+)', p.read_text(encoding='utf-8', errors='ignore'))
        if mt: id_to_slug[mt.group(1)] = p.parent.name
for m in models:
    id_to_slug.setdefault(m.get('BoatModelID'), model_slug(m))
# Prevent two canonical identities from overwriting the same generated page after an identity split.
used_slugs={}
for m in models:
    mid=m.get('BoatModelID'); slug=id_to_slug[mid]
    if slug in used_slugs and used_slugs[slug] != mid:
        id_to_slug[mid]=f'{slug}-{str(mid).lower()}'
    used_slugs[id_to_slug[mid]]=mid

model_by_id={m.get('BoatModelID'):m for m in models}

STYLE='''
:root{font-family:Arial,Helvetica,sans-serif;color:#16202a;background:#f5f7f8}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:1080px;margin:auto;padding:20px}header{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}a{color:#174e70}.brand{font-weight:800;text-decoration:none;color:#16202a;font-size:1.25rem}.hero,section,.card{background:#fff;border:1px solid #dce2e5;border-radius:12px}.hero{padding:24px;margin-bottom:18px}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.75rem;color:#5c6973}h1{margin:.2rem 0 .5rem;font-size:clamp(2rem,4vw,3.1rem);line-height:1.06}h2{margin:.2rem 0 .8rem}h3{margin:.1rem 0 .4rem}p,li{line-height:1.55}.muted,.note{color:#626d75}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.card{padding:15px}.card a{font-weight:700}.specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin:16px 0}.specs div{background:#fff;border:1px solid #dce2e5;border-radius:9px;padding:11px}dt{font-size:.77rem;color:#65717a}dd{margin:4px 0 0;font-weight:650}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.chip{display:inline-block;background:#eef3f5;border:1px solid #d8e1e5;border-radius:999px;padding:6px 10px;text-decoration:none;font-size:.9rem}.cta{display:inline-block;background:#143f56;color:#fff;text-decoration:none;padding:10px 15px;border-radius:8px;font-weight:700}section{padding:18px 22px;margin:16px 0}.compare{width:100%;border-collapse:collapse}.compare th,.compare td{text-align:left;padding:9px;border-bottom:1px solid #e2e7e9;vertical-align:top}.compare th:first-child{width:24%}.crumbs{font-size:.9rem;color:#65717a}.hero-img{max-width:360px;width:100%;max-height:260px;object-fit:cover;border-radius:10px}.hero-model{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(220px,.7fr);gap:22px}.model-list{columns:2;column-gap:28px}.model-list li{break-inside:avoid;margin:.45rem 0}footer{font-size:.9rem;color:#65717a}@media(max-width:700px){.hero-model{grid-template-columns:1fr}.model-list{columns:1}.compare{font-size:.9rem}}
'''

def head(title, desc, url, about=None, image=None):
    ld={"@context":"https://schema.org","@type":"WebPage","name":title,"url":url,"description":desc,"isPartOf":{"@type":"WebSite","name":"B-Atlas","url":BASE}}
    if about: ld['about']={"@type":"Thing","name":about}
    image_meta = f'<meta property="og:image" content="{esc(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{esc(image)}">' if image else '<meta name="twitter:card" content="summary">'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><meta name="robots" content="index, follow"><link rel="canonical" href="{esc(url)}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:type" content="article"><meta property="og:url" content="{esc(url)}">{image_meta}<meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(desc)}"><script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script><style>{STYLE}</style></head><body>'''

def shell_open(crumb=''):
    return f'<header><a class="brand" href="../../">B-Atlas</a><nav><a href="../../">Home</a> · <a href="../../#find-your-boat">Find Your Boat</a> · <a href="../../models/">Boat Models</a> · <a href="../../#saved-models">Saved Models</a> · <a href="../../#help-build-b-atlas">Help Build B-Atlas</a> · <a href="../../#about">About</a></nav></header><main>{crumb}'
def shell_close():
    return '</main><footer><a href="../../">B-Atlas — Boat knowledge for better decisions</a></footer></body></html>'

def model_link(m, prefix='../../models/'):
    return f'{prefix}{id_to_slug[m.get("BoatModelID")]}/'

# --- Search-oriented landing page definitions ---
criteria_defs=[
 ('diesel-trawlers-under-32-feet','Diesel Trawlers Under 32 Feet','Known-length trawler models at 32 feet or less with diesel fuel. Useful for buyers balancing trawler character, compact slips and fuel economy.', lambda m: diesel(m) and trawler(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=32),
 ('diesel-trawlers-under-35-feet','Diesel Trawlers Under 35 Feet','Known-length trawler models at 35 feet or less with diesel fuel, with dimensions and buyer-guide links for comparison.', lambda m: diesel(m) and trawler(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=35),
 ('boats-under-10-feet-beam','Boats Under 10 Feet Beam','Boat models with a known beam of 10 feet or less. A practical starting point where slip width, locks, storage or transport width matter.', lambda m: num(m,'BeamFt','Beam_ft') is not None and num(m,'BeamFt','Beam_ft')<=10),
 ('boats-under-10-6-beam','Boats Under 10 ft 6 in Beam','Boat models with a known beam of 10 feet 6 inches or less, organized for buyers working around marina, lock or storage constraints.', lambda m: num(m,'BeamFt','Beam_ft') is not None and num(m,'BeamFt','Beam_ft')<=10.5),
 ('boats-under-11-feet-beam','Boats Under 11 Feet Beam','Boat models with a known beam of 11 feet or less, with model dimensions and research links.', lambda m: num(m,'BeamFt','Beam_ft') is not None and num(m,'BeamFt','Beam_ft')<=11),
 ('boats-under-12-feet-beam','Boats Under 12 Feet Beam','Boat models with a known beam of 12 feet or less. Use this as a broad shortlist, then verify the individual hull and marina limits.', lambda m: num(m,'BeamFt','Beam_ft') is not None and num(m,'BeamFt','Beam_ft')<=12),
 ('single-diesel-shaft-boats-under-32-feet','Single Diesel Shaft Boats Under 32 Feet','Known models at 32 feet or less combining diesel fuel, a single engine and shaft propulsion.', lambda m: diesel(m) and shaft(m) and single(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=32),
 ('single-diesel-shaft-boats-under-35-feet','Single Diesel Shaft Boats Under 35 Feet','Known models at 35 feet or less combining diesel fuel, a single engine and shaft propulsion.', lambda m: diesel(m) and shaft(m) and single(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=35),
 ('great-loop-boats-under-32-feet','Great Loop Boats Under 32 Feet','Models currently marked by B-Atlas as Great Loop suitable and 32 feet or less where length is known.', lambda m: bool_yes(m.get('GreatLoopSuitable')) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=32),
 ('great-loop-boats-under-35-feet','Great Loop Boats Under 35 Feet','Models currently marked by B-Atlas as Great Loop suitable and 35 feet or less where length is known.', lambda m: bool_yes(m.get('GreatLoopSuitable')) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=35),
 ('trailerable-cruising-boats','Trailerable Cruising Boats','Boat models explicitly recorded as trailerable, with dimensions and model guides. Verify legal towing limits and actual rigged dimensions independently.', trailerable),
 ('diesel-boats-under-30-feet','Diesel Boats Under 30 Feet','Known-length diesel boat models at 30 feet or less, spanning compact cruisers, tugs and trawlers.', lambda m: diesel(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=30),
 ('trawlers-under-30-feet','Trawlers Under 30 Feet','Known-length trawler models under 30 feet for buyers seeking compact trawler-style cruising.', lambda m: trawler(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<30),
 ('trawlers-30-to-35-feet','Trawlers 30 to 35 Feet','Trawler models with known lengths from 30 through 35 feet, with buyer-guide links and core dimensions.', lambda m: trawler(m) and num(m,'LengthFt','LOA_ft') is not None and 30<=num(m,'LengthFt','LOA_ft')<=35),
 ('semi-displacement-diesel-boats-under-35-feet','Semi-Displacement Diesel Boats Under 35 Feet','Known-length diesel models at 35 feet or less recorded with semi-displacement hull behaviour.', lambda m: diesel(m) and semidisplacement(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=35),
 ('displacement-diesel-boats-under-35-feet','Displacement Diesel Boats Under 35 Feet','Known-length diesel models at 35 feet or less recorded with displacement hull behaviour.', lambda m: diesel(m) and displacement(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=35),
 ('flybridge-boats-under-35-feet','Flybridge Boats Under 35 Feet','Known-length flybridge models at 35 feet or less, useful for buyers wanting elevated visibility without moving into larger yachts.', lambda m: flybridge(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=35),
 ('single-engine-trawlers','Single-Engine Trawlers','Trawler models recorded with a single engine. Individual boats can differ by year or repower, so verify the actual installation.', lambda m: trawler(m) and single(m)),
 ('twin-engine-trawlers','Twin-Engine Trawlers','Trawler models recorded with twin engines. Individual boats can differ by year or repower, so verify the actual installation.', lambda m: trawler(m) and twin(m)),
 ('shallow-draft-boats-under-3-feet','Shallow-Draft Boats Under 3 Feet','Boat models with a known draft under 3 feet, useful where shoal water, canals or launch access are important constraints.', lambda m: num(m,'DraftFt','Draft_ft') is not None and num(m,'DraftFt','Draft_ft')<3),
 ('pilothouse-boats-under-32-feet','Pilothouse Boats Under 32 Feet','Known-length pilothouse and pilot-style models at 32 feet or less, combining weather protection with compact dimensions.', lambda m: pilothouse(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=32),
 ('diesel-cruisers-under-32-feet','Diesel Cruisers Under 32 Feet','Known-length diesel-powered cruising boats at 32 feet or less, with dimensions and buyer-guide links.', lambda m: diesel(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=32),
 ('shaft-drive-boats-under-32-feet','Shaft-Drive Boats Under 32 Feet','Known-length shaft-drive models at 32 feet or less, spanning trawlers, cruisers and tugs.', lambda m: shaft(m) and num(m,'LengthFt','LOA_ft') is not None and num(m,'LengthFt','LOA_ft')<=32),
]

# Comparison pairs: deliberately limited to useful, closely related buyer choices rather than generating every possible pair.
pairs=[
 ('GRBK-32-CL','MNSH-34-MK1'),('GRBK-32-CL','NDTG-32'),('CAMA-31-TR','NDTG-32'),('CAMA-31-TR','RNGR-R-31'),
 ('CPDR-28-CR','ALBN-27-FC'),('CHLY-28','GRBK-32-CL'),('WILL-30-VO','GRBK-32-CL'),('MNSH-34-MK1','BAYL-3288-MO'),
 ('ALBN-27-FC','ROSB-246-LS'),('MNSH-350-TR','NDTG-34'),('GRBK-36-CL','DEFE-34-TR'),('NDTG-26','RNGR-25-CLASSIC'),
 ('MNSH-34-MK2','GRBK-32-CL'),('CPDR-30-FB','CHLY-28'),('CAMA-28-GN','WILL-30-VO')
]
pairs=[p for p in pairs if p[0] in model_by_id and p[1] in model_by_id]

# Rebuild directories we own.
for dirname in ('manufacturers','boats','compare'):
    d=ROOT/dirname
    if d.exists(): shutil.rmtree(d)
    d.mkdir(parents=True)

# Manufacturers with at least two models: enough substance to be a useful destination.
by_man=defaultdict(list)
for m in models: by_man[m.get('Manufacturer','Unknown')].append(m)
manufacturer_slugs={man:slugify(man) for man,ms in by_man.items() if man and len(ms)>=2}

for man,ms in sorted(by_man.items()):
    if man not in manufacturer_slugs: continue
    slug=manufacturer_slugs[man]; d=ROOT/'manufacturers'/slug; d.mkdir(parents=True)
    ms=sorted(ms,key=lambda m:(num(m,'LengthFt','LOA_ft') or 999,name(m)))
    lengths=[num(m,'LengthFt','LOA_ft') for m in ms if num(m,'LengthFt','LOA_ft') is not None]
    fuels=Counter(text(m,'NormalizedFuel','Fuel') for m in ms if text(m,'NormalizedFuel','Fuel'))
    families=Counter(text(m,'BoatFamily','NormalizedStyle','Style') for m in ms if text(m,'BoatFamily','NormalizedStyle','Style'))
    range_txt=f'{fmt(min(lengths)," ft")} to {fmt(max(lengths)," ft")}' if lengths else 'multiple sizes'
    lead=f'B-Atlas currently covers {len(ms)} {man} models spanning {range_txt}. This page organizes the models in the current database; it does not imply a complete factory production catalogue.'
    desc=trunc(f'{man} boat models in B-Atlas: {len(ms)} model guides with dimensions, propulsion, hull information, inspection focus and buyer research.')
    title=f'{man} Boats: Models, Specs & Buyer Guides | B-Atlas'
    url=f'{BASE}manufacturers/{slug}/'
    cards=''.join(f'<div class="card"><a href="../../models/{id_to_slug[m.get("BoatModelID")]}/">{esc(name(m))}</a><p class="muted">{esc(year_text(m))} · {esc(fmt(num(m,"LengthFt","LOA_ft")," ft"))} · beam {esc(fmt(num(m,"BeamFt","Beam_ft")," ft"))}</p><p>{esc(trunc(m.get("Overview") or m.get("ModelCharacter") or "Open the model guide for current B-Atlas research.",180))}</p></div>' for m in ms)
    chips=''.join(f'<span class="chip">{esc(k)}: {v}</span>' for k,v in (families.most_common(3)+fuels.most_common(2)))
    body=head(title,desc,url,man)+shell_open(f'<p class="crumbs"><a href="../../">Home</a> › <a href="../">Manufacturers</a> › {esc(man)}</p>')+f'<div class="hero"><div class="eyebrow">Manufacturer model directory</div><h1>{esc(man)} boat models</h1><p>{esc(lead)}</p><div class="chips">{chips}</div></div><section><h2>Models covered by B-Atlas</h2><div class="grid">{cards}</div></section><section><h2>How to use this page</h2><p>Open a model guide to compare dimensions, hull behaviour, propulsion, trade-offs and inspection focus. B-Atlas preserves uncertainty: a missing value is not treated as evidence that a boat fails a requirement.</p></section>'+shell_close()
    (d/'index.html').write_text(body,encoding='utf-8')

# Manufacturer index
man_cards=[]
for man,slug in sorted(manufacturer_slugs.items()):
    ms=by_man[man]; lens=[num(m,'LengthFt','LOA_ft') for m in ms if num(m,'LengthFt','LOA_ft') is not None]
    r=f'{fmt(min(lens)," ft")}–{fmt(max(lens)," ft")}' if lens else 'size data varies'
    man_cards.append(f'<div class="card"><a href="{slug}/">{esc(man)}</a><p>{len(ms)} model guides · {esc(r)}</p></div>')
url=BASE+'manufacturers/'; title='Boat Manufacturers and Model Guides | B-Atlas'; desc='Browse boat manufacturers covered by B-Atlas and open model-specific specs, buyer guides and inspection research.'
(ROOT/'manufacturers'/'index.html').write_text(head(title,desc,url)+shell_open('<p class="crumbs"><a href="../">Home</a> › Manufacturers</p>').replace('../../','../')+f'<div class="hero"><div class="eyebrow">B-Atlas research directory</div><h1>Boat manufacturers</h1><p>Browse manufacturers with multiple models currently covered in the B-Atlas database.</p></div><div class="grid">{"".join(man_cards)}</div>'+shell_close().replace('../../','../'),encoding='utf-8')

# Criteria landing pages
criteria_matches={}
for slug,title0,desc0,pred in criteria_defs:
    ms=[m for m in models if pred(m)]
    ms=sorted(ms,key=lambda m:(num(m,'LengthFt','LOA_ft') or 999,num(m,'BeamFt','Beam_ft') or 999,name(m)))
    criteria_matches[slug]=set(m.get('BoatModelID') for m in ms)
    d=ROOT/'boats'/slug; d.mkdir(parents=True)
    url=f'{BASE}boats/{slug}/'; title=f'{title0}: Models & Buyer Guides | B-Atlas'; desc=trunc(f'{desc0} B-Atlas currently has {len(ms)} known matches.')
    cards=''.join(f'<div class="card"><a href="../../models/{id_to_slug[m.get("BoatModelID")]}/">{esc(name(m))}</a><p class="muted">Length {esc(fmt(num(m,"LengthFt","LOA_ft")," ft"))} · Beam {esc(fmt(num(m,"BeamFt","Beam_ft")," ft"))} · Draft {esc(fmt(num(m,"DraftFt","Draft_ft")," ft"))}</p><p>{esc(text(m,"NormalizedFuel","Fuel") or "Fuel unknown")} · {esc(text(m,"HullBehaviour","NormalizedHullType","HullType") or "Hull behaviour unknown")} · {esc(text(m,"NormalizedPropulsion","Propulsion") or "Propulsion unknown")}</p></div>' for m in ms)
    body=head(title,desc,url,title0)+shell_open(f'<p class="crumbs"><a href="../../">Home</a> › <a href="../">Find by Criteria</a> › {esc(title0)}</p>')+f'<div class="hero"><div class="eyebrow">Buyer constraint guide</div><h1>{esc(title0)}</h1><p>{esc(desc0)}</p><p><strong>{len(ms)} models currently have known data that matches this filter.</strong></p></div><section><h2>Matching boat models</h2><div class="grid">{cards}</div></section><section><h2>About these matches</h2><p>This is a conservative, data-driven list. Models are included only when the required fields are known and satisfy the stated constraint. Missing values are not treated as a reason to reject a model elsewhere in B-Atlas; they simply cannot be asserted as a match on this specific landing page. Verify dimensions and configuration on the individual boat.</p><p><a class="cta" href="../../#plan">Build your own B-Atlas Plan</a></p></section>'+shell_close()
    (d/'index.html').write_text(body,encoding='utf-8')

# Criteria index
cards=''.join(f'<div class="card"><a href="{slug}/">{esc(title0)}</a><p>{len(criteria_matches[slug])} known matches</p><p>{esc(trunc(desc0,150))}</p></div>' for slug,title0,desc0,_ in criteria_defs)
url=BASE+'boats/'; title='Find Boats by Size, Beam, Fuel and Configuration | B-Atlas'; desc='Browse boat-model shortlists by practical buyer constraints including length, beam, diesel, shaft drive, trawler style, draft and Great Loop suitability.'
(ROOT/'boats'/'index.html').write_text(head(title,desc,url)+shell_open('<p class="crumbs"><a href="../">Home</a> › Find by Criteria</p>').replace('../../','../')+f'<div class="hero"><div class="eyebrow">Buyer-first boat discovery</div><h1>Find boats by practical constraints</h1><p>Start with a real ownership or cruising constraint, then open the model guides that are known to fit it.</p></div><div class="grid">{cards}</div>'+shell_close().replace('../../','../'),encoding='utf-8')

# Comparison pages
comparison_links=defaultdict(list)
def difference_summary(a,b):
    bits=[]
    la,lb=num(a,'LengthFt','LOA_ft'),num(b,'LengthFt','LOA_ft')
    ba,bb=num(a,'BeamFt','Beam_ft'),num(b,'BeamFt','Beam_ft')
    if la is not None and lb is not None:
        if abs(la-lb)<.25: bits.append('Their recorded lengths are very similar.')
        else: bits.append(f'{name(a) if la<lb else name(b)} is the shorter model by about {abs(la-lb):.1f} ft.')
    if ba is not None and bb is not None:
        if abs(ba-bb)>=.25: bits.append(f'{name(a) if ba<bb else name(b)} has the narrower recorded beam by about {abs(ba-bb):.1f} ft.')
    fa,fb=text(a,'NormalizedFuel','Fuel'),text(b,'NormalizedFuel','Fuel')
    if fa and fb and fa!=fb: bits.append(f'Fuel differs: {name(a)} is recorded as {fa}, while {name(b)} is recorded as {fb}.')
    pa,pb=text(a,'NormalizedPropulsion','Propulsion'),text(b,'NormalizedPropulsion','Propulsion')
    if pa and pb and pa!=pb: bits.append(f'Propulsion differs: {pa} versus {pb}.')
    ha,hb=text(a,'HullBehaviour','NormalizedHullType','HullType'),text(b,'HullBehaviour','NormalizedHullType','HullType')
    if ha and hb and ha!=hb: bits.append(f'Hull behaviour is recorded as {ha} versus {hb}.')
    return bits or ['The models occupy a similar buyer space; the better fit depends on individual condition, configuration and your constraints.']

for a_id,b_id in pairs:
    a,b=model_by_id[a_id],model_by_id[b_id]
    slug=f'{id_to_slug[a_id]}-vs-{id_to_slug[b_id]}'
    d=ROOT/'compare'/slug; d.mkdir(parents=True)
    n1,n2=name(a),name(b); url=f'{BASE}compare/{slug}/'
    title=f'{n1} vs {n2}: Specs & Buyer Comparison | B-Atlas'
    desc=trunc(f'Compare {n1} vs {n2}: length, beam, draft, hull behaviour, fuel, propulsion, buyer trade-offs and inspection focus.')
    rows=[]
    for lab,keys,suf in [('Years',(),''),('Length',('LengthFt','LOA_ft'),' ft'),('Beam',('BeamFt','Beam_ft'),' ft'),('Draft',('DraftFt','Draft_ft'),' ft')]:
        if lab=='Years': va,vb=year_text(a),year_text(b)
        else: va,vb=fmt(num(a,*keys),suf),fmt(num(b,*keys),suf)
        rows.append(f'<tr><th>{lab}</th><td>{esc(va)}</td><td>{esc(vb)}</td></tr>')
    for lab,keys in [('Hull behaviour',('HullBehaviour','NormalizedHullType','HullType')),('Fuel',('NormalizedFuel','Fuel')),('Propulsion',('NormalizedPropulsion','Propulsion')),('Engine configuration',('EngineConfiguration',)),('Boat family',('BoatFamily','NormalizedStyle','Style'))]:
        rows.append(f'<tr><th>{lab}</th><td>{esc(text(a,*keys) or "Unknown")}</td><td>{esc(text(b,*keys) or "Unknown")}</td></tr>')
    summary=''.join(f'<li>{esc(x)}</li>' for x in difference_summary(a,b))
    def bullets(m,k):
        v=m.get(k) or []
        if isinstance(v,str): v=[v]
        return ''.join(f'<li>{esc(x)}</li>' for x in v[:5]) or '<li>No model-specific item is currently recorded.</li>'
    body=head(title,desc,url,f'{n1} versus {n2}')+shell_open(f'<p class="crumbs"><a href="../../">Home</a> › <a href="../">Compare</a> › {esc(n1)} vs {esc(n2)}</p>')+f'<div class="hero"><div class="eyebrow">Model comparison</div><h1>{esc(n1)} vs {esc(n2)}</h1><p>Side-by-side B-Atlas model data for two boats a buyer may reasonably cross-shop. Individual boats can differ materially by year, engine, refit and condition.</p></div><section><h2>Key differences</h2><ul>{summary}</ul></section><section><h2>Specifications</h2><table class="compare"><thead><tr><th>Field</th><th><a href="../../models/{id_to_slug[a_id]}/">{esc(n1)}</a></th><th><a href="../../models/{id_to_slug[b_id]}/">{esc(n2)}</a></th></tr></thead><tbody>{"".join(rows)}</tbody></table></section><section><h2>Best for</h2><div class="grid"><div><h3>{esc(n1)}</h3><ul>{bullets(a,"BestFor")}</ul></div><div><h3>{esc(n2)}</h3><ul>{bullets(b,"BestFor")}</ul></div></div></section><section><h2>Trade-offs</h2><div class="grid"><div><h3>{esc(n1)}</h3><ul>{bullets(a,"TradeOffs")}</ul></div><div><h3>{esc(n2)}</h3><ul>{bullets(b,"TradeOffs")}</ul></div></div></section><section><h2>Inspection focus</h2><div class="grid"><div><h3>{esc(n1)}</h3><ul>{bullets(a,"InspectionFocus")}</ul></div><div><h3>{esc(n2)}</h3><ul>{bullets(b,"InspectionFocus")}</ul></div></div><p class="note">This comparison is model-level research, not a substitute for evaluating the specific boat.</p></section><p><a class="cta" href="../../#plan">Use B-Atlas Plan to filter your requirements</a></p>'+shell_close()
    (d/'index.html').write_text(body,encoding='utf-8')
    comparison_links[a_id].append((slug,n2)); comparison_links[b_id].append((slug,n1))

# Comparison index
comp_cards=[]
for a_id,b_id in pairs:
    a,b=model_by_id[a_id],model_by_id[b_id]; slug=f'{id_to_slug[a_id]}-vs-{id_to_slug[b_id]}'
    comp_cards.append(f'<div class="card"><a href="{slug}/">{esc(name(a))} vs {esc(name(b))}</a><p>Specs, buyer trade-offs and inspection focus.</p></div>')
url=BASE+'compare/'; title='Boat Model Comparisons | B-Atlas'; desc='Side-by-side boat model comparisons using B-Atlas dimensions, propulsion, hull behaviour, buyer trade-offs and inspection research.'
(ROOT/'compare'/'index.html').write_text(head(title,desc,url)+shell_open('<p class="crumbs"><a href="../">Home</a> › Compare</p>').replace('../../','../')+f'<div class="hero"><div class="eyebrow">Decision-stage research</div><h1>Boat model comparisons</h1><p>Compare closely related boat choices using the same normalized B-Atlas fields.</p></div><div class="grid">{"".join(comp_cards)}</div>'+shell_close().replace('../../','../'),encoding='utf-8')

# Rebuild model pages with richer search intent and internal linking.
for m in models:
    mid=m.get('BoatModelID'); slug=id_to_slug[mid]; d=ROOT/'models'/slug; d.mkdir(parents=True,exist_ok=True)
    nm=name(m); concerns=m.get('KnownConcerns') or []
    if isinstance(concerns,str): concerns=[concerns]
    title=f'{nm} Specs, Buyer Guide & Inspection | B-Atlas'
    if concerns: title=f'{nm} Specs, Concerns & Buyer Guide | B-Atlas'
    overview=m.get('Overview') or m.get('ModelCharacter') or f'B-Atlas model research for the {nm}.'
    desc=trunc(f'{nm}: specs, dimensions, hull and propulsion data, buyer trade-offs, inspection focus and model-specific concerns where evidence exists.')
    url=f'{BASE}models/{slug}/'
    specs=[]
    for lab,v in [('LOA',fmt_length_dual(m,'LOA','LOA_ft','LengthFt')),('LWL',fmt_length_dual(m,'LWL','LWL_ft')),('Beam',fmt_length_dual(m,'Beam','Beam_ft','BeamFt')),('Draft',fmt_length_dual(m,'Draft','Draft_ft','DraftFt')),('Hull behaviour',text(m,'HullBehaviour','NormalizedHullType','HullType') or 'Unknown'),('Fuel',text(m,'NormalizedFuel','Fuel') or 'Unknown'),('Propulsion',text(m,'NormalizedPropulsion','Propulsion') or 'Unknown'),('Engine configuration',text(m,'EngineConfiguration') or 'Unknown'),('Displacement cruise',fmt_cruise(m,'DisplacementCruiseSpeed','DisplacementCruiseFuelBurn')),('Faster / planing cruise','Not applicable' if text(m,'HullBehaviour','NormalizedHullType','HullType').lower()=='displacement' else fmt_cruise(m,'PlaningCruiseSpeed','PlaningCruiseFuelBurn')),('Boat family',text(m,'BoatFamily','NormalizedStyle','Style') or 'Unknown'),('Construction',text(m,'Construction') or 'Unknown')]:
        specs.append(f'<div><dt>{esc(lab)}</dt><dd>{esc(v)}</dd></div>')
    img=m.get('ImageURL')
    img_html=f'<img class="hero-img" src="../../{esc(img)}" alt="{esc(nm)}" loading="eager">' if img else ''
    def sec(title0,items,empty=None):
        if isinstance(items,str): items=[items]
        items=[x for x in (items or []) if str(x).strip()]
        if not items and not empty: return ''
        content=''.join(f'<li>{esc(x)}</li>' for x in items) if items else f'<li>{esc(empty)}</li>'
        return f'<section><h2>{esc(title0)}</h2><ul>{content}</ul></section>'
    # Related models by same family and nearest length, excluding self.
    ml=num(m,'LengthFt','LOA_ft')
    candidates=[]
    for x in models:
        if x is m: continue
        score=0
        if x.get('Manufacturer')==m.get('Manufacturer'): score-=4
        if text(x,'BoatFamily')==text(m,'BoatFamily') and text(m,'BoatFamily'): score-=2
        xl=num(x,'LengthFt','LOA_ft')
        if ml is not None and xl is not None: score+=abs(ml-xl)/3
        else: score+=4
        candidates.append((score,x))
    related=[x for _,x in sorted(candidates,key=lambda z:(z[0],name(z[1])))[:6]]
    rel_cards=''.join(f'<div class="card"><a href="../{id_to_slug[x.get("BoatModelID")]}/">{esc(name(x))}</a><p class="muted">{esc(fmt(num(x,"LengthFt","LOA_ft")," ft"))} · {esc(text(x,"HullBehaviour","NormalizedHullType","HullType") or "Hull unknown")}</p></div>' for x in related)
    nav=[]
    man=m.get('Manufacturer');
    if man in manufacturer_slugs: nav.append(f'<a class="chip" href="../../manufacturers/{manufacturer_slugs[man]}/">More {esc(man)} models</a>')
    # Link up to three criteria this model satisfies, prioritizing specific pages first.
    for cslug,ctitle,_,_ in criteria_defs:
        if mid in criteria_matches.get(cslug,set()):
            nav.append(f'<a class="chip" href="../../boats/{cslug}/">{esc(ctitle)}</a>')
        if len(nav)>=4: break
    for cslug,other in comparison_links.get(mid,[])[:2]: nav.append(f'<a class="chip" href="../../compare/{cslug}/">Compare with {esc(other)}</a>')
    concern_sec=sec('Known concerns',concerns,'No model-specific concern has been promoted to B-Atlas’s evidence threshold. This does not mean the model has no age-, condition- or hull-specific risks.')
    social_img=(BASE+str(img).lstrip('/')) if img else None
    body=head(title,desc,url,nm,social_img)+shell_open(f'<p class="crumbs"><a href="../../">Home</a> › <a href="../">Model Guides</a> › {esc(nm)}</p>')+f'<article><div class="hero hero-model"><div><div class="eyebrow">B-Atlas Boat Guide · {esc(mid)}</div><h1>{esc(nm)}</h1><p><strong>{esc(year_text(m))}</strong></p><p>{esc(overview)}</p><p><a class="cta" href="../../?model={esc(mid)}">Open full interactive guide</a></p></div>{img_html}</div><dl class="specs">{"".join(specs)}</dl>{sec("Best for",m.get("BestFor") or m.get("Strengths"))}{sec("Trade-offs",m.get("TradeOffs") or m.get("Weaknesses"))}{concern_sec}{sec("Inspection focus",m.get("InspectionFocus") or m.get("CommonProblems"))}<section><h2>Continue researching</h2><div class="chips">{"".join(nav)}</div></section><section><h2>Related boat models</h2><div class="grid">{rel_cards}</div></section><section><h2>About this record</h2><p>B-Atlas preserves uncertainty: missing information remains unknown rather than being treated as a negative. Specifications and guidance describe the model record; individual boats can differ by year, equipment, refit and condition.</p></section></article>'+shell_close()
    (d/'index.html').write_text(body,encoding='utf-8')

# Rebuild models index with manufacturer + buyer entry points.
model_cards=''.join(f'<div class="card"><a href="{id_to_slug[m.get("BoatModelID")]}/">{esc(name(m))}</a><p class="muted">{esc(fmt(num(m,"LengthFt","LOA_ft")," ft"))} · beam {esc(fmt(num(m,"BeamFt","Beam_ft")," ft"))} · {esc(text(m,"NormalizedFuel","Fuel") or "fuel unknown")}</p></div>' for m in sorted(models,key=lambda m:name(m)))
url=BASE+'models/'; title='Boat Model Guides: Specs, Concerns & Buyer Research | B-Atlas'; desc=f'Browse {len(models)} B-Atlas boat model guides with dimensions, propulsion, hull data, buyer trade-offs, inspection focus and evidence-aware concerns.'
(ROOT/'models'/'index.html').write_text(head(title,desc,url)+shell_open('<p class="crumbs"><a href="../">Home</a> › Model Guides</p>').replace('../../','../')+f'<div class="hero"><div class="eyebrow">Permanent boat knowledge</div><h1>Boat model guides</h1><p>{len(models)} model guides currently available. Search by model below, or start with <a href="../boats/">practical buyer constraints</a>, <a href="../manufacturers/">manufacturer</a>, or <a href="../compare/">comparisons</a>.</p></div><div class="grid">{model_cards}</div>'+shell_close().replace('../../','../'),encoding='utf-8')

# Update public footer links/version without adding primary-nav clutter.
idx=ROOT/'index.html'; s=idx.read_text(encoding='utf-8')
s=s.replace('<a href="models/">Browse Model Guides</a>', '<a href="models/">Browse Model Guides</a>\n    <a href="boats/">Find by Criteria</a>\n    <a href="compare/">Compare Models</a>')
pkg=json.loads((ROOT/'package.json').read_text(encoding='utf-8')); release=pkg.get('version',''); s=re.sub(r'Version [0-9]+\.[0-9]+\.[0-9]+[^<]*', f'Version {release}', s)
idx.write_text(s,encoding='utf-8')


# Permanent model URL registry. CanonicalSlug is immutable once published; model renames do not silently change URLs.
permalink_payload={
    'schemaVersion':1,'baseURL':BASE.rstrip('/'),'generated':TODAY,
    'models':[{'BoatModelID':m.get('BoatModelID'),'CanonicalSlug':id_to_slug[m.get('BoatModelID')],'CanonicalPath':f"/models/{id_to_slug[m.get('BoatModelID')]}/",'CanonicalURL':f"{BASE}models/{id_to_slug[m.get('BoatModelID')]}/",'Manufacturer':m.get('Manufacturer'),'Model':m.get('Model'),'Variant':m.get('Variant'),'LegacySlugs':m.get('LegacySlugs',[])} for m in models]
}
(ROOT/'data'/'model-permalinks.json').write_text(json.dumps(permalink_payload,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

# Sitemap: only stable, useful public pages.
urls=[BASE,BASE+'models/',BASE+'manufacturers/',BASE+'boats/',BASE+'compare/']
urls += [f'{BASE}models/{id_to_slug[m.get("BoatModelID")]}/' for m in models]
urls += [f'{BASE}manufacturers/{slug}/' for slug in manufacturer_slugs.values()]
urls += [f'{BASE}boats/{slug}/' for slug,_,_,_ in criteria_defs]
urls += [f'{BASE}compare/{id_to_slug[a]}-vs-{id_to_slug[b]}/' for a,b in pairs]
urls=sorted(dict.fromkeys(urls))
xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in urls: xml += ['  <url>',f'    <loc>{html.escape(u)}</loc>',f'    <lastmod>{TODAY}</lastmod>','  </url>']
xml.append('</urlset>')
(ROOT/'sitemap.xml').write_text('\n'.join(xml)+'\n',encoding='utf-8')

# Report generation summary to stdout only. Historical/maintainability reports live in the separate Development Archive.
report={
 'version':json.loads((ROOT/'package.json').read_text(encoding='utf-8')).get('version',''), 'generated':TODAY, 'model_pages':len(models), 'manufacturer_pages':len(manufacturer_slugs),
 'constraint_pages':len(criteria_defs), 'comparison_pages':len(pairs), 'sitemap_urls':len(urls),
 'principle':'Generate stable, useful pages from canonical model data. Do not generate every possible filter or model pair.'
}

# Package scripts are maintained in package.json; this generator does not rewrite the release version.

print(json.dumps(report,indent=2))
