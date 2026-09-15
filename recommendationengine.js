/**
 * B-Atlas Recommendation Engine Framework
 * 
 * =========================================================================
 * ARCHITECTURAL DESIGN & RESPONSIBILITIES
 * =========================================================================
 * 
 * 1. RECOMMENDATION ENGINE (This File)
 *    - Responsibility: Central Orchestrator.
 *    - Role: Acts as the single entry point for all suitability and recommendation
 *      logic. It coordinates inputs from BoatModels, Boat Knowledge, and active
 *      Route/Search Profiles, and delegates calculations to specific sub-systems 
 *      (Mission Fit, Comfort Fit, and Route Compatibility).
 *    - Future Role: It will weigh Mission Fit and Comfort Fit based on the active 
 *      Cruising Profile (e.g. 70/30 for Long Range, 40/60 for Weekend Cruiser) to
 *      produce the final Overall Fit Index, generate semantic explanations, and 
 *      synthesize trade-offs.
 * 
 * 2. BOAT INTELLIGENCE (public/boatintelligence.js)
 *    - Responsibility: Raw Fact Transformation & Technical Inference.
 *    - Role: Performs static physical analyses on raw data (e.g., LWL to Hull Speed,
 *      LOA to Platform Size) and evaluates Data Completeness. It remains strictly 
 *      factual and has no knowledge of user preferences, mission suitability, or routes.
 * 
 * 3. FUTURE MISSION FIT SUB-SYSTEM
 *    - Responsibility: Operational Suitability Scoring.
 *    - Role: Compares a boat's mechanical design (hull speed capability, fuel type,
 *      propulsion system, range autonomy, draft/air draft constraints) against 
 *      the Cruising Profile's qualitative requirements (e.g., "Strongly Preferred" diesel).
 *      Outputs a sub-score (0-100) indicating how well the boat physically matches the mission.
 * 
 * 4. FUTURE COMFORT FIT SUB-SYSTEM
 *    - Responsibility: Lifestyle & Accommodation Suitability Scoring.
 *    - Role: Evaluates the boat's liveaboard comfort and interior layout against 
 *      crew assumptions and duration (e.g., presence of separate shower, galley, 
 *      cabins, flybridge, wide side decks) matching the Cruising Profile.
 *      Outputs a sub-score (0-100) indicating lifestyle suitability.
 * 
 * 5. FUTURE BUYER EXPLANATION & TRADE-OFFS LAYER
 *    - Responsibility: Semantic Translation & Natural Language Generation.
 *    - Role: Interprets the mathematical scores and differences between boat specs
 *      and profile desires. Translates numerical gaps into readable bullet points:
 *      - POSITIVES: Highlighting strong matches (e.g. "Diesel semi-displacement hull matches ICW Explorer.")
 *      - CAUTIONS: Highlighting risks (e.g. "Draft of 5.5 ft exceeds ICW preferred limit of 5.0 ft.")
 *      - TRADEOFFS: Describing inherent trade-offs (e.g. "Pocket size offers trailerability but compromises separate cabin privacy.")
 */

// =========================================================================
// EVALUATION RULES LAYER DEPENDENCY CONFIGURATION
// =========================================================================
// These dynamic helpers confirm access to the core types and helper functions 
// defined in the Evaluation Rules Layer (public/evaluationrules.js) at runtime.
const getFeatureKeys = () => typeof FEATURE_KEYS !== 'undefined' ? FEATURE_KEYS : (typeof window !== 'undefined' ? window.FEATURE_KEYS : null);
const getBuildEvaluationResult = () => typeof buildEvaluationResult === 'function' ? buildEvaluationResult : (typeof window !== 'undefined' ? window.buildEvaluationResult : null);
const getCompareValues = () => typeof compareValues === 'function' ? compareValues : (typeof window !== 'undefined' ? window.compareValues : null);

// =========================================================================
// NEW ARCHITECTURAL HOOKS (FUTURE BRIDGE LAYER)
// =========================================================================
// The functions below act as the architectural bridge connecting the
// Evaluation Rules Layer, tomorrow's individual evaluator modules, and the
// core Recommendation Engine.

/**
 * Creates an evaluation context for a boat during recommendation processing.
 * This manages state for evaluations before scoring is performed.
 * 
 * @param {Object} boat - The raw boat model object
 * @param {Object} userProfile - The active search/user profile
 * @returns {Object} An evaluation context containing the boat, profile, and an empty evaluations array
 */
function createBoatEvaluationContext(boat, userProfile) {
    return {
        boat: boat,
        userProfile: userProfile,
        evaluations: []
    };
}

/**
 * Appends a standardized Evaluation Result object to the evaluation context.
 * This helper does not perform calculations; it acts as a collector of evaluators' outputs.
 * 
 * @param {Object} context - The active evaluation context
 * @param {Object} evaluationResult - Standardized Evaluation Result object from B-Atlas Evaluation Rules Layer
 */
function addEvaluation(context, evaluationResult) {
    if (context && Array.isArray(context.evaluations) && evaluationResult) {
        context.evaluations.push(evaluationResult);
    }
}

// =========================================================================
// EVALUATORS (NEW ARCHITECTURE)
// =========================================================================

/**
 * Fuel Evaluator (Phase 1)
 * 
 * NOTE: Fuel is the first functional evaluator implemented using the new 
 * Evaluation Rules architecture. Additional evaluators (such as Hull Type, 
 * Layout, Propulsion, Dimensions, etc.) will follow the exact same pattern.
 * These standardized Evaluation Results act as formal "evidence" that will be
 * consumed and analyzed by future Decision Reports.
 * 
 * Purpose:
 * Compare the boat fuel type against the buyer's fuel preference.
 * 
 * @param {Object} boat - Raw boat model object
 * @param {Object} userProfile - Search Profile defining the buyer's preferences
 * @returns {Object} Standardized Evaluation Result object
 */
function evaluateFuel(boat, userProfile) {
    // 1. Resolve preferred fuels from various possible shapes of userProfile
    let preferredFuels = [];
    let fuelImportance = "Preferred"; // Default importance level for fuel preference
    
    if (userProfile) {
        // Handle search settings / profile structure
        if (userProfile.SearchSettings) {
            if (Array.isArray(userProfile.SearchSettings.fuels)) {
                preferredFuels = userProfile.SearchSettings.fuels;
            }
            if (userProfile.SearchSettings.fuelImportance) {
                fuelImportance = userProfile.SearchSettings.fuelImportance;
            }
        } else if (userProfile.SuggestedPreferences) {
            if (Array.isArray(userProfile.SuggestedPreferences.Fuel)) {
                preferredFuels = userProfile.SuggestedPreferences.Fuel;
            }
            if (userProfile.SuggestedPreferences.fuelImportance) {
                fuelImportance = userProfile.SuggestedPreferences.fuelImportance;
            }
        }
        
        // Handle direct attributes on userProfile/profile itself
        if (preferredFuels.length === 0) {
            if (Array.isArray(userProfile.fuels)) {
                preferredFuels = userProfile.fuels;
            } else if (Array.isArray(userProfile.Fuel)) {
                preferredFuels = userProfile.Fuel;
            } else if (typeof userProfile.Fuel === 'string' && userProfile.Fuel) {
                preferredFuels = [userProfile.Fuel];
            } else if (typeof userProfile.fuels === 'string' && userProfile.fuels) {
                preferredFuels = [userProfile.fuels];
            }
        }
        
        if (userProfile.fuelImportance) {
            fuelImportance = userProfile.fuelImportance;
        } else if (userProfile.importance && userProfile.importance.Fuel) {
            fuelImportance = userProfile.importance.Fuel;
        }
    }
    
    // Safely retrieve dependencies from window or local context
    const req = typeof normalizeRequirement === 'function' ? normalizeRequirement(fuelImportance) : "Preferred";
    const featureKey = typeof FEATURE_KEYS !== 'undefined' ? FEATURE_KEYS.Fuel : "Fuel";
    const importance = req === "NoRequirement" ? "Neutral" : req;
    const buildResult = typeof buildEvaluationResult === 'function' ? buildEvaluationResult : window.buildEvaluationResult;

    // RULE 1: If the buyer has no active fuel requirement
    if (req === "NoRequirement" || !preferredFuels || preferredFuels.length === 0) {
        return buildResult(
            featureKey,
            "Neutral",
            "Not Applicable",
            0,
            "Buyer has no fuel preference.",
            { preferredFuels },
            "NoRequirement"
        );
    }

    // RULE 2: If boat fuel is unknown
    const boatFuelRaw = boat ? (Object.prototype.hasOwnProperty.call(boat,"FuelCode") ? boat.FuelCode : (boat.NormalizedFuel || boat.Fuel)) : null;
    const boatFuel = boatFuelRaw && String(boatFuelRaw).includes(".") ? String(boatFuelRaw).split(".").pop().replace(/_/g, " ") : boatFuelRaw;
    if (!boatFuel || boatFuel.trim() === "" || /(^|[._ -])(unknown|mixed)([._ -]|$)|configuration[ _-]?dependent|conflict/i.test(boatFuel)) {
        return buildResult(
            featureKey,
            importance,
            "Unknown",
            0,
            "Boat fuel type is unknown. This does not eliminate the boat, but reduces confidence.",
            { preferredFuels, actualFuel: "Unknown", confidenceReduction: 10 },
            req
        );
    }

    // Prepare details for standard matching
    const actualFuelsList = boatFuel.split(/[\/,]/).map(f => f.trim().toLowerCase());
    
    // Normalize and lower-case preferred fuels for accurate string comparison
    const normPreferredFuels = preferredFuels.map(f => String(f).trim().toLowerCase());
    
    // Check if boat fuel matches buyer preference
    let isMatch = false;
    for (const actual of actualFuelsList) {
        if (normPreferredFuels.includes(actual)) {
            isMatch = true;
            break;
        }
    }
    
    if (!isMatch && typeof compareValues === 'function') {
        isMatch = compareValues(boatFuel, preferredFuels);
    }

    // RULE 3: If boat fuel matches buyer preference
    if (isMatch) {
        const weight = typeof getImportanceWeight === 'function' ? getImportanceWeight(importance) : 0.4;
        const scoreContribution = Math.round(100 * Math.max(0.1, weight)); // Match contribution based on importance weight
        return buildResult(
            featureKey,
            importance,
            "Match",
            scoreContribution,
            `Boat fuel type (${boatFuel}) matches buyer preference (${preferredFuels.join(", ")}).`,
            { preferredFuels, actualFuel: boatFuel },
            req
        );
    }

    // RULE 4: If boat fuel conflicts with buyer preference
    const scoreContribution = 0; // Conflict contributes 0 or negative
    const status = "Conflict";
    
    return buildResult(
        featureKey,
        importance,
        status,
        scoreContribution,
        `Boat fuel type (${boatFuel}) conflicts with buyer preference (${preferredFuels.join(", ")}).`,
        { preferredFuels, actualFuel: boatFuel },
        req
    );
}

// Expose evaluateFuel globally
if (typeof window !== "undefined") window.evaluateFuel = evaluateFuel;

/**
 * Hull Type Evaluator (Phase 2)
 * 
 * NOTE: Hull Type is the second functional evaluator implemented using the new 
 * Evaluation Rules architecture. Evaluators provide evidence, not final recommendations.
 * Additional evaluators (such as Propulsion, Dimensions, Layout, etc.) will follow 
 * the exact same pattern.
 * 
 * Purpose:
 * Evaluate whether the boat's hull type matches the buyer's hull type requirement.
 * 
 * @param {Object} boat - Raw boat model object
 * @param {Object} userProfile - Search Profile defining the buyer's preferences
 * @returns {Object} Standardized Evaluation Result object
 */
function evaluateHullType(boat, userProfile) {
    // 1. Resolve preferred hull types from various possible shapes of userProfile
    let preferredHulls = [];
    let hullImportance = "Preferred"; // Default importance level for hull preference
    
    if (userProfile) {
        // Handle search settings / profile structure
        if (userProfile.SearchSettings) {
            if (Array.isArray(userProfile.SearchSettings.hullTypes)) {
                preferredHulls = userProfile.SearchSettings.hullTypes;
            } else if (Array.isArray(userProfile.SearchSettings.hulls)) {
                preferredHulls = userProfile.SearchSettings.hulls;
            }
            if (userProfile.SearchSettings.hullImportance) {
                hullImportance = userProfile.SearchSettings.hullImportance;
            } else if (userProfile.SearchSettings.hullTypesImportance) {
                hullImportance = userProfile.SearchSettings.hullTypesImportance;
            }
        } else if (userProfile.SuggestedPreferences) {
            if (Array.isArray(userProfile.SuggestedPreferences.HullType)) {
                preferredHulls = userProfile.SuggestedPreferences.HullType;
            } else if (Array.isArray(userProfile.SuggestedPreferences.hullTypes)) {
                preferredHulls = userProfile.SuggestedPreferences.hullTypes;
            } else if (Array.isArray(userProfile.SuggestedPreferences.hulls)) {
                preferredHulls = userProfile.SuggestedPreferences.hulls;
            }
            if (userProfile.SuggestedPreferences.hullImportance) {
                hullImportance = userProfile.SuggestedPreferences.hullImportance;
            } else if (userProfile.SuggestedPreferences.hullTypesImportance) {
                hullImportance = userProfile.SuggestedPreferences.hullTypesImportance;
            }
        }
        
        // Handle direct attributes on userProfile/profile itself
        if (preferredHulls.length === 0) {
            if (Array.isArray(userProfile.hullTypes)) {
                preferredHulls = userProfile.hullTypes;
            } else if (Array.isArray(userProfile.hulls)) {
                preferredHulls = userProfile.hulls;
            } else if (Array.isArray(userProfile.HullType)) {
                preferredHulls = userProfile.HullType;
            } else if (typeof userProfile.HullType === 'string' && userProfile.HullType) {
                preferredHulls = [userProfile.HullType];
            } else if (typeof userProfile.hullTypes === 'string' && userProfile.hullTypes) {
                preferredHulls = [userProfile.hullTypes];
            } else if (typeof userProfile.hulls === 'string' && userProfile.hulls) {
                preferredHulls = [userProfile.hulls];
            }
        }
        
        if (userProfile.hullImportance) {
            hullImportance = userProfile.hullImportance;
        } else if (userProfile.importance && userProfile.importance.HullType) {
            hullImportance = userProfile.importance.HullType;
        } else if (userProfile.importance && userProfile.importance.hullTypes) {
            hullImportance = userProfile.importance.hullTypes;
        } else if (userProfile.importance && userProfile.importance.hulls) {
            hullImportance = userProfile.importance.hulls;
        } else if (userProfile.Requirement) {
            hullImportance = userProfile.Requirement;
        }
    }

    const req = typeof normalizeRequirement === 'function' ? normalizeRequirement(hullImportance) : "Preferred";
    const featureKey = typeof FEATURE_KEYS !== 'undefined' ? FEATURE_KEYS.HullType : "HullType";
    const importance = req === "NoRequirement" ? "Neutral" : req;
    const buildResult = typeof buildEvaluationResult === 'function' ? buildEvaluationResult : window.buildEvaluationResult;

    // RULE 1: If the buyer has no active hull requirement
    if (req === "NoRequirement" || !preferredHulls || preferredHulls.length === 0) {
        return buildResult(
            featureKey,
            "Neutral",
            "Not Applicable",
            0,
            "Buyer has no hull type preference.",
            { preferredHulls: [] },
            "NoRequirement"
        );
    }

    // RULE 2: If boat hull type is unknown
    const boatHullRaw = boat ? (Object.prototype.hasOwnProperty.call(boat,"HullBehaviourCode") ? boat.HullBehaviourCode : (boat.HullBehaviour || boat.NormalizedHullForm || boat.HullType)) : null;
    const boatHull = boatHullRaw && String(boatHullRaw).includes(".") ? String(boatHullRaw).split(".").pop().replace(/_/g, " ") : boatHullRaw;
    if (!boatHull || boatHull.trim() === "" || /(^|[._ -])(unknown|mixed)([._ -]|$)|configuration[ _-]?dependent|conflict/i.test(boatHull)) {
        return buildResult(
            featureKey,
            importance,
            "Unknown",
            0,
            "Boat hull type is unknown. This does not eliminate the boat.",
            { preferredHulls, actualHull: "Unknown" },
            req
        );
    }

    // Helper to normalize hull values (e.g., matching "Full Displacement" with "Displacement", and normalizing casing/whitespace)
    function normalizeHullValue(val) {
        if (!val || typeof val !== 'string') return '';
        let cleaned = val.trim().toLowerCase();
        if (cleaned === 'full displacement' || cleaned === 'displacement') {
            return 'displacement';
        }
        return cleaned.replace(/[\s_-]/g, "");
    }

    // Check if boat hull matches buyer preference using normalized comparison
    let isMatch = false;
    const normActual = normalizeHullValue(boatHull);
    const normPreferredList = preferredHulls.map(h => normalizeHullValue(h));
    
    if (normPreferredList.includes(normActual)) {
        isMatch = true;
    }
    
    if (!isMatch && typeof compareValues === 'function') {
        isMatch = compareValues(boatHull, preferredHulls);
    }

    // RULE 3: If boat hull matches buyer preference
    if (isMatch) {
        const weight = typeof getImportanceWeight === 'function' ? getImportanceWeight(importance) : 0.4;
        const scoreContribution = Math.round(100 * Math.max(0.1, weight));
        
        let explanation = "";
        if (req === "Required") {
            explanation = "Boat hull type matches required hull type.";
        } else {
            explanation = "Boat hull type matches preferred hull type.";
        }

        return buildResult(
            featureKey,
            importance,
            "Match",
            scoreContribution,
            explanation,
            { preferredHulls, actualHull: boatHull },
            req
        );
    }

    // RULE 4: If boat hull conflicts with buyer preference
    const scoreContribution = 0;
    const status = "Conflict";
    
    let explanation = "";
    if (req === "Required") {
        explanation = "Boat hull type does not satisfy required hull type.";
    } else {
        explanation = "Boat hull type conflicts with preferred hull type.";
    }

    return buildResult(
        featureKey,
        importance,
        status,
        scoreContribution,
        explanation,
        { preferredHulls, actualHull: boatHull },
        req
    );
}

// Expose evaluateHullType globally
if (typeof window !== "undefined") window.evaluateHullType = evaluateHullType;

/**
 * Gets the preference constraint for a given boat dimension from the user profile.
 * Supporting ranges, minimum, and maximum constraints.
 */
function getDimensionPreference(profile, feature) {
    if (!profile) return null;

    const sources = [
        profile.SearchSettings,
        profile.SuggestedPreferences,
        profile
    ];

    let keys = [];
    if (feature === "LOA") {
        keys = ["maxLength", "LOA", "Length", "loa", "length"];
    } else if (feature === "Beam") {
        keys = ["maxBeam", "Beam", "beam"];
    } else if (feature === "Draft") {
        keys = ["maxDraft", "Draft", "draft"];
    } else if (feature === "AirDraft") {
        keys = ["maxAirDraft", "AirDraft", "airDraft", "air_draft"];
    }

    for (const src of sources) {
        if (!src) continue;
        for (const key of keys) {
            if (src[key] !== undefined && src[key] !== null && src[key] !== "") {
                return { value: src[key], sourceKey: key };
            }
        }
    }
    return null;
}

/**
 * Gets the requirement level or importance level for a given boat dimension from the user profile.
 */
function getDimensionRequirement(profile, feature) {
    if (!profile) return "Preferred";

    const sources = [
        profile.SearchSettings,
        profile.SuggestedPreferences,
        profile
    ];

    let keys = [];
    if (feature === "LOA") {
        keys = ["lengthImportance", "lengthRequirement", "LOAImportance", "LOARequirement", "loaImportance", "loaRequirement", "maxLengthImportance", "maxLengthRequirement"];
    } else if (feature === "Beam") {
        keys = ["beamImportance", "beamRequirement", "maxBeamImportance", "maxBeamRequirement"];
    } else if (feature === "Draft") {
        keys = ["draftImportance", "draftRequirement", "maxDraftImportance", "maxDraftRequirement"];
    } else if (feature === "AirDraft") {
        keys = ["airDraftImportance", "airDraftRequirement", "maxAirDraftImportance", "maxAirDraftRequirement"];
    }

    for (const src of sources) {
        if (!src) continue;
        for (const key of keys) {
            if (src[key] !== undefined && src[key] !== null && src[key] !== "") {
                return src[key];
            }
        }
    }
    return "Preferred";
}

/**
 * Dimension Evaluator (Phase 3)
 * 
 * - Dimensions are physical compatibility evidence.
 * - Individual dimensions are evaluated separately.
 * - Unknown dimensions do not automatically exclude boats.
 * 
 * Purpose:
 * Evaluate numeric boat dimensions (LOA, Beam, Draft, Air Draft) against buyer requirements.
 * 
 * @param {Object} boat - Raw boat model object
 * @param {Object} userProfile - Search Profile defining the buyer's preferences
 * @returns {Array} Array of Standardized Evaluation Result objects
 */
function evaluateDimensions(boat, userProfile) {
    const buildResult = typeof buildEvaluationResult === 'function' ? buildEvaluationResult : window.buildEvaluationResult;
    const compareVals = typeof compareValues === 'function' ? compareValues : window.compareValues;
    const getWeight = typeof getImportanceWeight === 'function' ? getImportanceWeight : window.getImportanceWeight;

    const dimensions = [
        { feature: "LOA", canonicalField: "LOA", label: "Length" },
        { feature: "Beam", canonicalField: "Beam", label: "Beam" },
        { feature: "Draft", canonicalField: "Draft", label: "Draft" },
        { feature: "AirDraft", canonicalField: "AirDraft", label: "Air Draft" }
    ];

    const results = [];

    for (const dim of dimensions) {
        const featureKey = typeof FEATURE_KEYS !== 'undefined' && FEATURE_KEYS[dim.feature] ? FEATURE_KEYS[dim.feature] : dim.feature;

        const reqLevel = getDimensionRequirement(userProfile, dim.feature);
        const canonicalReq = typeof normalizeRequirement === 'function' ? normalizeRequirement(reqLevel) : "Preferred";
        const importance = canonicalReq === "NoRequirement" ? "Neutral" : canonicalReq;

        const prefData = getDimensionPreference(userProfile, dim.feature);

        // RULE 1: If the buyer has no preference or requirement is NoRequirement
        if (canonicalReq === "NoRequirement" || !prefData || prefData.value === null || prefData.value === undefined || prefData.value === "") {
            results.push(buildResult(
                featureKey,
                "Neutral",
                "Not Applicable",
                0,
                `Buyer has no ${dim.label.toLowerCase()} preference.`,
                { preferredValue: null },
                "NoRequirement"
            ));
            continue;
        }

        // Parse preference value
        let expected = prefData.value;
        if (typeof expected === "string" && !isNaN(Number(expected))) {
            expected = Number(expected);
        }
        if (typeof expected === "number") {
            if (prefData.sourceKey && prefData.sourceKey.toLowerCase().startsWith("min")) {
                expected = { min: expected };
            } else {
                expected = { max: expected };
            }
        }

        // Format expected string for user-friendly explanation
        let expectedStr = "";
        if (typeof expected === "object" && expected !== null) {
            if (expected.min !== undefined && expected.max !== undefined) {
                expectedStr = `between ${expected.min} and ${expected.max} ft`;
            } else if (expected.min !== undefined) {
                expectedStr = `minimum of ${expected.min} ft`;
            } else if (expected.max !== undefined) {
                expectedStr = `maximum of ${expected.max} ft`;
            }
        }

        // RULE 2: Resolve model-wide value or known production-phase range.
        const canonical = boat ? Number(boat[dim.canonicalField]) : NaN;
        const phaseRange = typeof BAtlasCanonical !== "undefined" && BAtlasCanonical?.canonicalRange
            ? BAtlasCanonical.canonicalRange(boat, dim.canonicalField) : null;
        let actualNum = Number.isFinite(canonical) && canonical > 0 ? canonical / 0.3048 : null;
        const actualRangeFt = phaseRange ? { min: phaseRange.min / 0.3048, max: phaseRange.max / 0.3048 } : null;
        if (phaseRange?.variable) actualNum=null;
        if (actualNum === null && actualRangeFt && Math.abs(actualRangeFt.max-actualRangeFt.min) < 1e-6) actualNum = actualRangeFt.min;
        if (typeof actualNum === "string") {
            actualNum = actualNum.trim();
            if (actualNum !== "" && !isNaN(Number(actualNum))) {
                actualNum = Number(actualNum);
            }
        }

        if ((actualNum === undefined || actualNum === null || actualNum === "" || isNaN(actualNum)) && actualRangeFt && actualRangeFt.max > actualRangeFt.min) {
            const emin = (typeof expected === "object" && expected?.min !== undefined) ? Number(expected.min) : null;
            const emax = (typeof expected === "object" && expected?.max !== undefined) ? Number(expected.max) : null;
            const entirelyBelowMin = Number.isFinite(emin) && actualRangeFt.max < emin;
            const entirelyAboveMax = Number.isFinite(emax) && actualRangeFt.min > emax;
            const entirelyInside = (!Number.isFinite(emin) || actualRangeFt.min >= emin) && (!Number.isFinite(emax) || actualRangeFt.max <= emax);
            if (entirelyBelowMin || entirelyAboveMax) {
                results.push(buildResult(featureKey,importance,"Conflict",0,`${dim.label} varies by production phase (${actualRangeFt.min.toFixed(2)}–${actualRangeFt.max.toFixed(2)} ft), and all known phases fall outside the constraint (${expectedStr}).`,{preferredValue:expected,actualValue:actualRangeFt},canonicalReq));
            } else if (entirelyInside) {
                const weight = typeof getWeight === 'function' ? getWeight(importance) : 0.4;
                results.push(buildResult(featureKey,importance,"Match",Math.round(100*Math.max(0.1,weight)),`${dim.label} varies by production phase (${actualRangeFt.min.toFixed(2)}–${actualRangeFt.max.toFixed(2)} ft), and all known phases satisfy the constraint (${expectedStr}).`,{preferredValue:expected,actualValue:actualRangeFt},canonicalReq));
            } else {
                results.push(buildResult(featureKey,importance,"Unknown",0,`${dim.label} varies by production phase (${actualRangeFt.min.toFixed(2)}–${actualRangeFt.max.toFixed(2)} ft). Some known phases may satisfy the constraint; verify the boat year/hull.`,{preferredValue:expected,actualValue:actualRangeFt},canonicalReq));
            }
            continue;
        }
        if (actualNum === undefined || actualNum === null || actualNum === "" || isNaN(actualNum)) {
            results.push(buildResult(
                featureKey,
                importance,
                "Unknown",
                0,
                `${dim.label} information is unavailable. This does not eliminate the boat.`,
                { preferredValue: expected, actualValue: "Unknown" },
                canonicalReq
            ));
            continue;
        }

        // Low-confidence estimates inform ranking/display but are not treated as known conflicts.
        const specMeta = (typeof BAtlasCanonical !== "undefined" && BAtlasCanonical?.specificationConfidence)
            ? BAtlasCanonical.specificationConfidence(boat, dim.canonicalField) : null;
        if (specMeta?.status === "estimated" && specMeta?.level === "Low") {
            results.push(buildResult(
                featureKey,
                importance,
                "Unknown",
                0,
                `${dim.label} is a low-confidence working estimate (${actualNum} ft). Keep the boat eligible and verify the actual vessel before applying this constraint.`,
                { preferredValue: expected, actualValue: actualNum, confidence: "Low", estimated: true },
                canonicalReq
            ));
            continue;
        }

        // RULE 3 & 4: Compare actual and expected
        const isMatch = compareVals(actualNum, expected);

        if (isMatch) {
            const weight = typeof getWeight === 'function' ? getWeight(importance) : 0.4;
            const scoreContribution = Math.round(100 * Math.max(0.1, weight));
            results.push(buildResult(
                featureKey,
                importance,
                "Match",
                scoreContribution,
                `Boat ${dim.label.toLowerCase()} (${actualNum} ft) satisfies the required/preferred constraint (${expectedStr}).`,
                { preferredValue: expected, actualValue: actualNum },
                canonicalReq
            ));
        } else {
            results.push(buildResult(
                featureKey,
                importance,
                "Conflict",
                0,
                `Boat ${dim.label.toLowerCase()} (${actualNum} ft) does not satisfy the constraint (${expectedStr}).`,
                { preferredValue: expected, actualValue: actualNum },
                canonicalReq
            ));
        }
    }

    return results;
}

// Expose evaluateDimensions globally
if (typeof window !== "undefined") window.evaluateDimensions = evaluateDimensions;

// =========================================================================
// RECOMMENDATION ORCHESTRATION
// =========================================================================

/**
 * Single entry point for all B-Atlas boat recommendations and suitability evaluations.
 * Orchestrates existing Boat Knowledge and Route Compatibility with placeholders for future scoring metrics.
 * 
 * @param {Object} boat - Raw boat model object from database
 * @param {Object} cruisingProfile - Selected Cruising Profile (e.g. ICW Explorer)
 * @param {Object} searchProfile - Selected user Search Profile containing user settings
 * @param {Array} selectedRoutes - Array of Route objects currently selected
 * @returns {Object} Standardized Recommendation Object
 */
function evaluateBoatForProfile(
    boat,
    cruisingProfile,
    searchProfile,
    selectedRoutes
) {
    // Resolve global and window-level functions safely (for both browser and simulated environments)
    const getBoatIntel = typeof calculateBoatIntelligence === 'function' ? calculateBoatIntelligence : 
                        (typeof window !== 'undefined' && typeof window.calculateBoatIntelligence === 'function' ? window.calculateBoatIntelligence : null);
    
    const getRouteCompatibility = typeof passesRouteCompatibility === 'function' ? passesRouteCompatibility : 
                                 (typeof window !== 'undefined' && typeof window.passesRouteCompatibility === 'function' ? window.passesRouteCompatibility : null);

    // 1. Retrieve Boat Knowledge (from public/boatintelligence.js)
    let intelligence = null;
    let dataConfidence = 0;
    if (getBoatIntel) {
        intelligence = getBoatIntel(boat);
        dataConfidence = intelligence ? intelligence.Confidence : 0;
    }

    // 2. Evaluate Route Compatibility using existing passesRouteCompatibility if safe
    let routeStatus = "Unknown";
    let routeWarnings = [];

    // Standardize user routes list from searchProfile or selectedRoutes
    const routeIds = [];
    if (searchProfile && searchProfile.SearchSettings && Array.isArray(searchProfile.SearchSettings.routes)) {
        searchProfile.SearchSettings.routes.forEach(r => routeIds.push(String(r).trim().toUpperCase()));
    } else if (Array.isArray(selectedRoutes)) {
        selectedRoutes.forEach(r => {
            const id = typeof r === 'object' && r ? (r.RouteID || r.id) : r;
            if (id) routeIds.push(String(id).trim().toUpperCase());
        });
    }

    const globalRoutesList = (typeof allRoutes !== 'undefined' ? allRoutes : 
                             (typeof window !== 'undefined' && typeof window.allRoutes !== 'undefined' ? window.allRoutes : []));

    if (routeIds.length > 0 && globalRoutesList.length > 0) {
        routeStatus = "Pass";

        // Check if passesRouteCompatibility is available
        if (getRouteCompatibility) {
            // Construct simulated userProfile structure for engine.js consumption
            const simUserProfile = { routes: routeIds };
            const passes = getRouteCompatibility(boat, simUserProfile, globalRoutesList);
            if (!passes) {
                routeStatus = "Fail";
            }
        }

        // Generate specific route limit warnings to enrich routeCompatibility
        routeIds.forEach(selectedRouteID => {
            const matchedRoute = globalRoutesList.find(r => {
                const rID = r.RouteID !== undefined ? r.RouteID : r.id;
                return rID !== undefined && String(rID).trim().toUpperCase() === selectedRouteID;
            });

            if (matchedRoute) {
                const routeName = matchedRoute.Name || matchedRoute.RouteID || matchedRoute.id || "Route";
                
                const feetValue = field => {
                    const canonical = Number(boat?.[field]);
                    return Number.isFinite(canonical) && canonical > 0 ? canonical / 0.3048 : null;
                };
                const routeChecks = [
                    ["Draft", matchedRoute.MaxDraftFt || matchedRoute.RouteMaxDraftFt, "Draft"],
                    ["AirDraft", matchedRoute.MaxAirDraftFt || matchedRoute.RouteMaxAirDraftFt, "Air Draft"],
                    ["Beam", matchedRoute.MaxBeamFt || matchedRoute.RouteMaxBeamFt, "Beam"],
                    ["LOA", matchedRoute.MaxLengthFt || matchedRoute.RouteMaxLengthFt, "LOA"]
                ];
                routeChecks.forEach(([field, limit, label]) => {
                    const value = feetValue(field);
                    if (limit !== undefined && limit !== null && value !== null && value > Number(limit)) {
                        routeWarnings.push(`${label} (${value.toFixed(1).replace(/\.0$/, "")} ft) exceeds ${routeName} limit of ${limit} ft.`);
                    }
                });
            }
        });
    }

    // 3. Resolve active buyer/user profile for evaluation context
    const activeUserProfile = searchProfile || cruisingProfile || {};

    // 4. Create the Evaluation Context (Phase 1)
    // This manages state for evaluations before scoring is performed.
    // NOTE: This is an evaluation architecture task only. Existing legacy scoring
    // (calculateBScoutScore) and UI remain unchanged and fully functional.
    const evaluationContext = createBoatEvaluationContext(boat, activeUserProfile);

    // 5. Run first functional evaluator: evaluateFuel
    // Additional evaluators will follow this identical pattern.
    const fuelEvaluationResult = evaluateFuel(boat, activeUserProfile);

    // 6. Add evaluation result to context
    addEvaluation(evaluationContext, fuelEvaluationResult);

    // 6b. Run second functional evaluator: evaluateHullType
    const hullEvaluationResult = evaluateHullType(boat, activeUserProfile);

    // Add hull evaluation result to context
    addEvaluation(evaluationContext, hullEvaluationResult);

    // Run third functional evaluator: evaluateDimensions
    const dimensionEvaluationResults = evaluateDimensions(boat, activeUserProfile);

    // Add dimension evaluation results to context
    if (Array.isArray(dimensionEvaluationResults)) {
        dimensionEvaluationResults.forEach(res => {
            addEvaluation(evaluationContext, res);
        });
    }

    // 6c. Move Decision Logic to Recommendation Layer
    // Where existing code determines: 'Should this conflict eliminate the boat?'
    // Replace the dependency on: isFailLevel() with: isRequired()
    if (evaluationContext && Array.isArray(evaluationContext.evaluations)) {
        evaluationContext.evaluations.forEach(ev => {
            const isReq = typeof isRequired === 'function' ? isRequired(ev.requirement) : false;
            if (isReq && ev.status === "Conflict") {
                ev.details.isFailCondition = true;
                ev.details.eliminationReason = `Candidate failure condition: Required ${ev.feature} has conflict.`;
            } else {
                ev.details.isFailCondition = false;
            }
        });
    }

    // Generate Decision Report
    const getDecisionReport = typeof generateDecisionReport === 'function' ? generateDecisionReport : 
                              (typeof window !== 'undefined' && typeof window.generateDecisionReport === 'function' ? window.generateDecisionReport : null);
    let decisionReport = null;
    if (getDecisionReport) {
        decisionReport = getDecisionReport(evaluationContext);
    }

    // 7. Construct Standardized Recommendation Object with placeholders for scoring & explanation layers
    return {
        // Newly introduced Evaluation Context containing the individual evaluator outputs
        evaluationContext: evaluationContext,

        // Decision Report summarizing evidence and classifying candidates
        decisionReport: decisionReport,

        // Overall Fitness percentage score (weighted average of Mission and Comfort Fit based on Cruising Profile)
        overallFit: null, // Placeholder: future weighted index

        // Text summary of the suitability rating (e.g., "Highly Recommended", "Good Choice", "Not Recommended")
        overallRecommendation: "Not Yet Calculated", // Placeholder

        // Operational/Performance compatibility sub-score (0-100)
        missionFit: null, // Placeholder: future operational metric

        // Layout/Amenity compatibility sub-score (0-100)
        comfortFit: null, // Placeholder: future lifestyle metric

        // Specification completeness percentage (0-100)
        dataCompleteness: dataConfidence,

        // Route clearances status and lists of failures/limits
        routeCompatibility: {
            status: routeStatus,
            warnings: routeWarnings
        },

        // Physical derived specifications from the Boat Knowledge Layer
        intelligence: intelligence,

        // Buyer explanation arrays are derived from the evaluator evidence.
        // They must never remain empty merely because the future semantic layer is incomplete.
        positives: decisionReport && Array.isArray(decisionReport.matches)
            ? decisionReport.matches.map(item => item.explanation || item.reason).filter(Boolean)
            : [],

        cautions: [
            ...(decisionReport && Array.isArray(decisionReport.conflicts)
                ? decisionReport.conflicts.map(item => item.explanation || item.reason).filter(Boolean)
                : []),
            ...routeWarnings
        ],

        unknowns: decisionReport && Array.isArray(decisionReport.unknowns)
            ? decisionReport.unknowns.map(item => item.explanation || item.reason).filter(Boolean)
            : [],

        tradeoffs: []
    };
}

// Expose recommendation engine globally
if (typeof window !== "undefined") {
    window.evaluateBoatForProfile = evaluateBoatForProfile;
    window.createBoatEvaluationContext = createBoatEvaluationContext;
    window.addEvaluation = addEvaluation;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        createBoatEvaluationContext,
        addEvaluation,
        evaluateFuel,
        evaluateHullType,
        evaluateDimensions,
        evaluateBoatForProfile
    };
}
