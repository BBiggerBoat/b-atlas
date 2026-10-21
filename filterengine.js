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
        const scalar = value => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
        const scalarFact = field => /estimated|conflict|variable|uncertain/.test(normalizeText(boat.SpecificationConfidence?.[field]?.Status)) ? null : scalar(boat[field]);
        const crewNeeds = {Solo:[1,0],Couple:[2,0],TwoCouples:[4,2],Family:[4,0]};
        const guestNeeds = {Rarely:[2,0],Sometimes:[4,0],Often:[4,2]};
        const needs = key === 'crewComposition' ? crewNeeds[value] : key === 'guestFrequency' ? guestNeeds[value] : null;
        if(needs) {
            const checks=[{field:'Berths',minimum:needs[0]},...(needs[1]?[{field:'Cabins',minimum:needs[1]}]:[])];
            const failures=checks.filter(c=>scalarFact(c.field)!==null&&scalarFact(c.field)<c.minimum);
            if(failures.length)return {matched:false,unknown:false,fields:failures.map(c=>c.field)};
            return {matched:checks.every(c=>scalarFact(c.field)!==null),unknown:checks.some(c=>scalarFact(c.field)===null),fields:checks.map(c=>c.field)};
        }
        if (key === "tallestCrewHeight") {
            const canonicalInches = scalar(boat.Headroom) === null ? null : global.BAtlasCanonical?.inches(boat, "Headroom", []);
            const headroom = canonicalInches;
            if (headroom == null) return { matched: false, unknown: true };
            const inches = headroom;
            return { matched: inches >= numericValue(value), unknown: false };
        }
        return { matched: false, unknown: true };
    }

    // One buyer-fit policy for cards, comparisons and ordering. These are policy
    // weights, not probabilities. Canonical facts and Phase 3 eligibility are untouched.
    const SCORING_POLICY = Object.freeze({
        version: 4, important: 3, preferred: 1, neutral: 50,
        verified: 1, supported: 0.5, legacy: 0.25,
        high: 80, medium: 50, unresolvedCap: 49
    });
    function preferenceWeight(priority, profile) {
        if (priority === 'Important') return SCORING_POLICY.important;
        if (priority === 'PreferredV4') return SCORING_POLICY.preferred;
        if (priority === 'Preferred') return profile?.preferencePolicyVersion >= 4 ? SCORING_POLICY.preferred : 2;
        // Existing Required/Bonus entries remain soft 3/1 preferences forever,
        // including mixed profiles where the buyer has edited other controls.
        if (priority === 'Required') return 3;
        if (priority === 'Bonus') return 1;
        return 0;
    }
    const FEATURE_FIELDS = Object.freeze({
        'separate shower':['ShowerTypeCode','ShowerType','Shower'],
        'wide side decks':['SideDecksCode','SideDecks'], 'aft cabin':['AftCabin'],
        'walkthrough transom':['WalkthroughTransom'], 'side helm door':['SideHelmDoor'],
        'galley up with helm':['GalleyUpWithHelm','Galley'], 'removable flybridge':['RemovableFlybridge'],
        'long keel':['KeelConfigurationCode','KeelConfiguration','KeelType'],
        'skeg hung rudder':['RudderTypeCode','RudderType'], 'trailerable':['Trailerable'],
        'single engine':['EngineCount'], 'twin engines':['EngineCount'],
        'diesel fuel':['FuelCode'], 'shaft drive':['MechanicalPropulsionCode']
    });
    function factSupport(row, fields) {
        return Math.min(...fields.map(field => {
            const meta = row.SpecificationConfidence?.[field];
            const status = normalizeText(meta?.Status);
            if (/estimated|conflict|uncertain|configuration variable|unverified/.test(status)) return 0;
            if (status === 'verified' && String(meta?.Level).toLowerCase() === 'high') return SCORING_POLICY.verified;
            if (/normalized|corroborated|supported|verified/.test(status)) return SCORING_POLICY.supported;
            return SCORING_POLICY.legacy;
        }));
    }
    function featureResult(row, feature) {
        const key = normalizeText(feature), fields = FEATURE_FIELDS[key] || [];
        const field = fields.find(f => Object.prototype.hasOwnProperty.call(row, f)) || fields[0];
        const raw = field ? row[field] : null;
        const meta = row.SpecificationConfidence?.[field];
        const text = normalizeText(raw), code = String(raw ?? '').split('.').pop().replace(/_/g,' ');
        const unknown = () => ({matched:false,unknown:true,fields:field?[field]:fields,support:0,configurationDependent:/configuration variable|optional|varies|mixed/.test(text+' '+normalizeText(meta?.Status))});
        if (!known(raw) || Array.isArray(raw) || /unknown|optional|varies|mixed|conflict|configuration variable|estimated|uncertain/.test(text+' '+normalizeText(meta?.Status))) return unknown();
        let matched;
        if (key === 'single engine' || key === 'twin engines') {
            if (![1,2,3,4].includes(Number(raw)) || typeof raw === 'boolean') return unknown();
            matched = Number(raw) === (key === 'single engine' ? 1 : 2);
        } else if (key === 'diesel fuel') {
            const value = global.BScoutValueNormalizer?.normalize('fuel',code) || code;
            if (!['diesel','gasoline','gas','electric','hybrid'].includes(value)) return unknown();
            matched = value === 'diesel';
        } else if (key === 'shaft drive') {
            const value = global.BScoutValueNormalizer?.normalize('propulsion',code) || code;
            if (!['shaft','outboard','stern-drive','pod-drive','jet-drive'].includes(value)) return unknown();
            matched = value === 'shaft';
        } else if (key === 'wide side decks') {
            if (!['wide','moderate','limited','narrow','none'].includes(code.toLowerCase())) return unknown();
            matched = code.toLowerCase() === 'wide';
        } else if (key === 'separate shower') {
            if (!['separate stall','separate','wet head','none','combined','wet'].includes(code.toLowerCase())) return unknown();
            matched = ['separate stall','separate'].includes(code.toLowerCase());
        } else if (['long keel','skeg hung rudder'].includes(key)) {
            // Only a structured category, not prose or marketing keywords.
            if (!String(raw).includes('.') && !['full long','long keel','fin','skeg hung','spade'].includes(text)) return unknown();
            matched = key === 'long keel' ? /full long|long keel/.test(code) : /skeg hung/.test(code);
        } else if (key === 'galley up with helm' && field === 'Galley') {
            if (!['galley up','galley down'].includes(text)) return unknown();
            matched = text === 'galley up';
        } else {
            if (![true,false,'Yes','No','yes','no','true','false'].includes(raw)) return unknown();
            matched = raw === true || ['yes','true'].includes(text);
        }
        return {matched,unknown:false,fields:[field],support:factSupport(row,[field])};
    }
    function rowPreferences(boat, profile) {
        const preferences = [], seen = new Set();
        const add = (label, weight, result) => {
            if (!weight || seen.has(normalizeText(label))) return;
            seen.add(normalizeText(label));
            preferences.push({label,weight,...result,matched:!result.unknown && !!result.matched});
        };
        Object.entries(profile?.featurePriorities || {}).forEach(([feature, priority]) =>
            add(feature, preferenceWeight(priority,profile), featureResult(boat,feature)));
        // Crew and guests share the same accommodation facts: combine their
        // requirements into one preference rather than double-rewarding berths.
        const crew = [];
        if (profile?.crewComposition) crew.push(crewPreferenceResult(boat,'crewComposition',profile.crewComposition));
        if (profile?.guestFrequency) crew.push(crewPreferenceResult(boat,'guestFrequency',profile.guestFrequency));
        if (crew.length) {
            const failures = crew.filter(r=>!r.unknown&&!r.matched);
            const fields = [...new Set((failures.length?failures:crew).flatMap(r=>r.fields||[]))];
            const unknown = !failures.length && crew.some(r=>r.unknown);
            add('Crew and overnight guests',SCORING_POLICY.important,{matched:crew.every(r=>r.matched),unknown,fields,support:unknown?0:factSupport(boat,fields)});
        }
        if (known(profile?.tallestCrewHeight)) {
            const result = crewPreferenceResult(boat,'tallestCrewHeight',profile.tallestCrewHeight);
            const unknown = result.unknown || /estimated|conflict|variable/.test(normalizeText(boat.SpecificationConfidence?.Headroom?.Status));
            add('Recorded headroom (verify occupied areas)',SCORING_POLICY.important,{...result,unknown,fields:['Headroom'],support:unknown?0:factSupport(boat,['Headroom'])});
        }
        return preferences;
    }
    function assessPreferences(boat, profile, scope, hardMatch, hardSpecs) {
        if(hardMatch.status === 'excluded') return {
            policyVersion:SCORING_POLICY.version,eligible:false,score:null,confidence:null,
            confidenceLevel:'Not assessed',ordering:SCORING_POLICY.neutral,
            matches:0,total:0,unknown:0,preferences:[],hardUnknowns:[],
            hardConflicts:[hardMatch.explanation],configurationDependent:false,
            scoreRange:null,rangeIncomplete:false,warnings:[],strengths:[],compromises:[],unknowns:[],
            explanation:'Excluded by your must-haves. Preference ranking does not override this decision.',
            confidenceExplanation:'No overall match is assessed for an excluded model.'
        };
        const rows = scope.length ? scope : [boat];
        const alternatives = rows.map(row => {
            const preferences = rowPreferences(row,profile);
            const allWeight = preferences.reduce((n,p)=>n+p.weight,0);
            const knownWeight = preferences.reduce((n,p)=>n+(p.unknown?0:p.weight),0);
            const matchedWeight = preferences.reduce((n,p)=>n+(p.matched?p.weight:0),0);
            const score = knownWeight ? 100*matchedWeight/knownWeight : null;
            const confidence = allWeight ? 100*preferences.reduce((n,p)=>n+p.weight*p.support,0)/allWeight : null;
            return {preferences,score,confidence};
        });
        const conditional = hardMatch.conditional || alternatives.some(a=>a.preferences.some(p=>p.configurationDependent)) || alternatives.some(a=>JSON.stringify(a.preferences.map(p=>[p.matched,p.unknown]))!==JSON.stringify(alternatives[0].preferences.map(p=>[p.matched,p.unknown])));
        const hardUnknowns = hardMatch.unknowns.slice();
        // Scoring may be more cautious about evidence than eligibility, but it
        // must never change Phase 3 membership. Include material hard-field
        // uncertainty even when a legacy scalar happens to pass the filter.
        for(const spec of hardSpecs || []) {
            if(rows.some(row=>/estimated|conflict|uncertain|configuration variable|unverified/.test(normalizeText(row.SpecificationConfidence?.[spec.field]?.Status)))) {
                hardUnknowns.push(`${spec.label || 'Required specification'}. Evidence or version needs verification.`);
            }
        }
        if (hardMatch.conditional) hardUnknowns.push('Verify the applicable version and equipment against your must-haves.');
        // Conservative ordering across applicable rows; never cherry-pick positives
        // from different versions. Missing alternatives stay explicitly unknown.
        const confidenceFor = a => a.confidence === null ? null : Math.min(a.confidence, hardUnknowns.length || conditional ? SCORING_POLICY.unresolvedCap : 100);
        const orderingFor = a => a.score === null ? SCORING_POLICY.neutral : SCORING_POLICY.neutral+(confidenceFor(a)/100)*(a.score-SCORING_POLICY.neutral);
        alternatives.sort((a,b)=>orderingFor(a)-orderingFor(b));
        const selected = alternatives[0], preferences = selected.preferences;
        const scores = alternatives.map(a=>a.score).filter(v=>v!==null);
        const confidence = confidenceFor(selected);
        const hasPreferences = preferences.length > 0;
        const confidenceLevel = confidence === null ? 'Not assessed' : confidence >= SCORING_POLICY.high ? 'High' : confidence >= SCORING_POLICY.medium ? 'Medium' : 'Low';
        return {
            policyVersion:SCORING_POLICY.version, eligible:true, hardConflicts:[], score:selected.score === null?null:Math.round(selected.score),
            confidence:confidence===null?null:Math.round(confidence), confidenceLevel,
            ordering:hasPreferences?orderingFor(selected):SCORING_POLICY.neutral,
            matches:preferences.filter(p=>p.matched).length,total:preferences.length,
            unknown:preferences.filter(p=>p.unknown).length,preferences,hardUnknowns,
            configurationDependent:conditional, scoreRange:scores.length?[Math.round(Math.min(...scores)),Math.round(Math.max(...scores))]:null,
            rangeIncomplete:alternatives.some(a=>a.preferences.some(p=>p.unknown)),
            explanation:!hasPreferences?'No preferences selected.':selected.score===null?'Not enough information to assess your preferences.':conditional?'Version-dependent assessment; verify which specifications coexist.':'Match describes known preferences; confidence describes their evidence.',
            confidenceExplanation:hardUnknowns.length?'Overall confidence is limited by unresolved must-haves or configuration applicability.':'Confidence reflects applicable evidence for selected preferences, including unknown information.',
            warnings:preferences.some(p=>p.label==='Single Engine')&&preferences.some(p=>p.label==='Twin Engines')?['Single and twin engines are competing preferences; no configuration can satisfy both.']:[],
            strengths:preferences.filter(p=>p.matched).map(p=>p.label),
            compromises:preferences.filter(p=>!p.matched&&!p.unknown).map(p=>p.label),
            unknowns:preferences.filter(p=>p.unknown).map(p=>p.label)
        };
    }
    function preferenceAssessment(boat, profile, routes) {
        return evaluateBoat(boat,profile,routes || [],{}).preference;
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
        const scoringRows=new Map();
        const scoringFields=new Set(configs.flatMap(c=>Object.keys(c||{})).filter(k=>!['ProductionPhaseID','ConfigurationID','SpecificationConfidence'].includes(k)));
        const phaseScoring=new Map(phaseRows.map((p,index)=>{
            const row={...p.row,SpecificationConfidence:{...p.row.SpecificationConfidence}};
            for(const f of phases[index]?.FactOverrides||[]) {
                row.SpecificationConfidence[f.FieldID]={Level:f.Confidence||'Low',Status:f.ValueState==='known'?(String(f.Confidence).toLowerCase()==='high'?'verified':'supported'):'uncertain'};
            }
            return [p.row,row];
        }));
        const scoreOverlay=(base,c)=>{
            const source=phaseScoring.get(base)||base;
            const row={...source,SpecificationConfidence:{...source.SpecificationConfidence}};
            for(const key of scoringFields){
                row[key]=Object.prototype.hasOwnProperty.call(c||{},key)?c[key]:null;
                // A model-wide evidence rating cannot certify a different option value.
                row.SpecificationConfidence[key]=c?.SpecificationConfidence?.[key] || (row[key]===source[key]?source.SpecificationConfidence?.[key]:undefined);
            }
            return row;
        };
        const originalOverlay=(base,c)=>{const row={...base};for(const key of configFields)row[key]=null;for(const key of configFields)if(c&&Object.prototype.hasOwnProperty.call(c,key))row[key]=c[key];return row;};
        const overlay=(base,c)=>{const row=originalOverlay(base,c);scoringRows.set(row,scoreOverlay(base,c));return row;};
        let rows,linkageUnknown=false;
        if(!configs.length)rows=phaseRows.map(p=>p.row);
        else if(!phases.length){
            rows=configs.map(c=>overlay(boat,c));
            if(boat.VerifiedConfigurationsComplete!==true){const rest={...boat};for(const key of configFields)if(uncertain(boat[key]))rest[key]=null;scoringRows.set(rest,scoreOverlay(rest,null));rows.push(rest);}
        }else{
            // Do not invent a Cartesian pairing between independent phase/configuration evidence.
            const scoped=configs.every(c=>c?.ProductionPhaseID&&phases.some(p=>p.ProductionPhaseID===c.ProductionPhaseID));
            if(scoped){
                rows=[];
                for(const p of phaseRows){const options=configs.filter(c=>c.ProductionPhaseID===p.phaseID);rows.push(...options.map(c=>overlay(p.row,c)));if(!options.length||boat.VerifiedConfigurationsComplete!==true){scoringRows.set(p.row,scoreOverlay(p.row,null));rows.push(p.row);}}
            }else{
                const phaseResults=phaseRows.map(p=>{const row={...p.row};for(const key of configFields)row[key]=null;return assess(row);});
                const configBase={...boat};for(const key of phaseFields)configBase[key]=null;
                const configRows=configs.map(c=>overlay(configBase,c));
                if(boat.VerifiedConfigurationsComplete!==true)configRows.push(configBase);
                const configResults=configRows.map(assess);
                if(!phaseResults.some(r=>r.passes)||!configResults.some(r=>r.passes))rows=[];
                else {const unresolved={...boat};for(const key of new Set([...phaseFields,...configFields]))unresolved[key]=null;rows=[unresolved];const scoring={...unresolved};for(const key of scoringFields)scoring[key]=null;scoringRows.set(unresolved,scoring);linkageUnknown=true;}
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
        const match={status,explanation,unknowns:[...new Set(unknowns.map(key=>labels[key]||key))],conditional,requirements:specs.length};
        const scope=rows.filter((row,index)=>results[index].passes).map(row=>scoringRows.get(row)||phaseScoring.get(row)||row);
        return {passes:!reasons.length,reasons:[...new Set(reasons)],relevance:relevanceScore(boat,profile.textSearch),preference:assessPreferences(boat,profile,scope,match,specs.map(spec=>({...spec,label:labels[spec.reason]}))),match};
    }

    function filterBoats(boats, settings, routes, dependencies) {
        const source = Array.isArray(boats) ? boats : [];
        const evaluated = source.map((boat, index) => ({ boat, index, result: evaluateBoat(boat, settings, routes, dependencies) }))
            .filter(item => item.result.passes);
        if (settings && (settings.textSearch || Object.keys(settings.featurePriorities || {}).length || settings.crewComposition || settings.tallestCrewHeight || settings.guestFrequency)) {
            evaluated.sort((a, b) => b.result.preference.ordering - a.result.preference.ordering || (b.result.preference.confidence??0) - (a.result.preference.confidence??0) || b.result.relevance - a.result.relevance || String(a.boat.BoatModelID||a.index).localeCompare(String(b.boat.BoatModelID||b.index)));
        }
        return evaluated.map(item => item.boat);
    }

    const returnApi = { SCORING_POLICY, preferenceWeight, evaluateBoat, filterBoats, known, numericValue, relevanceScore, levenshtein, featureMatchScore, preferenceAssessment, featureMatches };

    global.BScoutFilterEngine = returnApi;
})(typeof window !== "undefined" ? window : globalThis);
