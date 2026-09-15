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
            boat.Designer, boat.Style, boat.BoatFamily, boat.Configuration, boat.HullType, boat.Construction, (boat.Features || []).join(" "), boat.TypicalMission, boat.Strengths, boat.Weaknesses,
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
            if (headroom === null) return { matched: false, unknown: true };
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
            add(feature, weight, featureMatches(boat, feature), false);
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
        const totalWeight = preferences.reduce((sum, item) => sum + item.weight, 0);
        const matchedWeight = preferences.reduce((sum, item) => sum + (item.matched ? item.weight : 0), 0);
        const score = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;
        return { score, matches, total, unknown, preferences };
    }

    function featureMatchScore(boat, profile) {
        return preferenceAssessment(boat, profile).score;
    }

    function evaluateBoat(boat, settings, routes, dependencies) {
        const profile = settings || {};
        const reasons = [];
        const routeEvaluator = dependencies?.passesRouteCompatibility || global.passesRouteCompatibility;
        const normalizer = global.BScoutValueNormalizer;
        const fallbackNormalize = (domain, value) => {
            const text = normalizeText(value);
            if (domain === "hullType" && ["displacement", "full displacement", "displacement hull", "full displacement hull"].includes(text)) return "displacement";
            if (domain === "propulsion" && ["shaft", "shaft drive", "inboard shaft", "direct drive"].includes(text)) return "shaft";
            if (domain === "fuel" && ["gas", "gasoline", "petrol"].includes(text)) return "gasoline";
            return text;
        };
        const canonicalComparable = value => {
            const text = String(value == null ? "" : value).trim();
            if (!text) return text;
            const suffix = text.includes(".") ? text.split(".").pop() : text;
            return suffix.replace(/_/g, " ");
        };
        const selectedIncludes = (domain, selected, actual) => {
            const comparableActual = canonicalComparable(actual);
            return normalizer
                ? normalizer.matches(domain, selected, comparableActual)
                : selected.map(value => fallbackNormalize(domain, value)).includes(fallbackNormalize(domain, comparableActual));
        };
        const uncertainCanonical = value => {
            const text = normalizeText(canonicalComparable(value));
            return !text || text === "unknown" || text === "mixed" || text.includes("configuration dependent") || text.includes("conflict");
        };
        const canonicalPlanValue = (boat, key, legacyKeys=[]) => {
            if (boat && Object.prototype.hasOwnProperty.call(boat, key)) {
                const value = boat[key];
                return uncertainCanonical(value) ? null : value;
            }
            for (const legacyKey of legacyKeys) {
                const value = boat?.[legacyKey];
                if (known(value) && !uncertainCanonical(value)) return value;
            }
            return null;
        };
        const exceedsMaximum = (actual, maximum) => {
            const actualNumber = numericValue(actual);
            const maximumNumber = numericValue(maximum);
            return actualNumber !== null && maximumNumber !== null && actualNumber > maximumNumber;
        };
        const belowMinimum = (actual, minimum) => {
            const actualNumber = numericValue(actual);
            const minimumNumber = numericValue(minimum);
            return actualNumber !== null && minimumNumber !== null && actualNumber < minimumNumber;
        };

        // Routes, Dimensions, and Characteristics are hard filters.
        // Missing registry data is retained; a known conflict eliminates the model.
        if (typeof routeEvaluator === "function" && !routeEvaluator(boat, profile, routes || [])) reasons.push("route-compatibility");
        const dimensionRangeFt = key => {
            const meta=global.BAtlasCanonical?.specificationConfidence?.(boat,key);
            const lowEstimate=meta?.status==="estimated" && meta?.level==="Low";
            const range=global.BAtlasCanonical?.canonicalRange?.(boat,key);
            if(range)return {min:range.min/0.3048,max:range.max/0.3048,variable:!!range.variable,lowEstimate};
            const value=global.BAtlasCanonical ? global.BAtlasCanonical.feet(boat,key,[]) : (Number.isFinite(Number(boat?.[key])) ? Number(boat[key])/0.3048 : null);
            return value===null||value===undefined?null:{min:value,max:value,variable:false,lowEstimate};
        };
        const loaRange=dimensionRangeFt("LOA"), beamRange=dimensionRangeFt("Beam"), draftRange=dimensionRangeFt("Draft"), airRange=dimensionRangeFt("AirDraft");
        // Preserve a model when a known production range straddles the buyer limit; eliminate only when every known version conflicts.
        if (loaRange && !loaRange.lowEstimate && belowMinimum(loaRange.max, profile.minLength)) reasons.push("min-length");
        if (loaRange && !loaRange.lowEstimate && exceedsMaximum(loaRange.min, profile.maxLength)) reasons.push("max-length");
        if (beamRange && !beamRange.lowEstimate && belowMinimum(beamRange.max, profile.minBeam)) reasons.push("min-beam");
        if (beamRange && !beamRange.lowEstimate && exceedsMaximum(beamRange.min, profile.maxBeam)) reasons.push("max-beam");
        if (draftRange && !draftRange.lowEstimate && exceedsMaximum(draftRange.min, profile.maxDraft)) reasons.push("max-draft");
        if (airRange && !airRange.lowEstimate && exceedsMaximum(airRange.min, profile.maxAirDraft)) reasons.push("max-air-draft");
        if (profile.styles?.length) {
            const actualStyle = boat.NormalizedStyle || boat.Style;
            if (known(actualStyle) && !selectedIncludes("boatStyle", profile.styles, actualStyle)) reasons.push("style");
        }
        if (profile.boatFamilies?.length) {
            const familyCandidates = [boat.BoatFamilyCode, boat.BoatFamily, boat.NormalizedStyle, boat.Style, boat.Configuration]
                .filter(known).map(value => normalizeText(canonicalComparable(value)));
            const familyMatches = profile.boatFamilies.some(selected => {
                const wanted = normalizeText(selected);
                return familyCandidates.some(actual =>
                    actual === wanted ||
                    actual.includes(wanted) ||
                    (wanted === "tug" && actual.includes("tug")) ||
                    (wanted === "trawler" && actual.includes("trawler")) ||
                    (wanted === "downeast" && actual.includes("downeast")) ||
                    (wanted === "motor yacht" && actual.includes("motor yacht")) ||
                    (wanted === "sportfisher" && (actual.includes("sportfisher") || actual.includes("sport fisher"))) ||
                    (wanted === "cruiser" && actual.includes("cruiser"))
                );
            });
            // Preserve incomplete records. Eliminate only when classification is known and conflicts.
            if (familyCandidates.length && !familyMatches) reasons.push("boat-family");
        }
        if (profile.configurations?.length && known(boat.Configuration) && !profile.configurations.includes(boat.Configuration)) reasons.push("configuration");
        if (profile.constructionMaterials?.length && known(boat.Construction) && !selectedIncludes("construction", profile.constructionMaterials, boat.Construction)) reasons.push("construction-material");
        if (profile.hullTypes?.length) {
            const actualHull = canonicalPlanValue(boat, "HullBehaviourCode", ["HullBehaviour","NormalizedHullForm","HullType"]);
            if (known(actualHull) && !selectedIncludes("hullType", profile.hullTypes, actualHull)) reasons.push("hull-type");
        }
        const actualFuel = canonicalPlanValue(boat, "FuelCode", ["NormalizedFuel","Fuel"]);
        if (profile.fuels?.length && known(actualFuel) && !selectedIncludes("fuel", profile.fuels, actualFuel)) reasons.push("fuel");
        const actualPropulsion = canonicalPlanValue(boat, "MechanicalPropulsionCode", ["PropulsionCode","NormalizedPropulsion","Propulsion"]);
        if (profile.propulsion?.length && known(actualPropulsion) && !selectedIncludes("propulsion", profile.propulsion, actualPropulsion)) reasons.push("propulsion");
        // Engine count is a hard filter only when known. Unknown engine count remains eligible.
        const selectedEngineCounts = Array.isArray(profile.engineCounts) && profile.engineCounts.length
            ? profile.engineCounts.map(Number)
            : (profile.twinEngines ? [2] : []); // backward compatibility for older saved profiles
        if (selectedEngineCounts.length && known(boat.EngineCount) && !selectedEngineCounts.includes(numericValue(boat.EngineCount))) reasons.push("engine-count");
        if (profile.flybridge && known(boat.Flybridge) && boat.Flybridge !== profile.flybridge) reasons.push("flybridge");
        const actualSideDecks = boat.SideDecksCode || boat.SideDecks;
        if (profile.sideDecks && known(actualSideDecks)) {
            const allowed = { "Wide": ["wide"], "Moderate+": ["wide", "moderate"], "Limited+": ["wide", "moderate", "limited"], "Narrow+": ["wide", "moderate", "limited", "narrow"], "None": ["none"] }[profile.sideDecks];
            const actual = normalizeText(canonicalComparable(actualSideDecks));
            if (allowed && !allowed.includes(actual)) reasons.push("side-decks");
        }
        if (profile.trailerable && known(boat.Trailerable)) {
            const actual = booleanLike(boat.Trailerable, ["yes", "true", "trailerable"]);
            if (actual !== (profile.trailerable === "Yes")) reasons.push("trailerable");
        }
        if (profile.greatLoop && known(boat.GreatLoopSuitable)) {
            const actual = booleanLike(boat.GreatLoopSuitable, ["yes", "true", "suitable"]);
            if (actual !== (profile.greatLoop === "Yes")) reasons.push("great-loop");
        }
        if (known(profile.minimumBerths) && known(boat.Berths) && numericValue(boat.Berths) < numericValue(profile.minimumBerths)) reasons.push("minimum-berths");
        if (known(profile.minimumCabins) && known(boat.Cabins) && numericValue(boat.Cabins) < numericValue(profile.minimumCabins)) reasons.push("minimum-cabins");
        if (known(profile.minimumHeads) && known(boat.Heads) && numericValue(boat.Heads) < numericValue(profile.minimumHeads)) reasons.push("minimum-heads");

        // Search, Standard, and Crew Fit are preferences.
        const preference = preferenceAssessment(boat, profile);
        return { passes: reasons.length === 0, reasons, relevance: relevanceScore(boat, profile.textSearch), preference };
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
