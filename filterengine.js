(function (global) {
    "use strict";

    function known(value) {
        return value !== undefined && value !== null && value !== "";
    }

    function booleanLike(value, positiveWords) {
        return positiveWords.includes(String(value).trim().toLowerCase());
    }

    function numericValue(value) {
        if (!known(value)) return null;
        if (typeof value === "number") return Number.isFinite(value) ? value : null;
        const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
        if (!match) return null;
        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeText(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }

    function levenshtein(a, b) {
        const left = normalizeText(a), right = normalizeText(b);
        const row = Array.from({ length: right.length + 1 }, (_, i) => i);
        for (let i = 1; i <= left.length; i += 1) {
            let previous = row[0]; row[0] = i;
            for (let j = 1; j <= right.length; j += 1) {
                const saved = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
                previous = saved;
            }
        }
        return row[right.length];
    }

    function searchableText(boat) {
        return [boat.Manufacturer, boat.Model, boat.Variant, boat.Nickname, boat.TypicalEngineID,
            boat.Designer, boat.Style, boat.BoatFamily, boat.Configuration, boat.HullType, boat.Construction, (boat.ModelAliases || []).join(" "), (boat.Features || []).join(" "), boat.TypicalMission, boat.Strengths, boat.Weaknesses,
            boat.CommonProblems, boat.AvoidIf].filter(Boolean).map(normalizeText).join(" ");
    }

    function relevanceScore(boat, query) {
        const q = normalizeText(query);
        if (!q) return 0;
        const manufacturer = normalizeText(boat.Manufacturer);
        const model = normalizeText(boat.Model);
        const title = normalizeText([boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" "));
        const haystack = searchableText(boat);
        if (title === q) return 1000;
        if (title.includes(q)) return 900 - Math.max(0, title.length - q.length);
        const queryTokens = q.split(" ").filter(Boolean);
        const titleTokens = title.split(" ").filter(Boolean);
        let score = haystack.includes(q) ? 700 : 0;
        queryTokens.forEach(token => {
            if (manufacturer === token || model === token) score += 180;
            else if (titleTokens.includes(token)) score += 140;
            else if (haystack.includes(token)) score += 70;
            const bestDistance = titleTokens.reduce((best, candidate) => Math.min(best, levenshtein(token, candidate)), Infinity);
            if (bestDistance === 1) score += 90;
            else if (bestDistance === 2 && token.length >= 4) score += 45;
        });
        return score;
    }


    function featureMatches(boat, feature) {
        const wanted = normalizeText(feature);
        const galley = normalizeText(boat.Galley);
        const keel = normalizeText(boat.KeelType);
        const modelText = searchableText(boat);

        if (wanted === "galley up with helm") {
            if (boat.GalleyUpWithHelm === true || String(boat.GalleyUpWithHelm).toLowerCase() === "true") return true;
            return galley.includes("galley up") || galley.includes("saloon galley") || modelText.includes("galley up");
        }
        if (wanted === "removable flybridge") {
            if (boat.RemovableFlybridge === true || String(boat.RemovableFlybridge).toLowerCase() === "true") return true;
            return modelText.includes("removable flybridge") || modelText.includes("removeable flybridge") ||
                modelText.includes("removable bridge") || modelText.includes("flybridge is removable") ||
                modelText.includes("flybridge can be removed") || modelText.includes("removable upper helm");
        }
        if (wanted === "long keel") {
            const keelCode = String(boat.KeelConfigurationCode || "").trim().toLowerCase();
            const canonicalKeel = normalizeText(boat.KeelConfigurationCode || boat.KeelConfiguration);
            return keelCode === "keel.full_long" || canonicalKeel.includes("full long") || canonicalKeel.includes("long keel") ||
                keel.includes("long keel") || keel.includes("full length keel") || keel.includes("full length");
        }
        if (wanted === "skeg hung rudder") {
            const rudder = normalizeText(boat.RudderTypeCode || boat.RudderType);
            return rudder.includes("skeg hung") || keel.includes("skeg mounted rudder") || keel.includes("skeg hung rudder") ||
                (keel.includes("skeg") && keel.includes("rudder"));
        }
        if (wanted === "walkthrough transom") {
            return boat.WalkthroughTransom === true || String(boat.WalkthroughTransom).toLowerCase() === "true" || modelText.includes("walkthrough transom") || modelText.includes("walk through transom");
        }
        if (wanted === "side helm door") {
            return boat.SideHelmDoor === true || String(boat.SideHelmDoor).toLowerCase() === "true" || modelText.includes("side helm door") || modelText.includes("helm door");
        }
        if (wanted === "separate shower") {
            const showerCode = String(boat.ShowerTypeCode || "").trim().toLowerCase();
            const showerType = normalizeText(boat.ShowerTypeCode || boat.ShowerType);
            return showerCode === "shower.separate_stall" || showerType.includes("separate stall") || normalizeText(boat.Shower).includes("separate") || normalizeText(boat.Shower).includes("stall shower");
        }
        if (wanted === "wide side decks") {
            const sideCode = String(boat.SideDecksCode || "").trim().toLowerCase();
            return sideCode === "side_decks.wide" || normalizeText(boat.SideDecks).includes("wide");
        }
        if (wanted === "aft cabin") {
            if (typeof boat.AftCabin === "boolean") return boat.AftCabin;
            return ["yes","true","aft cabin"].includes(String(boat.AftCabin || "").trim().toLowerCase()) || modelText.includes("aft cabin");
        }

        const values = [
            ...(Array.isArray(boat.Features) ? boat.Features : []),
            boat.Flybridge === "Yes" ? "Flybridge" : "",
            boat.AftCabin === "Yes" ? "Aft Cabin" : "",
            boat.Trailerable === "Yes" ? "Trailerable" : "",
            boat.Shower === "Separate" ? "Separate Shower" : "",
            boat.SideDecks === "Wide" ? "Wide Side Decks" : ""
        ].filter(Boolean).map(normalizeText);
        return values.some(actual => actual === wanted || actual.includes(wanted) || wanted.includes(actual));
    }

    function crewPreferenceResult(boat, key, value) {
        const berths = numericValue(boat.Berths);
        const cabins = numericValue(boat.Cabins);
        if (key === "crewComposition") {
            if (berths === null) return { matched: false, unknown: true };
            if (value === "Solo") return { matched: berths >= 1, unknown: false };
            if (value === "Couple") return { matched: berths >= 2, unknown: false };
            if (value === "TwoCouples") return { matched: berths >= 4 && (cabins === null || cabins >= 2), unknown: cabins === null };
            if (value === "Family") return { matched: berths >= 4, unknown: false };
        }
        if (key === "guestFrequency") {
            if (berths === null) return { matched: false, unknown: true };
            if (value === "Rarely") return { matched: berths >= 2, unknown: false };
            if (value === "Sometimes") return { matched: berths >= 4, unknown: false };
            if (value === "Often") return { matched: berths >= 4 && (cabins === null || cabins >= 2), unknown: cabins === null };
        }
        if (key === "tallestCrewHeight") {
            const canonicalInches = global.BAtlasCanonical?.inches(boat, "Headroom", []);
            const headroom = canonicalInches;
            if (headroom == null) return { matched: false, unknown: true };
            const inches = headroom;
            return { matched: inches >= numericValue(value), unknown: false };
        }
        return { matched: false, unknown: true };
    }

    function preferenceAssessment(boat, profile) {
        const preferences = [];
        const add = (label, weight, matched, unknown) => preferences.push({ label, weight, matched: Boolean(matched), unknown: Boolean(unknown) });

        if (normalizeText(profile?.textSearch)) {
            add(`Search: ${profile.textSearch}`, 2, relevanceScore(boat, profile.textSearch) > 0, false);
        }

        Object.entries(profile?.featurePriorities || {}).forEach(([feature, priority]) => {
            const weight = priority === "Required" ? 3 : priority === "Preferred" ? 2 : 1;
            const fields = {
                'separate shower':['ShowerTypeCode','ShowerType','Shower'], 'wide side decks':['SideDecksCode','SideDecks'],
                'aft cabin':['AftCabin'], 'walkthrough transom':['WalkthroughTransom'], 'side helm door':['SideHelmDoor'],
                'galley up with helm':['GalleyUpWithHelm','Galley'], 'removable flybridge':['RemovableFlybridge'],
                'long keel':['KeelConfigurationCode','KeelConfiguration','KeelType'], 'skeg hung rudder':['RudderTypeCode','RudderType'], 'trailerable':['Trailerable']
            }[normalizeText(feature)] || [];
            const firstField = fields.find(key => Object.prototype.hasOwnProperty.call(boat,key));
            const raw = firstField ? boat[firstField] : null;
            const unknown = raw == null || raw === '' || /unknown|optional|varies|mixed|conflict/i.test(String(raw));
            const matched = !unknown && featureMatches(boat, feature);
            add(feature, weight, matched, unknown);
        });

        if (profile?.crewComposition) {
            const result = crewPreferenceResult(boat, "crewComposition", profile.crewComposition);
            add("Primary Crew", 2, result.matched, result.unknown);
        }
        if (known(profile?.tallestCrewHeight)) {
            const result = crewPreferenceResult(boat, "tallestCrewHeight", profile.tallestCrewHeight);
            add("Tallest Crew", 2, result.matched, result.unknown);
        }
        if (profile?.guestFrequency) {
            const result = crewPreferenceResult(boat, "guestFrequency", profile.guestFrequency);
            add("Overnight Guests", 2, result.matched, result.unknown);
        }

        const total = preferences.length;
        const matches = preferences.filter(item => item.matched).length;
        const unknown = preferences.filter(item => item.unknown).length;
        const totalWeight = preferences.reduce((sum, item) => sum + (item.unknown ? 0 : item.weight), 0);
        const matchedWeight = preferences.reduce((sum, item) => sum + (item.matched ? item.weight : 0), 0);
        const score = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;
        return { score, matches, total, unknown, preferences };
    }

    function featureMatchScore(boat, profile) {
        return preferenceAssessment(boat, profile).score;
    }

    function evaluateBoat(boat, settings, routes, dependencies) {
        const profile = settings || {}, reasons = [];
        const uncertain = value => value == null || String(value).trim() === "" || /^(unknown|not known|not specified|unspecified|unverified|uncertain|no data|n\/a|na|mixed|optional|varies|various)(\b|$)|configuration dependent|conflict|varies by/i.test(String(value).split('.').pop().replace(/_/g,' ').trim());
        const number = value => {
            if (uncertain(value) || typeof value === 'boolean') return null;
            if (typeof value === 'number') return Number.isFinite(value) ? value : null;
            const text = String(value).trim();
            return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
        };
        const comparable = value => String(value).split('.').pop().replace(/_/g,' ');
        const normalize = (domain, value) => global.BScoutValueNormalizer?.normalize(domain, comparable(value)) || normalizeText(comparable(value));
        const selectedCounts = profile.engineCounts?.length ? profile.engineCounts : profile.twinEngines ? [2] : [];
        const specs = [];
        const add = (field, selected, domain, legacy, reason) => {
            if (Array.isArray(selected) && selected.length) specs.push({field,selected,domain,legacy:legacy||[],reason:reason||field});
        };
        add('FuelCode',profile.fuels,'fuel',['NormalizedFuel','Fuel'],'fuel');
        add('MechanicalPropulsionCode',profile.propulsion,'propulsion',['PropulsionCode','NormalizedPropulsion','Propulsion'],'propulsion');
        add('EngineCount',selectedCounts,'number',[],'engine-count');
        add('HullBehaviourCode',profile.hullTypes,'hullType',['HullBehaviour','NormalizedHullForm','HullType'],'hull-type');
        add('HullMaterialCode',profile.constructionMaterials,'construction',['Construction'],'construction-material');
        add('StyleCode',profile.styles,'boatStyle',['NormalizedStyle','Style'],'style');
        add('BoatFamilyCode',profile.boatFamilies,'family',['BoatFamily','NormalizedStyle','Style','Configuration'],'boat-family');
        add('Configuration',profile.configurations,'configuration',[],'configuration');
        add('FlybridgeCode',profile.flybridge?[profile.flybridge]:[],'boolean',['Flybridge'],'flybridge');
        add('SideDecksCode',profile.sideDecks?[profile.sideDecks]:[],'sideDecks',['SideDecks'],'side-decks');
        add('Trailerable',profile.trailerable?[profile.trailerable]:[],'boolean',[],'trailerable');
        add('GreatLoopSuitable',profile.greatLoop?[profile.greatLoop]:[],'boolean',[],'great-loop');
        for (const [field,key,reason] of [['LOA','minLength','min-length'],['Beam','minBeam','min-beam'],['Berths','minimumBerths','minimum-berths'],['Cabins','minimumCabins','minimum-cabins'],['Heads','minimumHeads','minimum-heads']]) {
            if(number(profile[key])!==null) specs.push({field,min:number(profile[key]),dimension:['LOA','Beam'].includes(field),reason});
        }
        for (const [field,key,reason] of [['LOA','maxLength','max-length'],['Beam','maxBeam','max-beam'],['Draft','maxDraft','max-draft'],['AirDraft','maxAirDraft','max-air-draft']]) {
            if(number(profile[key])!==null) specs.push({field,max:number(profile[key]),dimension:true,reason});
        }
        const missingRoutes=[];
        for(const id of profile.routes||[]) {
            const route=(routes||[]).find(r=>String(r.RouteID??r.id).trim().toUpperCase()===String(id).trim().toUpperCase());
            if(!route){missingRoutes.push('Route limits unavailable: '+id);continue;}
            for(const [field,key] of [['LOA','MaxLengthFt'],['Beam','MaxBeamFt'],['Draft','MaxDraftFt'],['AirDraft','MaxAirDraftFt']]) {
                const limit=number(route[key]??route['Route'+key]);
                if(limit!==null) specs.push({field,max:limit,dimension:true,reason:'route-compatibility',route:id});
            }
        }
        const valueOf=(row,spec)=>{
            if(Object.prototype.hasOwnProperty.call(row,spec.field)) return row[spec.field];
            for(const key of spec.legacy||[]) if(!uncertain(row[key])) return row[key];
            return null;
        };
        const category = (spec, raw) => {
            if(uncertain(raw)) return null;
            if(spec.domain==='number') return number(raw);
            const text=normalizeText(comparable(raw));
            if(['fuel','propulsion','hullType','boatStyle','configuration','family'].includes(spec.domain)&&(/\bor\b|\/|,/.test(comparable(raw)))) {
                const mapped=normalize(spec.domain,raw);
                if(!(spec.domain==='propulsion'&&['shaft','stern-drive','pod-drive','jet-drive','outboard'].includes(mapped)))return null;
            }
            if(spec.domain==='construction') {
                const materials=[...new Set((text.match(/fiberglass|fibreglass|frp|grp|steel|aluminum|aluminium|wood/g)||[]).map(v=>normalize('construction',v)))];
                if(materials.length>1)return null;
                if(materials.length===1)return materials[0];
            }
            if(spec.domain==='boolean') return ['yes','true','suitable','trailerable'].includes(text)?'yes':['no','false','unsuitable','not suitable'].includes(text)?'no':null;
            if(spec.domain==='sideDecks') return ['wide','moderate','limited','narrow','none'].includes(text)?text:null;
            return normalize(spec.domain,raw);
        };
        const matches=(spec,actual)=>{
            if(spec.domain==='sideDecks'){
                const allowed={'Wide':['wide'],'Moderate+':['wide','moderate'],'Limited+':['wide','moderate','limited'],'Narrow+':['wide','moderate','limited','narrow'],'None':['none']}[spec.selected[0]];
                return !allowed || allowed.includes(actual);
            }
            return spec.selected.some(v=>{
                const wanted=category(spec,v);
                if(spec.domain==='propulsion'&&wanted==='inboard')return ['inboard','shaft','stern-drive','pod-drive','jet-drive'].includes(actual);
                if(spec.domain==='family'){
                    const a=actual.replace(/sport fishing|sportfishing|sport fisher/g,'sportfisher');
                    const w=String(wanted).replace(/sport fishing|sportfishing|sport fisher/g,'sportfisher');
                    return a===w||a.includes(w);
                }
                return actual===wanted;
            });
        };
        const assess=row=>{
            const failures=[],unknowns=[],conditional=[];
            if(specs.filter(spec=>Array.isArray(valueOf(row,spec))).length>1)unknowns.push('Configuration linkage not documented');
            for(const spec of specs){
                const raw=valueOf(row,spec);
                const confidence=row.SpecificationConfidence?.[spec.field];
                if(String(confidence?.Status).toLowerCase()==='estimated'&&String(confidence?.Level).toLowerCase()==='low') {unknowns.push(spec.reason);continue;}
                if(spec.selected){
                    if(spec.domain==='propulsion'&&normalize('propulsion',raw)==='inboard'&&!spec.selected.some(v=>normalize('propulsion',v)==='inboard')) {
                        if(spec.selected.every(v=>normalize('propulsion',v)==='outboard'))failures.push(spec.reason);
                        else unknowns.push(spec.reason);
                        continue;
                    }
                    // Explicit alternatives may retain a candidate; they never become a definitive scalar.
                    const values=Array.isArray(raw)?raw.length?raw:[null]:[raw], actuals=values.map(v=>category(spec,v));
                    if(actuals.some(v=>v!==null&&matches(spec,v))){if(values.length>1)conditional.push(spec.reason);continue;}
                    if(actuals.some(v=>v===null))unknowns.push(spec.reason);else failures.push(spec.reason);
                } else {
                    const meta=row.SpecificationConfidence?.[spec.field];
                    const estimated=String(meta?.Status).toLowerCase()==='estimated'&&String(meta?.Level).toLowerCase()==='low';
                    let actual=number(raw);if(actual!==null&&spec.dimension)actual/=0.3048;
                    if(actual===null||estimated){unknowns.push(spec.reason);continue;}
                    if((spec.min!==undefined&&actual<spec.min-1e-7)||(spec.max!==undefined&&actual>spec.max+1e-7))failures.push(spec.reason);
                }
            }
            return {passes:!failures.length,failures,unknowns,conditional};
        };
        const phases=Array.isArray(boat.ProductionPhases)?boat.ProductionPhases:[];
        const configs=Array.isArray(boat.VerifiedConfigurations)?boat.VerifiedConfigurations:[];
        const phaseFields=new Set(phases.flatMap(p=>(p.FactOverrides||[]).map(f=>f.FieldID)));
        const phaseRows=phases.length?phases.map(p=>{
            const row={...boat};for(const key of phaseFields)row[key]=null;
            row.SpecificationConfidence={...row.SpecificationConfidence};
            for(const f of p.FactOverrides||[]){
                row[f.FieldID]=f.ValueState==='known'?f.CanonicalValue:null;
                if(f.ValueState==='known'&&String(f.Confidence).toLowerCase()==='high')row.SpecificationConfidence[f.FieldID]={Level:'High',Status:'verified'};
            }
            return {row,phaseID:p.ProductionPhaseID};
        }):[{row:boat,phaseID:null}];
        const configFields=new Set(configs.flatMap(c=>c&&typeof c==='object'?Object.keys(c):[]).filter(k=>specs.some(s=>s.field===k)));
        const overlay=(base,c)=>{const row={...base};for(const key of configFields)row[key]=null;for(const key of configFields)if(c&&Object.prototype.hasOwnProperty.call(c,key))row[key]=c[key];return row;};
        let rows,linkageUnknown=false;
        if(!configs.length)rows=phaseRows.map(p=>p.row);
        else if(!phases.length){
            rows=configs.map(c=>overlay(boat,c));
            if(boat.VerifiedConfigurationsComplete!==true){const rest={...boat};for(const key of configFields)if(uncertain(boat[key]))rest[key]=null;rows.push(rest);}
        }else{
            // Do not invent a Cartesian pairing between independent phase/configuration evidence.
            const scoped=configs.every(c=>c?.ProductionPhaseID&&phases.some(p=>p.ProductionPhaseID===c.ProductionPhaseID));
            if(scoped){
                rows=[];
                for(const p of phaseRows){const options=configs.filter(c=>c.ProductionPhaseID===p.phaseID);rows.push(...options.map(c=>overlay(p.row,c)));if(!options.length||boat.VerifiedConfigurationsComplete!==true)rows.push(p.row);}
            }else{
                const phaseResults=phaseRows.map(p=>{const row={...p.row};for(const key of configFields)row[key]=null;return assess(row);});
                const configBase={...boat};for(const key of phaseFields)configBase[key]=null;
                const configRows=configs.map(c=>overlay(configBase,c));
                if(boat.VerifiedConfigurationsComplete!==true)configRows.push(configBase);
                const configResults=configRows.map(assess);
                if(!phaseResults.some(r=>r.passes)||!configResults.some(r=>r.passes))rows=[];
                else {const unresolved={...boat};for(const key of new Set([...phaseFields,...configFields]))unresolved[key]=null;rows=[unresolved];linkageUnknown=true;}
            }
        }
        const results=rows.map(assess),possible=results.filter(r=>r.passes);
        if(!possible.length){
            const failures=results.flatMap(r=>r.failures);
            reasons.push(...(configs.length?['verified-configuration']:phases.length?['production-configuration']:failures));
            if(!reasons.length)reasons.push('production-configuration');
        }
        if(normalizeText(profile.textSearch)&&relevanceScore(boat,profile.textSearch)<=0)reasons.push('text-search');
        if(dependencies?.passesRouteCompatibility&&!dependencies.passesRouteCompatibility(boat,profile,routes||[]))reasons.push('route-compatibility');
        // A fully known compatible alternative is stronger evidence than an unknown alternative.
        const best=possible.find(r=>!r.unknowns.length)||possible[0];
        const unknowns=[...(best?.unknowns||[]),...missingRoutes];if(linkageUnknown)unknowns.push('Configuration linkage not documented');
        const conditional=!!best&&(best.conditional.length>0||results.some(r=>!r.passes)||(results.length>1&&results.some(r=>r.unknowns.length||r.conditional.length))||linkageUnknown);
        const status=reasons.length?'excluded':unknowns.length?'unknown':conditional?'configuration-dependent':'confirmed';
        const explanation=status==='excluded'?'Known information conflicts with your requirements.':status==='unknown'?'Retained because some required information is unknown.':status==='configuration-dependent'?'A documented configuration fits; verify the boat’s version and equipment.':specs.length?'Confirmed against the selected requirements.':'No exclusion requirements selected.';
        const labels={'fuel':'Fuel type not verified','propulsion':'Drive type not verified','engine-count':'Engine count not verified','hull-type':'Hull behavior not verified','construction-material':'Hull material not verified','style':'Boat style not verified','boat-family':'Boat family not verified','configuration':'Layout not verified','flybridge':'Flybridge availability not verified','side-decks':'Side-deck access not verified','trailerable':'Trailerability not verified','great-loop':'Great Loop suitability not verified','minimum-berths':'Berths not verified','minimum-cabins':'Cabins not verified','minimum-heads':'Heads not verified','min-length':'Length not verified','max-length':'Length not verified','min-beam':'Beam not verified','max-beam':'Beam not verified','max-draft':'Draft not verified','max-air-draft':'Air clearance not verified','route-compatibility':'Route dimensions not verified'};
        return {passes:!reasons.length,reasons:[...new Set(reasons)],relevance:relevanceScore(boat,profile.textSearch),preference:preferenceAssessment(boat,profile),match:{status,explanation,unknowns:[...new Set(unknowns.map(key=>labels[key]||key))],conditional,requirements:specs.length}};
    }

    function filterBoats(boats, settings, routes, dependencies) {
        const source = Array.isArray(boats) ? boats : [];
        const evaluated = source.map((boat, index) => ({ boat, index, result: evaluateBoat(boat, settings, routes, dependencies) }))
            .filter(item => item.result.passes);
        if (settings && (settings.textSearch || Object.keys(settings.featurePriorities || {}).length || settings.crewComposition || settings.tallestCrewHeight || settings.guestFrequency)) {
            evaluated.sort((a, b) => b.result.preference.score - a.result.preference.score || b.result.preference.matches - a.result.preference.matches || b.result.relevance - a.result.relevance || a.index - b.index);
        }
        return evaluated.map(item => item.boat);
    }

    const returnApi = { evaluateBoat, filterBoats, known, numericValue, relevanceScore, levenshtein, featureMatchScore, preferenceAssessment, featureMatches };

    global.BScoutFilterEngine = returnApi;
})(typeof window !== "undefined" ? window : globalThis);
