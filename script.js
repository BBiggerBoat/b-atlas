
let allBoats = [];
let allRoutes = [];
let allMissionTemplates = [];
let builtInSearchProfiles = [];
let comparisonBoatIDs = [];
let boatRegistry = null;
let taxonomyRegistry = null;
let knowledgeLayer = null;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =====================================================
// APPLICATION INITIALIZATION
// =====================================================

/**
 * Receives validated application data from BScoutBootstrap.
 * Data retrieval and startup sequencing intentionally live outside this UI module.
 */
function initializeBScoutApplication(data) {
    const payload = data || {};

    allBoats = Array.isArray(payload.boats) ? payload.boats : [];
    allRoutes = Array.isArray(payload.routes) ? payload.routes : [];
    allMissionTemplates = Array.isArray(payload.missionTemplates) ? payload.missionTemplates : [];
    builtInSearchProfiles = Array.isArray(payload.searchProfiles) ? payload.searchProfiles : [];
    window.BScoutMarketplaceSources = Array.isArray(payload.marketplaceSources) ? payload.marketplaceSources : [];
    window.BScoutModelSearchAliases = Array.isArray(payload.modelSearchAliases) ? payload.modelSearchAliases : [];
    window.BScoutMarketplaceSourceValidation = Array.isArray(payload.marketplaceSourceValidation) ? payload.marketplaceSourceValidation : [];
    // Temporary compatibility alias for older renderers.
    window.BScoutBrokerSourceValidation = window.BScoutMarketplaceSourceValidation;

    if (window.BScoutBoatRegistry && typeof window.BScoutBoatRegistry.createRegistry === "function") {
        boatRegistry = window.BScoutBoatRegistry.createRegistry({
            manufacturers: payload.manufacturers,
            boats: payload.boatRegistry
        });
        window.BScoutRegistry = boatRegistry;
        const registryValidation = boatRegistry.validateSourceBoats(allBoats);
        if (!registryValidation.valid) {
            console.warn("Boat Registry validation requires review:", registryValidation);
        }
    }

    console.log(`Loaded ${allBoats.length} boats`);
    console.log(`Loaded ${allRoutes.length} routes`);
    console.log(`Loaded ${allMissionTemplates.length} templates`);
    console.log(`Loaded ${builtInSearchProfiles.length} built-in Search Profiles`);
    console.log(`Loaded ${window.BScoutMarketplaceSources.length} marketplace sources`);
    console.log(`Loaded ${window.BScoutModelSearchAliases.length} model search alias records`);
    console.log(`Loaded ${window.BScoutMarketplaceSourceValidation.length} marketplace source validation records`);

    if (window.BScoutManufacturerKnowledgeRepository && typeof window.BScoutManufacturerKnowledgeRepository.createRepository === "function") {
        window.BScoutManufacturerKnowledge = window.BScoutManufacturerKnowledgeRepository.createRepository(payload.manufacturerKnowledge);
    }

    if (window.BScoutTaxonomyRegistry && typeof window.BScoutTaxonomyRegistry.createRegistry === "function") {
        taxonomyRegistry = window.BScoutTaxonomyRegistry.createRegistry({
            fuelTypes: payload.fuelTypes,
            propulsionTypes: payload.propulsionTypes,
            hullForms: payload.hullForms,
            hullConfigurations: payload.hullConfigurations,
            styleFamilies: payload.styleFamilies
        });
        window.BScoutTaxonomy = taxonomyRegistry;
        const taxonomyIssues = allBoats.flatMap(boat => taxonomyRegistry.validateBoat(boat).map(issue => ({
            BoatModelID: boat.BoatModelID,
            ...issue
        })));
        if (taxonomyIssues.length) console.warn("Taxonomy validation requires review:", taxonomyIssues);
    }

    if (window.BScoutKnowledgeLayerRepository && typeof window.BScoutKnowledgeLayerRepository.createKnowledgeIndex === "function") {
        knowledgeLayer = window.BScoutKnowledgeLayerRepository.createKnowledgeIndex({
            facts: payload.facts,
            evidence: payload.evidence,
            contradictions: payload.contradictions,
            relationships: payload.relationships,
            knowledgeCoverage: payload.knowledgeCoverage
        });
        window.BScoutKnowledgeLayer = knowledgeLayer;
        const knowledgeValidation = window.BScoutKnowledgeLayerRepository.validateKnowledgeData({
            facts: payload.facts,
            evidence: payload.evidence,
            contradictions: payload.contradictions,
            relationships: payload.relationships,
            knowledgeCoverage: payload.knowledgeCoverage
        }, allBoats.map(boat => boat.BoatModelID));
        if (!knowledgeValidation.valid) console.warn("Knowledge Layer validation requires review:", knowledgeValidation);
    }

    if (window.BScoutSearchOrchestrator) {
        window.BScoutSearchOrchestrator.configure({
            boats: allBoats,
            routes: allRoutes,
            render: displayBoats,
            relationshipResolver: getBoatRelationship
        });
    }

    displayBoats(allBoats);
    initMissionTemplates();
    initSearchProfiles();
    // v6.72: resolve Saved Models transfer links only after canonical model data is available.
    if (typeof detectSavedModelsTransferFromHash === "function") detectSavedModelsTransferFromHash();

    // SEO/deep-link bridge: crawlable model pages link here with ?model=BoatModelID.
    // Open the existing interactive Guide after application data is available.
    try {
        const requestedModelId = new URLSearchParams(window.location.search).get("model");
        if (requestedModelId) {
            const requestedBoat = allBoats.find(b => String(b.BoatModelID) === String(requestedModelId));
            if (requestedBoat) {
                window.setTimeout(async () => {
                    if (window.BScoutBoatWorkspace?.open) {
                        await window.BScoutBoatWorkspace.open(requestedBoat, "overview", { history:false });
                        const path = window.BAtlasModelURLs?.pathForBoat?.(requestedBoat);
                        if (path && window.history?.replaceState) window.history.replaceState({bscoutView:"guide",boatModelId:requestedBoat.BoatModelID,tab:"overview"}, "", path);
                    } else showBoatDetails(requestedBoat);
                }, 0);
            }
        }
    } catch (error) {
        console.warn("B-Atlas model deep link could not be opened", error);
    }

    return {
        boatCount: allBoats.length,
        routeCount: allRoutes.length,
        missionTemplateCount: allMissionTemplates.length,
        searchProfileCount: builtInSearchProfiles.length,
        marketplaceSourceCount: window.BScoutMarketplaceSources.length,
        modelSearchAliasCount: window.BScoutModelSearchAliases.length,
        marketplaceValidationCount: window.BScoutMarketplaceSourceValidation.length,
        registeredBoatIdentityCount: boatRegistry ? boatRegistry.listBoats().length : 0,
        manufacturerRegistryCount: boatRegistry ? boatRegistry.listManufacturers().length : 0,
        taxonomyReady: Boolean(taxonomyRegistry),
        knowledgeLayerReady: Boolean(knowledgeLayer),
        knowledgeFactCount: Array.isArray(payload.facts) ? payload.facts.length : 0
    };
}

window.initializeBScoutApplication = initializeBScoutApplication;

// =====================================================
// SEARCH PROFILE CONTROL BINDING
// =====================================================

function resetSearchControls() {
    document.querySelectorAll(".search-panel input, .search-panel select").forEach(element => {
        if (element.id === "searchProfileSelect") return;
        if (element.type === "checkbox") element.checked = false;
        else element.value = "";
    });
}

window.resetSearchControls = resetSearchControls;

function applySearchSettingsToControls(settings) {
    const values = settings || {};
    resetSearchControls();
    const setValue = (id, value) => { const element = document.getElementById(id); if (element && value !== undefined && value !== null) element.value = value; };
    const setCheckedValues = (selector, selected) => {
        const wanted = new Set((selected || []).map(String));
        document.querySelectorAll(selector).forEach(element => { element.checked = wanted.has(String(element.value)); });
    };
    const displayLengthInput = value => {
        if (value === undefined || value === null || value === "") return "";
        const profile = window.BAtlasCanonical?.getUnitProfile?.() || "imperial";
        return profile === "metric" ? Number((Number(value) * 0.3048).toFixed(2)) : value;
    };
    setValue("textSearch", values.textSearch || ""); setValue("minLength", displayLengthInput(values.minLength)); setValue("maxLength", displayLengthInput(values.maxLength)); setValue("minBeam", displayLengthInput(values.minBeam)); setValue("maxBeam", displayLengthInput(values.maxBeam));
    setValue("flybridgeFilter", values.flybridge || ""); setValue("sideDeckFilter", values.sideDecks || ""); setValue("trailerFilter", values.trailerable || ""); setValue("loopFilter", values.greatLoop || "");
    setValue("crewComposition", values.crewComposition || ""); setValue("tallestCrewHeight", values.tallestCrewHeight ?? ""); setValue("guestFrequency", values.guestFrequency || "");
    setCheckedValues(".routeFilter", values.routes); setCheckedValues(".styleFilter", values.styles); setCheckedValues(".familyFilter", values.boatFamilies);
    setCheckedValues(".configurationFilter", values.configurations); setCheckedValues(".constructionFilter", values.constructionMaterials);
    setCheckedValues(".hullFilter", values.hullTypes); setCheckedValues(".fuelFilter", values.fuels); setCheckedValues(".propulsionFilter", values.propulsion);
    const engineCounts = Array.isArray(values.engineCounts) && values.engineCounts.length ? values.engineCounts.map(Number) : (values.twinEngines ? [2] : []);
    document.querySelectorAll(".engineCountFilter").forEach(element => { element.checked = engineCounts.includes(Number(element.value)); });
    document.querySelectorAll(".featurePriority").forEach(element => { element.value = (values.featurePriorities || {})[element.dataset.feature] || ""; });
}

function describeSearchProfile(settings) {
    const s = settings || {}; const lines = [];
    if (s.textSearch) lines.push(`Search: ${s.textSearch}`); if (s.routes?.length) lines.push(`Routes: ${s.routes.join(", ")}`);
    const fmtConstraint = value => {
        if (value === undefined || value === null || value === "") return null;
        const metres = Number(value) * 0.3048;
        return window.BAtlasCanonical?.formatMeasurement?.(metres, "length", "both") || `${value} ft`;
    };
    if (s.minLength) lines.push(`Minimum length: ${fmtConstraint(s.minLength)}`); if (s.maxLength) lines.push(`Maximum length: ${fmtConstraint(s.maxLength)}`); if (s.minBeam) lines.push(`Minimum beam: ${fmtConstraint(s.minBeam)}`); if (s.maxBeam) lines.push(`Maximum beam: ${fmtConstraint(s.maxBeam)}`);
    if (s.fuels?.length) lines.push(`Fuel: ${s.fuels.join(", ")}`); if (s.boatFamilies?.length) lines.push(`Boat family: ${s.boatFamilies.join(", ")}`);
    if (s.configurations?.length) lines.push(`Sub-Family: ${s.configurations.join(", ")}`); if (s.hullTypes?.length) lines.push(`Hull behaviour: ${s.hullTypes.join(", ")}`);
    if (s.constructionMaterials?.length) lines.push(`Construction: ${s.constructionMaterials.join(", ")}`); if (s.propulsion?.length) lines.push(`Propulsion: ${s.propulsion.join(", ")}`);
    const engineCounts = Array.isArray(s.engineCounts) && s.engineCounts.length ? s.engineCounts.map(Number) : (s.twinEngines ? [2] : []);
    if (engineCounts.length === 1) lines.push(`Engine arrangement: ${engineCounts[0] === 1 ? "Single engine" : "Twin engines"}`);
    else if (engineCounts.length > 1) lines.push("Engine arrangement: Single or twin engines");
    if (s.sideDecks) lines.push(`Side decks: ${s.sideDecks}`); return lines;
}

function updateSearchProfileSummary() {
    const summary = document.getElementById("searchProfileSummary"); if (!summary) return;
    const settings = window.BScoutSearchState ? window.BScoutSearchState.readFromDocument(document) : buildUserProfile();
    const lines = describeSearchProfile(settings);
    summary.innerHTML = `<strong>${escapeHtml(currentSearchProfile?.ProfileName || "New Search")}${isCurrentProfileDirty ? " — unsaved changes" : ""}</strong>` +
        (lines.length ? lines.map(line => `<span class="profile-summary-item">${escapeHtml(line)}</span>`).join("") : "<span>No search criteria applied.</span>");
}

function initMissionTemplates() { /* Retained startup hook; preset templates were replaced by Search Profiles. */ }

// ===========================================
// Mission Evaluation (Tier 1 Filtering)
// ===========================================

function evaluateMissionHardConstraint(boat, mission) {

    let result = { passed: true, confidence: 100, issues: [] };
    const canonicalFeet = (field, legacyField) => {
        if (window.BAtlasCanonical) return window.BAtlasCanonical.feet(boat, field, [{ key: legacyField, unit: "ft" }]);
        const value = boat?.[legacyField];
        return value === undefined || value === null || value === "" ? null : Number(value);
    };
    const checks = [
        ["LOA", "LOA_ft", "MissionMaxLengthFt", "Length exceeds mission limit"],
        ["Beam", "Beam_ft", "MissionMaxBeamFt", "Beam exceeds mission limit"],
        ["Draft", "Draft_ft", "MissionMaxDraftFt", "Draft exceeds mission limit"],
        ["AirDraft", "AirDraft_ft", "MissionMaxAirDraftFt", "Air draft exceeds mission limit"]
    ];
    for (const [canonicalField, legacyField, missionField, message] of checks) {
        const actual = canonicalFeet(canonicalField, legacyField);
        const limit = mission?.[missionField];
        if (limit === undefined || limit === null || limit === "") continue;
        if (actual === null || !Number.isFinite(Number(actual))) { result.confidence -= 10; continue; }
        if (Number(actual) > Number(limit)) { result.passed = false; result.issues.push(message); }
    }
    return result;
}

// ===========================================
// Tier 2 - Mission Suitability Score
// ===========================================

function calculateMissionFit(boat, mission) {

    let score = 50;
    let reasons = [];


    // Fuel

    if (boat.Fuel === "Diesel") {

        score += 10;
        reasons.push("Diesel");

    }


    // Hull Type

    if (
        boat.HullType === "Displacement" ||
        boat.HullType === "Semi-Displacement"
    ) {

        score += 10;
        reasons.push("Cruising hull");

    }


    // Shower

  if (boat.Shower === true) {

    score += 3;
    reasons.push("Shower");

}


    // Fresh water

    if (boat.WaterCapacity !== undefined) {

        if (boat.WaterCapacity >= 100) {

            score += 5;
            reasons.push("Large fresh water capacity");

        }

        else if (boat.WaterCapacity >= 50) {

            score += 2;

        }

    }


    // Black water

    if (boat.HoldingCapacity !== undefined) {

        if (boat.HoldingCapacity >= 50) {

            score += 5;
            reasons.push("Large holding tank");

        }

    }


    // Limit score

    if (score > 100) {
        score = 100;
    }

    if (score < 0) {
        score = 0;
    }


    return {

        score: score,
        reasons: reasons

    };

}

// =====================================================
// B-ATLAS SUITABILITY SCORING
// =====================================================

function calculateBScoutScore(boat) {


    let score = 50;

    let reasons = [];

    let unknowns = [];



    // Fuel

    if (
        boat.Fuel &&
        boat.Fuel.toLowerCase().includes("diesel")
    ) {

        score += 10;

        reasons.push("✓ Diesel power");

    }

    else if (!boat.Fuel) {

        unknowns.push("? Fuel unknown");

    }



    // Hull

    if (
        boat.HullType === "Full Displacement" ||
        boat.HullType === "Semi-Displacement"
    ) {

        score += 10;

        reasons.push("✓ Cruising hull design");

    }

    else if (!boat.HullType) {

        unknowns.push("? Hull type unknown");

    }



    // Propulsion

    if (
        boat.Propulsion &&
        boat.Propulsion.toLowerCase().includes("shaft")
    ) {

        score += 10;

        reasons.push("✓ Inboard shaft propulsion");

    }

    else if (!boat.Propulsion) {

        unknowns.push("? Propulsion unknown");

    }



    // Side decks

    if (boat.SideDecks === "Wide") {

        score += 8;

        reasons.push("✓ Wide side decks");

    }

    else if (boat.SideDecks === "Moderate") {

        score += 5;

        reasons.push("✓ Moderate side decks");

    }

    else if (boat.SideDecks === "Limited") {

        score += 3;

        reasons.push("✓ Limited side access");

    }

    else if (boat.SideDecks === "Narrow") {

        score += 2;

        reasons.push("✓ Narrow side access");

    }



    // Documentation

    if (boat.Strengths) {

        score += 5;

        reasons.push("✓ Documented strengths");

    }



    if (boat.CommonProblems) {

        score += 5;

        reasons.push("✓ Known issues documented");

    }



    if (score > 100) {

        score = 100;

    }



    return {

        score,

        reasons,

        unknowns

    };


}





// =====================================================
// DISPLAY BOAT CARDS
// =====================================================

function renderDecisionSummary(relationship, boat) {
    const currentStatus = (relationship && relationship.Status) ? relationship.Status : "None";
    const notebook = relationship && relationship.Research ? relationship.Research : {};
    const rating = notebook.Rating || 0;
    const tags = notebook.Tags && notebook.Tags.trim() ? notebook.Tags.trim() : "None";
    let lastUpdatedStr = "Not started";
    if (relationship && relationship.LastUpdated) {
        const date = new Date(relationship.LastUpdated);
        if (!isNaN(date.getTime())) lastUpdatedStr = date.toLocaleDateString();
    }
    const stars = rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "Not rated";
    return `
<div class="decision-summary-section">
    <hr class="decision-summary-divider">
    <h3 class="decision-summary-heading">Decision Summary</h3>
    <div class="boat-status-container">
        <label for="status-${boat.BoatModelID}">Evaluation stage</label>
        <select class="boat-status-select status-${currentStatus.toLowerCase()}" data-id="${boat.BoatModelID}" id="status-${boat.BoatModelID}">
            <option value="None" ${currentStatus === "None" ? "selected" : ""}>Not Saved</option>
            <option value="Interested" ${currentStatus === "Interested" ? "selected" : ""}>Interested</option>
            <option value="Shortlist" ${currentStatus === "Shortlist" ? "selected" : ""}>Shortlist</option>
            <option value="Researching" ${currentStatus === "Researching" ? "selected" : ""}>Researching</option>
            <option value="Rejected" ${currentStatus === "Rejected" ? "selected" : ""}>Rejected</option>
        </select>
    </div>
    <div class="decision-summary-row"><strong>Buyer rating:</strong> <span class="stars-rating">${stars}</span></div>
    <div class="decision-summary-row"><strong>Tags:</strong> <span>${tags}</span></div>
    <div class="decision-summary-row"><strong>Notebook updated:</strong> <span>${lastUpdatedStr}</span></div>
    <hr class="decision-summary-divider">
</div>`;
}

function normalizeFeatureLabel(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function renderPreferenceMatchSummary(boat) {
    const settings = window.BScoutSearchState?.getState?.().searchSettings || {};
    const assessment = window.BScoutFilterEngine?.preferenceAssessment
        ? window.BScoutFilterEngine.preferenceAssessment(boat, settings)
        : { score: 0, matches: 0, total: 0, unknown: 0, preferences: [] };
    if (!assessment.total) return "";
    const matchedLabels = assessment.preferences.filter(item => item.matched).map(item => item.label);
    const unknownText = assessment.unknown ? ` · ${assessment.unknown} unknown` : "";
    return `<div class="preference-match-summary">
        <div class="preference-score"><strong>Preference Match ${assessment.score}%</strong></div>
        <div class="preference-count">Matches ${assessment.matches} of ${assessment.total} Preferences${unknownText}</div>
        ${matchedLabels.length ? `<div class="preference-labels">${matchedLabels.map(label => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
    </div>`;
}

function formatCardMeasurement(boat, key, legacy = []) {
    const formatted = window.BAtlasCanonical?.formatBoatMeasurement?.(boat, key, "length", legacy, "both");
    if (formatted) return formatted;
    // Last-resort display only. Avoid raw floating-point artifacts if legacy data is all that exists.
    for (const item of legacy) {
        const value = Number(boat?.[item.key]);
        if (!Number.isFinite(value)) continue;
        if (item.unit === "ft") {
            const totalInches = Math.round(value * 12);
            const feet = Math.floor(totalInches / 12);
            const inches = totalInches - feet * 12;
            const metres = value * 0.3048;
            return `${feet}′ ${inches}″ / ${metres.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} m`;
        }
    }
    return "Unknown";
}

function displayBoats(boats) {


    const container =
        document.getElementById("boat-listings");


    if (!container) {

        console.error("Missing boat-listings container");

        return;

    }

    // Search results represent the model universe selected by the search engine.
    // Workspace status such as Rejected must not silently remove models from an
    // otherwise unfiltered search; users can still see/manage that status on cards.
    const normalBoats = boats;

    // Update Results section counts
    const totalCountElem = document.getElementById("totalBoatsCount");
    const currentCountElem = document.getElementById("currentBoatsCount");
    if (totalCountElem) {
        totalCountElem.textContent = allBoats.length;
    }
    if (currentCountElem) {
        currentCountElem.textContent = normalBoats.length;
    }

    // Update the Buyer Workspace counts
    updateBuyerWorkspaceCounts();

    container.innerHTML = "";



    normalBoats.forEach(boat => {

        const rel = getBoatRelationship(boat.BoatModelID);

        const evaluation =
            calculateBScoutScore(boat);



        const card =
            document.createElement("div");



        card.className = "boat-card";



        const title = [

            boat.Manufacturer,

            boat.Model,

            boat.Variant

        ]

        .filter(Boolean)

        .join(" ");





        card.innerHTML = `

<img src="${ImageAssetManager.resolveBoatImage(boat)}" class="boat-image" alt="${title}" onerror="ImageAssetManager.applyImageFallback(this)">


<h2>

${title || "Unknown Boat"}

</h2>

<div class="boat-card-buttons">
<button

class="details-button intelligence-btn"

data-id="${boat.BoatModelID}"

>

Guide

</button>

<button

class="details-button research-btn"

data-id="${boat.BoatModelID}"

>

Notebook

</button>

<button

class="details-button compare-btn"

data-id="${boat.BoatModelID}"

>

Compare

</button>
</div>

${renderDecisionSummary(rel, boat)}

${renderPreferenceMatchSummary(boat)}

${window.BScoutIntelligenceLayer ? window.BScoutIntelligenceLayer.renderModelKnowledgeSummary(window.BScoutIntelligenceLayer.buildModelKnowledgeSummary(boat), { compact: true }) : ""}

<div class="card-fit-summary">
    <p class="hard-filter-pass"><strong>✓ Meets all known hard filters</strong></p>
    <p class="unknown-data">${evaluation.unknowns.slice(0, 3).join("<br>") || "No key data gaps identified"}</p>
</div>

<hr>
<strong>Specifications</strong>
<p>
Length: ${formatCardMeasurement(boat, "LOA", [{key:"LOA_ft",unit:"ft"},{key:"LengthFt",unit:"ft"}])}<br>
Beam: ${formatCardMeasurement(boat, "Beam", [{key:"Beam_ft",unit:"ft"},{key:"BeamFt",unit:"ft"}])}<br>
Draft: ${formatCardMeasurement(boat, "Draft", [{key:"Draft_ft",unit:"ft"},{key:"DraftFt",unit:"ft"}])}<br>
Air Draft: ${formatCardMeasurement(boat, "AirDraft", [{key:"AirDraft_ft",unit:"ft"}])}
</p>


`;



        container.appendChild(card);



    });



    // Attach intelligence buttons

document
.querySelectorAll(".intelligence-btn")
.forEach(button => {


    button.addEventListener("click", function(){


        const boat =
            allBoats.find(
                b => String(b.BoatModelID) === String(this.dataset.id)
            );


        if (boat) {

            showBoatDetails(boat);

        }


    });


});

    // Attach research buttons

document
.querySelectorAll(".research-btn")
.forEach(button => {


    button.addEventListener("click", function(){


        const boat = allBoats.find(b => String(b.BoatModelID) === String(this.dataset.id));
        if (boat && window.BScoutBoatWorkspace) {
            window.BScoutBoatWorkspace.open(boat, "notebook");
        } else {
            showResearchPanel(this.dataset.id);
        }


    });


});

    // Attach compare buttons

document
.querySelectorAll(".compare-btn")
.forEach(button => {


    button.addEventListener("click", function(){


        toggleCompareBoat(this.dataset.id);


    });


});


    updateCompareButtonsState();
    updateFloatingCompareButton();

}
// =====================================================
// BOAT INTELLIGENCE MODAL
// =====================================================

function showBoatDetails(boat) {

    window.BScoutWorkspaceReturnModal = "";
    if (window.BScoutBoatWorkspace && typeof window.BScoutBoatWorkspace.open === "function") {
        window.BScoutBoatWorkspace.open(boat, "overview");
        return;
    }

    const evaluation =
        calculateBScoutScore(boat);



    const modal =
        document.getElementById("boatModal");


    if (!modal) {

        console.error("Missing boatModal element");

        return;

    }



    // Title

    const title =
        document.getElementById("modalTitle");


    if (title) {

        title.innerHTML =
        [

            boat.Manufacturer,

            boat.Model,

            boat.Variant

        ]

        .filter(Boolean)

        .join(" ");

    }





    // Image

    const image =
        document.getElementById("modalImage");


    if (image) {


        image.src = ImageAssetManager.resolveBoatImage(boat);
        image.style.display = "block";
        ImageAssetManager.applyImageFallback(image);

    }





    // Score

    const modalScore =
        document.getElementById("modalScore");


    if (modalScore) {
        const searchSettings = window.BScoutSearchState ? window.BScoutSearchState.getState().searchSettings : {};
        const hasBuyerCriteria = Boolean(
            searchSettings.textSearch || searchSettings.minLength || searchSettings.maxLength || searchSettings.minBeam || searchSettings.maxBeam ||
            (searchSettings.routes || []).length || (searchSettings.styles || []).length || (searchSettings.boatFamilies || []).length || (searchSettings.configurations || []).length || (searchSettings.constructionMaterials || []).length ||
            (searchSettings.hullTypes || []).length || (searchSettings.fuels || []).length ||
            (searchSettings.propulsion || []).length || (searchSettings.engineCounts || []).length || searchSettings.twinEngines || searchSettings.flybridge || searchSettings.sideDecks ||
            searchSettings.trailerable || searchSettings.crewComposition || searchSettings.tallestCrewHeight ||
            searchSettings.guestFrequency || Object.keys(searchSettings.featurePriorities || {}).length
        );
        const section = modalScore.closest(".modal-section");
        if (section) section.style.display = hasBuyerCriteria ? "block" : "none";
        modalScore.innerHTML = hasBuyerCriteria ? `<strong>Hard-filter status:</strong> Meets all known hard filters.<br><br>${evaluation.unknowns.join("<br>") || "No key data gaps identified."}` : "";
    }







    // Overview

    const modalOverview =
        document.getElementById("modalOverview");


    if (modalOverview) {


        modalOverview.innerHTML =

        `

        Manufacturer:
        ${boat.Manufacturer || "Unknown"}

        <br>


        Years:
        ${boat.FirstYear || "?"}

        -

        ${boat.LastYear || "?"}


        <br>


        Designer:
        ${boat.Designer || "Unknown"}


        <br>


        Mission:
        ${boat.TypicalMission || "Unknown"}

        `;

    }








    // Specifications

    const modalSpecifications =
        document.getElementById("modalSpecifications");


    if (modalSpecifications) {


        modalSpecifications.innerHTML =

        `

        Length:
        ${boat.LOA_ft || "Unknown"} ft

        <br>


        Beam:
        ${boat.Beam_ft || "Unknown"} ft


        <br>


        Draft:
        ${boat.Draft_ft || "Unknown"} ft


        <br>


        Displacement:
        ${boat.Displacement_lb || "Unknown"} lb


        `;

    }








    // Configuration

    const modalConfiguration =
        document.getElementById("modalConfiguration");


    if (modalConfiguration) {


        modalConfiguration.innerHTML =

        `

        Style:
        ${boat.Style || "Unknown"}


        <br>


        Hull:
        ${boat.HullType || "Unknown"}


        <br>


        Fuel:
        ${boat.Fuel || "Unknown"}


        <br>


        Propulsion:
        ${boat.Propulsion || "Unknown"}


        <br>


        Flybridge:
        ${boat.Flybridge || "Unknown"}


        <br>


        Side Decks:
        ${boat.SideDecks || "Unknown"}


        `;


    }








    // Accommodation

    const modalAccommodation =
        document.getElementById("modalAccommodation");


    if (modalAccommodation) {


        modalAccommodation.innerHTML =

        `

        Berths:
        ${boat.Berths || "Unknown"}


        <br>


        Cabins:
        ${boat.Cabins || "Unknown"}


        <br>


        Heads:
        ${boat.Heads || "Unknown"}


        <br>


        Shower:
        ${boat.Shower || "Unknown"}


        `;


    }








    // Strengths

    const strengths =
        document.getElementById("modalStrengths");


    if (strengths) {

        strengths.innerHTML =
            boat.Strengths || "Not supplied";

    }







    // Weaknesses

    const weaknesses =
        document.getElementById("modalWeaknesses");


    if (weaknesses) {

        weaknesses.innerHTML =
            boat.Weaknesses || "Not supplied";

    }







    // Problems

    const problems =
        document.getElementById("modalProblems");


    if (problems) {

        problems.innerHTML =
            boat.CommonProblems || "Not supplied";

    }







    // Mission

    const mission =
        document.getElementById("modalMission");


    if (mission) {

        mission.innerHTML =
            boat.TypicalMission || "Not supplied";

    }







    // Avoid

    const avoid =
        document.getElementById("modalAvoid");


    if (avoid) {

        avoid.innerHTML =
            boat.AvoidIf || "Not supplied";

    }







    modal.style.display = "block";


}

// =====================================================
// SEARCH STATE & FILTERING ORCHESTRATION
// =====================================================

const searchButton = document.getElementById("searchButton");

function runCurrentSearch() {
    if (!window.BScoutSearchOrchestrator || !window.BScoutSearchState) {
        buildUserProfile();
        displayBoats(allBoats);
        return;
    }

    const result = window.BScoutSearchOrchestrator.searchFromDocument(document);
    if (currentSearchProfile) {
        currentSearchProfile.SearchSettings = result.state.searchSettings;
    }
    return result;
}

window.runCurrentSearch = runCurrentSearch;

if (searchButton) {
    searchButton.addEventListener("click", runCurrentSearch);
}

// =====================================================
// CLEAR FILTERS
// =====================================================

const clearButton = document.getElementById("clearButton");

if (clearButton) {
    clearButton.addEventListener("click", function() {
        // Clear means clear every visible search requirement and preference.
        // Do not re-apply the selected profile's saved settings.
        resetSearchControls();
        if (window.BScoutSearchState) window.BScoutSearchState.clear({ source: "clear-search" });
        setProfileDirty(Boolean(currentSearchProfile));
        updateSearchProfileSummary();
        runCurrentSearch();
    });
}

// =====================================================
// GENERAL TEXT SEARCH CONTROLS
// =====================================================

const clearTextSearch =
    document.getElementById("clearTextSearch");

if (clearTextSearch) {


    clearTextSearch.addEventListener("click", function() {


        const textSearchInput =
            document.getElementById("textSearch");


        if (textSearchInput) {

            textSearchInput.value = "";

        }


        if (searchButton) {

            searchButton.click();

        }


    });


}

const textSearchInput =
    document.getElementById("textSearch");

if (textSearchInput) {


    textSearchInput.addEventListener("keydown", function(event) {


        if (event.key === "Enter") {

            event.preventDefault();


            if (searchButton) {

                searchButton.click();

            }

        }


    });


}








// =====================================================
// MODAL CLOSE CONTROLS
// =====================================================

const closeModal =
    document.getElementById("closeModal");



if (closeModal) {


closeModal.addEventListener("click", function(){


    document

    .getElementById("boatModal")

    .style.display = "none";


});


}








// Close clicking outside modal

window.onclick = function(event){



    const modal =
        document.getElementById("boatModal");

    const researchModal =
        document.getElementById("researchModal");

    const comparisonModal =
        document.getElementById("comparisonModal");

    const rejectModal =
        document.getElementById("rejectModal");

    const rejectedBoatsModal =
        document.getElementById("rejectedBoatsModal");



    if (

        modal &&

        event.target === modal

    ) {


        modal.style.display = "none";


    }

    if (

        researchModal &&

        event.target === researchModal

    ) {


        researchModal.style.display = "none";


    }

    if (

        comparisonModal &&

        event.target === comparisonModal

    ) {


        comparisonModal.style.display = "none";


    }

    if (

        rejectModal &&

        event.target === rejectModal

    ) {


        rejectModal.style.display = "none";


    }

    if (

        rejectedBoatsModal &&

        event.target === rejectedBoatsModal

    ) {


        rejectedBoatsModal.style.display = "none";


    }


};








// Escape key closes modal

document.addEventListener(

"keydown",

function(event){



    if (

        event.key === "Escape"

    ) {


        const modal =
            document.getElementById("boatModal");

        const researchModal =
            document.getElementById("researchModal");

        const comparisonModal =
            document.getElementById("comparisonModal");

        const rejectModal =
            document.getElementById("rejectModal");

        const rejectedBoatsModal =
            document.getElementById("rejectedBoatsModal");



        if (modal) {


            modal.style.display = "none";


        }

        if (researchModal) {


            researchModal.style.display = "none";


        }

        if (comparisonModal) {


            comparisonModal.style.display = "none";


        }

        if (rejectModal) {


            rejectModal.style.display = "none";


        }

        if (rejectedBoatsModal) {


            rejectedBoatsModal.style.display = "none";


        }


    }



});


// =====================================================
// COLLAPSIBLE SECTIONS TOGGLE LOGIC
// =====================================================

document.addEventListener("DOMContentLoaded", function() {
    // Overriding the value getter/setter of Flybridge and Trailerable checkboxes
    // to map to "Yes" / "" for full backward-compatibility with userProfile.js
    const checkboxIds = ["flybridgeFilter", "trailerFilter"];
    checkboxIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            Object.defineProperty(el, 'value', {
                get() {
                    return this.checked ? "Yes" : "";
                },
                set(val) {
                    const isTrue = (val === "Yes" || val === "yes" || val === true || val === "true");
                    this.checked = isTrue;
                },
                configurable: true,
                enumerable: true
            });
        }
    });

    document.querySelectorAll(".filter-header").forEach(function(header) {
        header.addEventListener("click", function() {
            const group = header.closest(".filter-group");
            if (group) {
                group.classList.toggle("active");
            }
        });
    });
});

// =====================================================
// SEARCH PROFILE FRAMEWORK
// =====================================================

let isCurrentProfileDirty = false;

function setProfileDirty(dirty) {
    isCurrentProfileDirty = dirty;
    updateSaveButtonState();
    updateProfileDropdownVisualIndicator();
    updateSearchProfileSummary();
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById("saveProfileBtn");
    if (saveBtn) {
        saveBtn.disabled = !isCurrentProfileDirty;
    }
}

function updateProfileDropdownVisualIndicator() {
    const selectEl = document.getElementById("searchProfileSelect");
    if (!selectEl) return;

    const selectedId = selectEl.value;
    const profilesById = new Map(
        getAllSearchProfiles().map(profile => [profile.ProfileID, profile])
    );

    Array.from(selectEl.options).forEach(option => {
        if (!option.value) {
            option.textContent = "New Search (empty)";
            return;
        }

        const profile = profilesById.get(option.value);
        if (!profile) return;

        const lockedMarker = profile.Locked ? "  🔒" : "";
        const dirtyMarker = option.value === selectedId && isCurrentProfileDirty ? " *" : "";
        option.textContent = `${profile.ProfileName}${lockedMarker}${dirtyMarker}`;
    });
}

function getSavedProfiles() {
    return window.BScoutSearchProfiles
        ? window.BScoutSearchProfiles.loadUserProfiles(localStorage)
        : [];
}

function saveProfiles(profiles) {
    return window.BScoutSearchProfiles
        ? window.BScoutSearchProfiles.saveUserProfiles(profiles, localStorage)
        : localStorage.setItem("bscout_search_profiles", JSON.stringify(profiles || []));
}

function getAllSearchProfiles() {
    return window.BScoutSearchProfiles
        ? window.BScoutSearchProfiles.allProfiles(builtInSearchProfiles, localStorage)
        : getSavedProfiles();
}

function populateProfileDropdown() {
    const selectEl = document.getElementById("searchProfileSelect");
    if (!selectEl) return;
    const currentVal = selectEl.value;
    selectEl.innerHTML = '<option value="">New Search (empty)</option>';
    const all = getAllSearchProfiles();
    const builtIns = all.filter(profile => profile.Locked);
    const userProfiles = all.filter(profile => !profile.Locked);
    const appendGroup = (label, profiles) => {
        if (!profiles.length) return;
        const group = document.createElement("optgroup");
        group.label = label;
        profiles.forEach(profile => {
            const option = document.createElement("option");
            option.value = profile.ProfileID;
            option.textContent = profile.ProfileName + (profile.Locked ? "  🔒" : "");
            group.appendChild(option);
        });
        selectEl.appendChild(group);
    };
    appendGroup("Built-in Profiles", builtIns);
    appendGroup("My Profiles", userProfiles);
    if (all.some(profile => profile.ProfileID === currentVal)) selectEl.value = currentVal;
    updateProfileDropdownVisualIndicator();
}


function renderProfileManager() {
    const modal = document.getElementById("profileManagerModal");
    const builtInList = document.getElementById("builtInProfileList");
    const userList = document.getElementById("userProfileList");
    if (!modal || !builtInList || !userList) return;
    const profiles = getAllSearchProfiles();
    const builtIns = profiles.filter(profile => profile.Locked);
    const users = profiles.filter(profile => !profile.Locked);
    document.getElementById("builtInProfileCount").textContent = `(${builtIns.length})`;
    document.getElementById("userProfileCount").textContent = `(${users.length})`;

    const card = profile => {
        const actions = profile.Locked
            ? `<button type="button" data-profile-action="open" data-profile-id="${escapeHtml(profile.ProfileID)}">Open</button><button type="button" data-profile-action="duplicate" data-profile-id="${escapeHtml(profile.ProfileID)}">Duplicate</button>`
            : `<button type="button" data-profile-action="open" data-profile-id="${escapeHtml(profile.ProfileID)}">Open</button><button type="button" data-profile-action="edit" data-profile-id="${escapeHtml(profile.ProfileID)}">Edit</button><button type="button" data-profile-action="rename" data-profile-id="${escapeHtml(profile.ProfileID)}">Rename</button><button type="button" data-profile-action="duplicate" data-profile-id="${escapeHtml(profile.ProfileID)}">Duplicate</button><button type="button" class="danger-button" data-profile-action="delete" data-profile-id="${escapeHtml(profile.ProfileID)}">Delete</button>`;
        return `<article class="profile-manager-card"><div class="profile-card-icon" aria-hidden="true">${escapeHtml(profile.Icon || "search")}</div><div class="profile-card-copy"><div class="profile-card-title"><strong>${escapeHtml(profile.ProfileName)}</strong>${profile.Locked ? '<span class="locked-badge">Locked</span>' : ''}</div><p>${escapeHtml(profile.Description || "No description provided.")}</p></div><div class="profile-card-actions">${actions}</div></article>`;
    };
    builtInList.innerHTML = builtIns.map(card).join("");
    userList.innerHTML = users.length ? users.map(card).join("") : '<p class="empty-profile-message">No personal profiles yet. Duplicate a built-in profile or save a New Search.</p>';
}

function openSearchProfile(profileId, closeManager = true) {
    const selectEl = document.getElementById("searchProfileSelect");
    if (!selectEl) return;
    selectEl.value = profileId || "";
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    if (closeManager) document.getElementById("profileManagerModal")?.setAttribute("hidden", "");
}

function duplicateSearchProfile(profile) {
    if (!profile || !window.BScoutSearchProfiles) return;
    const requested = prompt("Name the duplicated Search Profile:", `${profile.ProfileName} Copy`);
    if (requested === null || !requested.trim()) return;
    const copy = window.BScoutSearchProfiles.duplicate(profile, requested.trim());
    const profiles = getSavedProfiles(); profiles.push(copy); saveProfiles(profiles);
    populateProfileDropdown(); renderProfileManager(); openSearchProfile(copy.ProfileID, false);
}

function initProfileManager() {
    const modal = document.getElementById("profileManagerModal");
    const manage = document.getElementById("manageProfilesBtn");
    const close = document.getElementById("closeProfileManagerBtn");
    if (!modal || !manage) return;
    manage.addEventListener("click", () => { renderProfileManager(); modal.removeAttribute("hidden"); });
    close?.addEventListener("click", () => modal.setAttribute("hidden", ""));
    modal.addEventListener("click", event => { if (event.target === modal) modal.setAttribute("hidden", ""); });
    modal.addEventListener("click", event => {
        const button = event.target.closest("[data-profile-action]"); if (!button) return;
        const profile = getAllSearchProfiles().find(item => item.ProfileID === button.dataset.profileId); if (!profile) return;
        const action = button.dataset.profileAction;
        if (action === "open") return openSearchProfile(profile.ProfileID);
        if (action === "duplicate") return duplicateSearchProfile(profile);
        if (profile.Locked) return alert("Built-in profiles are read-only. Duplicate the profile to edit it.");
        if (action === "edit") { openSearchProfile(profile.ProfileID); return; }
        if (action === "rename") {
            const name = prompt("Rename Search Profile:", profile.ProfileName); if (name === null || !name.trim()) return;
            const profiles = getSavedProfiles(); const index = profiles.findIndex(item => item.ProfileID === profile.ProfileID);
            profiles[index] = window.BScoutSearchProfiles.update(profiles[index], { ProfileName: name.trim() }); saveProfiles(profiles); populateProfileDropdown(); renderProfileManager(); return;
        }
        if (action === "delete") {
            if (!confirm(`Delete "${profile.ProfileName}"?`)) return;
            const updated = window.BScoutSearchProfiles.remove(getSavedProfiles(), profile.ProfileID); saveProfiles(updated);
            if (document.getElementById("searchProfileSelect")?.value === profile.ProfileID) openSearchProfile("", false);
            populateProfileDropdown(); renderProfileManager();
        }
    });
}

const BUYER_WORKSPACE_STORAGE_KEY = "bscout_buyer_workspace";
const BUYER_WORKSPACE_PROFILE_ID = "__buyer_workspace__";
let currentBuyerWorkspace = null;

const MODEL_STATUS_MIGRATION = {
    "None": "Interested",
    "Favorite": "Interested",
    "Candidate": "Shortlist",
    "Research": "Researching",
    "Evaluating": "Researching",
    "Interested": "Interested",
    "Shortlist": "Shortlist",
    "Researching": "Researching",
    "Rejected": "Rejected"
};

function normalizeModelStatus(status) {
    if (!status || status === "None") return "None";
    return MODEL_STATUS_MIGRATION[status] || status;
}

function migrateModelRelationshipStatuses(workspace) {
    if (!workspace || !Array.isArray(workspace.BoatRelationships)) return false;
    let changed = false;
    workspace.BoatRelationships.forEach(rel => {
        const normalized = normalizeModelStatus(rel.Status);
        if (rel.Status !== normalized) { rel.Status = normalized; changed = true; }
    });
    return changed;
}

function createBuyerWorkspace() {
    const nowIso = new Date().toISOString();
    return {
        ProfileID: BUYER_WORKSPACE_PROFILE_ID,
        ProfileName: "My Boats",
        Created: nowIso,
        Modified: nowIso,
        SearchSettings: {},
        BoatRelationships: [],
        Listings: [],
        DemoFleetSeeded: false
    };
}

function loadBuyerWorkspace() {
    let workspace = null;
    try {
        const raw = localStorage.getItem(BUYER_WORKSPACE_STORAGE_KEY);
        workspace = raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("Buyer workspace could not be read; using a fresh workspace.", error);
    }
    if (!workspace || typeof workspace !== "object") workspace = createBuyerWorkspace();
    workspace.ProfileID = BUYER_WORKSPACE_PROFILE_ID;
    workspace.ProfileName = "Saved Models";
    workspace.SearchSettings = {};
    if (!Array.isArray(workspace.BoatRelationships)) workspace.BoatRelationships = [];
    if (!Array.isArray(workspace.Listings)) workspace.Listings = [];

    const statusesMigrated = migrateModelRelationshipStatuses(workspace);

    // v6.7 repair: previous search-result rendering accidentally created an
    // Interested relationship for every displayed model. If a workspace is
    // clearly polluted, remove only untouched default relationships.
    let passiveRelationshipsRemoved = false;
    if (workspace.AutoSavePollutionCleanupV1 !== true && workspace.BoatRelationships.length > 40) {
        const before = workspace.BoatRelationships.length;
        const listingBoatIds = new Set((workspace.Listings || []).map(item => String(item.BoatModelID)));
        workspace.BoatRelationships = workspace.BoatRelationships.filter(rel => {
            if (!rel || rel.Status !== "Interested") return true;
            if (listingBoatIds.has(String(rel.BoatModelID))) return true;
            const research = rel.Research || {};
            const hasUserResearch = Number(research.Rating || 0) > 0 ||
                String(research.Notes || "").trim() ||
                String(research.BrokerLinks || "").trim() ||
                (String(research.Tags || "").trim() && String(research.Tags || "").trim() !== "Reference Fleet");
            const history = Array.isArray(rel.History) ? rel.History : [];
            const passiveHistory = history.length <= 1 && (!history[0] || history[0].Type === "created");
            return hasUserResearch || !passiveHistory;
        });
        passiveRelationshipsRemoved = workspace.BoatRelationships.length !== before;
        workspace.AutoSavePollutionCleanupV1 = true;
    }

    // v6.24: retire the prototype Demo Fleet. Remove only records explicitly
    // tagged as Reference Fleet so ordinary saved models are never touched.
    let demoFleetRemoved = false;
    if (workspace.DemoFleetRetiredV624 !== true) {
        const beforeDemo = workspace.BoatRelationships.length;
        workspace.BoatRelationships = workspace.BoatRelationships.filter(rel => {
            const tags = String(rel?.Research?.Tags || "");
            return !tags.split(",").map(tag => tag.trim()).includes("Reference Fleet");
        });
        demoFleetRemoved = workspace.BoatRelationships.length !== beforeDemo;
        workspace.DemoFleetRetiredV624 = true;
    }
    workspace.DemoFleetSeeded = false;

    if (statusesMigrated || passiveRelationshipsRemoved || demoFleetRemoved || workspace.AutoSavePollutionCleanupV1 === true || workspace.DemoFleetRetiredV624 === true) {
        saveBuyerWorkspace(workspace);
    }
    return workspace;
}

function saveBuyerWorkspace(workspace) {
    if (!workspace) return;
    workspace.Modified = new Date().toISOString();
    localStorage.setItem(BUYER_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

function getActiveBuyerWorkspace() {
    if (!currentBuyerWorkspace) currentBuyerWorkspace = loadBuyerWorkspace();
    return currentBuyerWorkspace;
}

function activateBuyerWorkspace(forceSearchDetach = false) {
    currentBuyerWorkspace = loadBuyerWorkspace();
    if (forceSearchDetach || !currentSearchProfile || currentSearchProfile.ProfileID === BUYER_WORKSPACE_PROFILE_ID) {
        currentSearchProfile = currentBuyerWorkspace;
    }
    return currentBuyerWorkspace;
}


function syncActiveProfile() {
    const selectEl = document.getElementById("searchProfileSelect");
    if (!selectEl || !selectEl.value) { currentSearchProfile = null; return null; }
    const profile = getAllSearchProfiles().find(item => item.ProfileID === selectEl.value);
    currentSearchProfile = profile ? JSON.parse(JSON.stringify(profile)) : null;
    return currentSearchProfile;
}

function initSearchProfiles() {
    initProfileManager();
    const selectEl = document.getElementById("searchProfileSelect");
    const newBtn = document.getElementById("newProfileBtn");
    const saveBtn = document.getElementById("saveProfileBtn");
    const renameBtn = document.getElementById("renameProfileBtn");
    const duplicateBtn = document.getElementById("duplicateProfileBtn");
    const deleteBtn = document.getElementById("deleteProfileBtn");

    if (!selectEl) return;

    // Populate initially from localStorage
    populateProfileDropdown();
    
    // Start each refresh with a clean, unbound search workspace.
    // Saved profiles load only after explicit user selection.
    selectEl.value = "";
    activateBuyerWorkspace(true);
    resetSearchControls();
    updateSearchProfileSummary();
    updateAllBoatStatusSelects();
    updateBuyerWorkspaceCounts();

    // Monitor for changes on profile select
    selectEl.addEventListener("change", function() {
        syncActiveProfile();
        applySearchSettingsToControls(currentSearchProfile?.SearchSettings || {});
        const description = document.getElementById("cruisingProfileDescription");
        if (description) description.textContent = currentSearchProfile?.Description || "New Search uses an empty filter set and does not affect My Boats.";
        const locked = Boolean(currentSearchProfile?.Locked);
        if (saveBtn) saveBtn.disabled = locked || !currentSearchProfile;
        if (renameBtn) renameBtn.disabled = locked || !currentSearchProfile;
        if (deleteBtn) deleteBtn.disabled = locked || !currentSearchProfile;
        if (duplicateBtn) duplicateBtn.disabled = !currentSearchProfile;
        setProfileDirty(false);
        runCurrentSearch();
        updateAllBoatStatusSelects();
        updateBuyerWorkspaceCounts();
    });

    // Monitor for any search control changes inside search-panel to mark as dirty
    const searchPanel = document.querySelector(".search-panel");
    if (searchPanel) {
        const handleSearchControlChange = function(e) {
            // Ignore if change is on the search profile selector itself
            if (e.target && e.target.id === "searchProfileSelect") return;
            setProfileDirty(true);
            updateSearchProfileSummary();
        };
        searchPanel.addEventListener("input", handleSearchControlChange);
        searchPanel.addEventListener("change", handleSearchControlChange);
    }

    // New Search starts with an empty filter set and leaves Buyer Workspace untouched.
    if (newBtn) {
        newBtn.addEventListener("click", function() {
            currentSearchProfile = null;
            selectEl.value = "";
            resetSearchControls();
            if (window.BScoutSearchState) window.BScoutSearchState.clear({ source: "new-search" });
            setProfileDirty(false);
            updateSearchProfileSummary();
            runCurrentSearch();
        });
    }

    // Save Button
    if (saveBtn) {
        saveBtn.addEventListener("click", function() {
            let selectedId = selectEl.value;
            if (currentSearchProfile?.Locked) { alert("Built-in profiles are read-only. Duplicate this profile to edit it."); return; }

            // Ensure settings are fully up-to-date from controls before saving.
            const currentSettings = buildUserProfile();
            const profiles = getSavedProfiles();
            let profile = profiles.find(p => p.ProfileID === selectedId);

            // A clean buyer workspace is intentionally not shown as a saved profile.
            // Saving from it creates a named profile instead of failing silently.
            if (!profile && !selectedId) {
                const requestedName = prompt("Name this Search Profile:");
                if (requestedName === null) return;
                const profileName = requestedName.trim();
                if (!profileName) {
                    alert("Profile name cannot be empty.");
                    return;
                }
                selectedId = "profile_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
                const nowIso = new Date().toISOString();
                profile = {
                    ProfileID: selectedId,
                    ProfileName: profileName,
                    Created: nowIso,
                    Modified: nowIso,
                    SearchSettings: currentSettings
                };
                profiles.push(profile);
                saveProfiles(profiles);
                populateProfileDropdown();
                selectEl.value = selectedId;
                currentSearchProfile = profile;
            }
            if (!profile) {
                alert("Selected profile not found.");
                return;
            }

            profile.SearchSettings = currentSettings;
            currentSearchProfile = profile;
            profile.Modified = new Date().toISOString();
            saveProfiles(profiles);
            
            // Clear dirty state on success
            setProfileDirty(false);
            updateSearchProfileSummary();
            
            alert(`Profile "${profile.ProfileName}" saved successfully.`);
        });
    }

    // Rename Button
    if (renameBtn) {
        renameBtn.addEventListener("click", function() {
            const selectedId = selectEl.value;
            if (selectedId === "default") {
                alert("The Default profile cannot be renamed.");
                return;
            }

            const profiles = getSavedProfiles();
            const profile = profiles.find(p => p.ProfileID === selectedId);
            if (!profile) {
                alert("Selected profile not found.");
                return;
            }

            const newName = prompt("Enter a new name for the profile:", profile.ProfileName);
            if (newName === null) return; // User cancelled
            const trimmedName = newName.trim();
            if (!trimmedName) {
                alert("Profile name cannot be empty.");
                return;
            }

            profile.ProfileName = trimmedName;
            profile.Modified = new Date().toISOString();
            saveProfiles(profiles);

            // Update dropdown and restore selection and dirty status view
            populateProfileDropdown();
            selectEl.value = selectedId;
            syncActiveProfile();
            updateProfileDropdownVisualIndicator();
        });
    }

    // Duplicate Button
    if (duplicateBtn) {
        duplicateBtn.addEventListener("click", function() {
            const selectedId = selectEl.value;
            let sourceSearchSettings = {};
            let sourceName = "Default";

            if (selectedId !== "default") {
                const profiles = getAllSearchProfiles();
                const profile = profiles.find(p => p.ProfileID === selectedId);
                if (!profile) {
                    alert("Selected profile not found.");
                    return;
                }
                sourceSearchSettings = JSON.parse(JSON.stringify(profile.SearchSettings || {}));
                sourceName = profile.ProfileName;
            }

            const newName = prompt("Enter a name for the duplicated profile:", sourceName + " Copy");
            if (newName === null) return; // User cancelled
            const trimmedName = newName.trim();
            if (!trimmedName) {
                alert("Profile name cannot be empty.");
                return;
            }

            const newProfileId = "profile_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
            const nowIso = new Date().toISOString();

            const newProfile = {
                ProfileID: newProfileId,
                ProfileName: trimmedName,
                Created: nowIso,
                Modified: nowIso,
                Description: currentSearchProfile?.Description || "",
                Icon: currentSearchProfile?.Icon || "search",
                Locked: false,
                SearchSettings: sourceSearchSettings,
                SortPreferences: currentSearchProfile?.SortPreferences || { field: null, direction: "asc" },
                DefaultLayout: currentSearchProfile?.DefaultLayout || null
            };

            const profiles = getSavedProfiles();
            profiles.push(newProfile);
            saveProfiles(profiles);

            populateProfileDropdown();
            selectEl.value = newProfileId;
            syncActiveProfile();

            // Mark duplicated profile as clean
            setProfileDirty(false);
            updateAllBoatStatusSelects();
        });
    }

    // Delete Button
    if (deleteBtn) {
        deleteBtn.addEventListener("click", function() {
            const selectedId = selectEl.value;
            if (currentSearchProfile?.Locked) { alert("Built-in profiles cannot be deleted."); return; }

            const profiles = getSavedProfiles();
            const profile = profiles.find(p => p.ProfileID === selectedId);
            if (!profile) {
                alert("Selected profile not found.");
                return;
            }

            const confirmDelete = confirm(`Are you sure you want to delete the profile "${profile.ProfileName}"?`);
            if (!confirmDelete) return;

            const updatedProfiles = profiles.filter(p => p.ProfileID !== selectedId);
            saveProfiles(updatedProfiles);

            populateProfileDropdown();
            syncActiveProfile();
            // Switched back to default, mark clean
            setProfileDirty(false);
            updateAllBoatStatusSelects();
        });
    }
}

function updateAllBoatStatusSelects() {
    const selects = document.querySelectorAll(".boat-status-select");
    selects.forEach(selectEl => {
        const boatId = selectEl.getAttribute("data-id");
        let currentStatus = "Interested";
        const workspace = getActiveBuyerWorkspace();
        if (!Array.isArray(workspace.BoatRelationships)) workspace.BoatRelationships = [];
        const rel = workspace.BoatRelationships.find(r => String(r.BoatModelID) === String(boatId));
        if (rel) currentStatus = normalizeModelStatus(rel.Status);
        selectEl.value = currentStatus;
    });
}

function getBoatRelationship(boatModelId) {
    const workspace = getActiveBuyerWorkspace();
    if (!workspace.BoatRelationships) workspace.BoatRelationships = [];
    return workspace.BoatRelationships.find(r => String(r.BoatModelID) === String(boatModelId)) || null;
}

function ensureBoatRelationship(boatModelId) {
    const workspace = getActiveBuyerWorkspace();
    if (!workspace.BoatRelationships) workspace.BoatRelationships = [];
    let rel = workspace.BoatRelationships.find(r => String(r.BoatModelID) === String(boatModelId));
    if (!rel) {
        const nowIso = new Date().toISOString();
        rel = {
            BoatModelID: boatModelId,
            Status: "Interested",
            Created: nowIso,
            LastUpdated: nowIso,
            Research: { Rating: 0, Notes: "", Tags: "", BrokerLinks: "" },
            History: [{ Type: "created", Label: "Added to Saved Models", Timestamp: nowIso }]
        };
        workspace.BoatRelationships.push(rel);
    }
    if (!rel.Created) rel.Created = new Date().toISOString();
    if (!rel.LastUpdated) rel.LastUpdated = new Date().toISOString();
    if (!Array.isArray(rel.History)) rel.History = [];
    if (!rel.Research) rel.Research = { Rating: 0, Notes: "", Tags: "", BrokerLinks: "" };
    if (rel.Research.Rating === undefined) rel.Research.Rating = 0;
    if (rel.Research.Notes === undefined) rel.Research.Notes = "";
    if (rel.Research.Tags === undefined) rel.Research.Tags = "";
    if (rel.Research.BrokerLinks === undefined) rel.Research.BrokerLinks = "";
    return rel;
}

function appendDecisionHistory(rel, type, label, detail) {
    if (!rel) return;
    if (!Array.isArray(rel.History)) rel.History = [];
    rel.History.push({
        Type: type || "update",
        Label: label || "Decision updated",
        Detail: detail || "",
        Timestamp: new Date().toISOString()
    });
}

function persistCurrentSearchProfile() {
    const workspace = getActiveBuyerWorkspace();
    saveBuyerWorkspace(workspace);
    if (!currentSearchProfile || currentSearchProfile.ProfileID === BUYER_WORKSPACE_PROFILE_ID) return;
    const profiles = getSavedProfiles();
    const existingProfileIdx = profiles.findIndex(p => p.ProfileID === currentSearchProfile.ProfileID);
    if (existingProfileIdx === -1) profiles.push(currentSearchProfile);
    else profiles[existingProfileIdx] = currentSearchProfile;
    saveProfiles(profiles);
}

window.getActiveBuyerWorkspace = getActiveBuyerWorkspace;
window.persistCurrentSearchProfile = persistCurrentSearchProfile;
window.getBoatRelationship = getBoatRelationship;

let currentResearchBoatId = null;

let notebookListingSearchCache = null;

async function renderNotebookListingSearches(boatId) {
    // v6.69: public marketplace/listing search is intentionally suppressed.
    // Saved individual listings and Add Listing remain active elsewhere in the buying workflow.
    const container = document.getElementById("notebookListingSearches");
    if (container) {
        const section = container.closest(".legacy-listing-compatibility");
        if (section) section.hidden = true;
        container.textContent = "";
    }
}

function showResearchPanel(boatId) {
    currentResearchBoatId = boatId;
    renderNotebookListingSearches(boatId);
    const boat = allBoats.find(b => String(b.BoatModelID) === String(boatId));
    if (!boat) return;

    const rel = getBoatRelationship(boatId);

    const boatNameEl = document.getElementById("researchBoatName");
    if (boatNameEl) {
        boatNameEl.textContent = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ") + (boat.Nickname ? ` ("${boat.Nickname}")` : "");
    }

    const statusEl = document.getElementById("researchBoatStatus");
    if (statusEl) {
        statusEl.textContent = STATUS_LABELS[rel.Status] || rel.Status || "Unreviewed";
    }

    const ratingEl = document.getElementById("researchRating");
    if (ratingEl) {
        ratingEl.value = rel.Research.Rating || "0";
    }

    const notesEl = document.getElementById("researchNotes");
    if (notesEl) {
        notesEl.value = rel.Research.Notes || "";
    }

    const tagsEl = document.getElementById("researchTags");
    if (tagsEl) {
        tagsEl.value = rel.Research.Tags || "";
    }

    const linksEl = document.getElementById("researchBrokerLinks");
    if (linksEl) {
        linksEl.value = rel.Research.BrokerLinks || "";
    }

    const modal = document.getElementById("researchModal");
    if (modal) {
        modal.style.display = "block";
    }
}

// Save research details
const saveResearchBtn = document.getElementById("saveResearchBtn");
if (saveResearchBtn) {
    saveResearchBtn.addEventListener("click", function() {
        if (!currentResearchBoatId) return;

        const rel = ensureBoatRelationship(currentResearchBoatId);
        
        const ratingEl = document.getElementById("researchRating");
        const notesEl = document.getElementById("researchNotes");
        const tagsEl = document.getElementById("researchTags");
        const linksEl = document.getElementById("researchBrokerLinks");

        rel.Research.Rating = ratingEl ? parseInt(ratingEl.value, 10) : 0;
        rel.Research.Notes = notesEl ? notesEl.value : "";
        rel.Research.Tags = tagsEl ? tagsEl.value : "";
        rel.Research.BrokerLinks = linksEl ? linksEl.value : "";
        
        rel.LastUpdated = new Date().toISOString();
        appendDecisionHistory(rel, "notebook", "Notebook updated", rel.Research.Tags || "Notes, rating or links changed");

        persistCurrentSearchProfile();

        // Close modal
        const modal = document.getElementById("researchModal");
        if (modal) {
            modal.style.display = "none";
        }

        // Re-render immediately without clearing the active search or filters.
        const savedScrollY = window.scrollY;
        runCurrentSearch();
        if (document.getElementById("decisionWorkspaceModal")?.style.display === "block") renderDecisionWorkspace();
        window.requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
        
        currentResearchBoatId = null;
    });
}

// Cancel research details
const cancelResearchBtn = document.getElementById("cancelResearchBtn");
if (cancelResearchBtn) {
    cancelResearchBtn.addEventListener("click", function() {
        const modal = document.getElementById("researchModal");
        if (modal) {
            modal.style.display = "none";
        }
        currentResearchBoatId = null;
    });
}

// Close research details modal with cross button
const closeResearchModal = document.getElementById("closeResearchModal");
if (closeResearchModal) {
    closeResearchModal.addEventListener("click", function() {
        const modal = document.getElementById("researchModal");
        if (modal) {
            modal.style.display = "none";
        }
        currentResearchBoatId = null;
    });
}

function updateBoatRelationship(boatModelId, status) {
    if (typeof currentSearchProfile === "undefined" || !currentSearchProfile) activateBuyerWorkspace();
    const workspace = getActiveBuyerWorkspace();
    if (!workspace.BoatRelationships) workspace.BoatRelationships = [];

    if (!status || status === "None") {
        workspace.BoatRelationships = workspace.BoatRelationships.filter(r => String(r.BoatModelID) !== String(boatModelId));
        persistCurrentSearchProfile();
        updateBuyerWorkspaceCounts();
        return;
    }

    let rel = ensureBoatRelationship(boatModelId);
    const previousStatus = normalizeModelStatus(rel.Status);
    rel.Status = status;
    rel.LastUpdated = new Date().toISOString();
    if (previousStatus !== status) {
        appendDecisionHistory(rel, "status", `Stage changed to ${STATUS_LABELS[status] || status}`, `Previously ${STATUS_LABELS[previousStatus] || previousStatus}`);
    }
    persistCurrentSearchProfile();
    updateBuyerWorkspaceCounts();
}

// Event delegation for status select change
document.addEventListener("change", function(e) {
    if (e.target && e.target.classList.contains("boat-status-select")) {
        const boatModelId = e.target.getAttribute("data-id");
        const newStatus = e.target.value;
        if (newStatus === "Rejected") {
            // Revert select visual state first, so if they cancel, it remains as before
            const rel = getBoatRelationship(boatModelId);
            e.target.value = rel ? (normalizeModelStatus(rel.Status)) : "None";
            openRejectModal(boatModelId);
        } else {
            updateBoatRelationship(boatModelId, newStatus);
            // If they change it away from Rejected, decision data would be removed if it was previously rejected.
            // But since normal displays hide rejected, they can't change it via card dropdown easily.
            // Still, it's good practice.
            if (searchButton) {
                searchButton.click();
            } else {
                displayBoats(allBoats);
            }
        }
    }
});

// =====================================================
// REJECTED BOAT MANAGEMENT LOGIC
// =====================================================

let currentRejectBoatId = null;

const STATUS_LABELS = {
    "Interested": "Interested",
    "Shortlist": "Shortlist",
    "Researching": "Researching",
    "Rejected": "Rejected"
};

function updateBuyerWorkspaceCounts() {
    const favoriteElem = document.getElementById("favoriteBoatsCount");
    const candidateElem = document.getElementById("candidateBoatsCount");
    const researchingElem = document.getElementById("researchingBoatsCount");
    const rejectedElem = document.getElementById("rejectedBoatsCount");

    let favoriteCount = 0;
    let candidateCount = 0;
    let researchingCount = 0;
    let rejectedCount = 0;

    const workspace = getActiveBuyerWorkspace();
    if (workspace && workspace.BoatRelationships) {
        workspace.BoatRelationships.forEach(r => {
            if (r.Status === "Interested") {
                favoriteCount++;
            } else if (r.Status === "Shortlist") {
                candidateCount++;
            } else if (r.Status === "Researching") {
                researchingCount++;
            } else if (r.Status === "Rejected") {
                rejectedCount++;
            }
        });
    }

    if (favoriteElem) favoriteElem.textContent = favoriteCount;
    if (candidateElem) candidateElem.textContent = candidateCount;
    if (researchingElem) researchingElem.textContent = researchingCount;
    if (rejectedElem) rejectedElem.textContent = rejectedCount;
}

function showWorkspaceStatus(status) {
    // Saved Models stages are workspace views, not search-profile results.
    // Detach the visible search profile and clear its controls without deleting it.
    const profileSelect = document.getElementById("searchProfileSelect");
    if (profileSelect) profileSelect.value = "";
    currentSearchProfile = null;
    resetSearchControls();
    setProfileDirty(false);
    updateSearchProfileSummary();
    if (window.BScoutTaxonomyRegistry && typeof window.BScoutTaxonomyRegistry.createRegistry === "function") {
        taxonomyRegistry = window.BScoutTaxonomyRegistry.createRegistry({
            fuelTypes: payload.fuelTypes,
            propulsionTypes: payload.propulsionTypes,
            hullForms: payload.hullForms,
            hullConfigurations: payload.hullConfigurations,
            styleFamilies: payload.styleFamilies
        });
        window.BScoutTaxonomy = taxonomyRegistry;
        const taxonomyIssues = allBoats.flatMap(boat => taxonomyRegistry.validateBoat(boat).map(issue => ({
            BoatModelID: boat.BoatModelID,
            ...issue
        })));
        if (taxonomyIssues.length) console.warn("Taxonomy validation requires review:", taxonomyIssues);
    }

    if (window.BScoutKnowledgeLayerRepository && typeof window.BScoutKnowledgeLayerRepository.createKnowledgeIndex === "function") {
        knowledgeLayer = window.BScoutKnowledgeLayerRepository.createKnowledgeIndex({
            facts: payload.facts,
            evidence: payload.evidence,
            contradictions: payload.contradictions,
            relationships: payload.relationships,
            knowledgeCoverage: payload.knowledgeCoverage
        });
        window.BScoutKnowledgeLayer = knowledgeLayer;
        const knowledgeValidation = window.BScoutKnowledgeLayerRepository.validateKnowledgeData({
            facts: payload.facts,
            evidence: payload.evidence,
            contradictions: payload.contradictions,
            relationships: payload.relationships,
            knowledgeCoverage: payload.knowledgeCoverage
        }, allBoats.map(boat => boat.BoatModelID));
        if (!knowledgeValidation.valid) console.warn("Knowledge Layer validation requires review:", knowledgeValidation);
    }

    if (window.BScoutSearchOrchestrator) {
        return window.BScoutSearchOrchestrator.showWorkspaceStatus(status);
    }

    const filteredBoats = allBoats.filter(boat => {
        const rel = getBoatRelationship(boat.BoatModelID);
        if (!rel) return false;
        if (status === "Researching") {
            return rel.Status === "Researching";
        }
        return rel.Status === status;
    });
    displayBoats(filteredBoats);
    return { boats: filteredBoats, count: filteredBoats.length };
}

function openRejectModal(boatId) {
    currentRejectBoatId = boatId;
    const boat = allBoats.find(b => String(b.BoatModelID) === String(boatId));
    if (!boat) return;

    const nameEl = document.getElementById("rejectModalBoatName");
    if (nameEl) {
        nameEl.textContent = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
    }

    const reasonEl = document.getElementById("rejectReason");
    if (reasonEl) {
        reasonEl.value = "";
    }

    const notesEl = document.getElementById("rejectNotes");
    if (notesEl) {
        notesEl.value = "";
    }

    const modal = document.getElementById("rejectModal");
    if (modal) {
        modal.style.display = "block";
    }
}

function rejectBoat(boatId, reason, notes) {
    getActiveBuyerWorkspace();

    let rel = getBoatRelationship(boatId);
    
    // Save previous status
    const prevStatus = normalizeModelStatus(rel.Status);
    if (prevStatus !== "Rejected") {
        rel.PreviousStatus = prevStatus;
    }
    
    // Set Status
    rel.Status = "Rejected";
    
    // Set Decision details
    rel.Decision = {
        Reason: reason,
        Notes: notes || ""
    };
    
    rel.LastUpdated = new Date().toISOString();
    appendDecisionHistory(rel, "rejected", "Boat rejected", [reason, notes].filter(Boolean).join(": "));

    // Persist
    persistCurrentSearchProfile();
    updateBuyerWorkspaceCounts();
    if (document.getElementById("decisionWorkspaceModal")?.style.display === "block") renderDecisionWorkspace();
}

function restoreBoat(boatId) {
    getActiveBuyerWorkspace();

    let rel = getBoatRelationship(boatId);
    if (!rel) return;

    const prevStatus = rel.PreviousStatus;
    if (prevStatus) {
        rel.Status = prevStatus;
    } else {
        rel.Status = "None";
    }

    // Remove Decision data and PreviousStatus
    delete rel.Decision;
    delete rel.PreviousStatus;

    rel.LastUpdated = new Date().toISOString();
    appendDecisionHistory(rel, "restored", `Restored to ${STATUS_LABELS[rel.Status] || rel.Status}`);

    // Persist to search profiles
    persistCurrentSearchProfile();

    // Update UI elements
    updateBuyerWorkspaceCounts();
    renderRejectedBoatsList();
    if (document.getElementById("decisionWorkspaceModal")?.style.display === "block") renderDecisionWorkspace();
    
    // Refresh the search view
    if (searchButton) {
        searchButton.click();
    } else {
        displayBoats(allBoats);
    }
}

function renderRejectedBoatsList() {
    const tbody = document.getElementById("rejectedBoatsTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const workspace = getActiveBuyerWorkspace();
    if (!workspace || !workspace.BoatRelationships) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No rejected boats found.</td></tr>`;
        return;
    }

    const rejectedRels = workspace.BoatRelationships.filter(r => r.Status === "Rejected");

    if (rejectedRels.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No rejected boats found.</td></tr>`;
        return;
    }

    rejectedRels.forEach(rel => {
        const boat = allBoats.find(b => String(b.BoatModelID) === String(rel.BoatModelID));
        if (!boat) return;

        const boatName = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
        const originalStatus = rel.PreviousStatus || "None";
        const reason = rel.Decision ? (rel.Decision.Reason || "") : "";
        const notes = rel.Decision ? (rel.Decision.Notes || "") : "";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${boatName}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><span class="status-badge" style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #475569;">${STATUS_LABELS[originalStatus] || originalStatus}</span></td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">${reason}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${notes}">${notes}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
                <button class="details-button restore-btn" data-id="${boat.BoatModelID}" style="padding: 6px 10px; font-size: 12px; background: #10b981; margin: 0; width: auto; display: inline-block;">Restore</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach button listeners inside table
    tbody.querySelectorAll(".restore-btn").forEach(button => {
        button.addEventListener("click", function() {
            restoreBoat(this.dataset.id);
        });
    });
}

// Hook up Reject and Rejected Boats modals controls
function initRejectControls() {
    // Save Reject button
    const saveRejectBtn = document.getElementById("saveRejectBtn");
    if (saveRejectBtn) {
        saveRejectBtn.addEventListener("click", function() {
            if (!currentRejectBoatId) return;

            const reasonEl = document.getElementById("rejectReason");
            const notesEl = document.getElementById("rejectNotes");

            const reason = reasonEl ? reasonEl.value : "";
            const notes = notesEl ? notesEl.value : "";

            if (!reason) {
                alert("Please select a reason for rejection.");
                return;
            }

            rejectBoat(currentRejectBoatId, reason, notes);

            // Close modal
            const modal = document.getElementById("rejectModal");
            if (modal) {
                modal.style.display = "none";
            }

            currentRejectBoatId = null;

            // Refresh normal view
            if (searchButton) {
                searchButton.click();
            } else {
                displayBoats(allBoats);
            }
        });
    }

    // Cancel Reject button
    const cancelRejectBtn = document.getElementById("cancelRejectBtn");
    if (cancelRejectBtn) {
        cancelRejectBtn.addEventListener("click", function() {
            const modal = document.getElementById("rejectModal");
            if (modal) {
                modal.style.display = "none";
            }
            currentRejectBoatId = null;
        });
    }

    // Close Reject Modal (X)
    const closeRejectModal = document.getElementById("closeRejectModal");
    if (closeRejectModal) {
        closeRejectModal.addEventListener("click", function() {
            const modal = document.getElementById("rejectModal");
            if (modal) {
                modal.style.display = "none";
            }
            currentRejectBoatId = null;
        });
    }

    // Buyer Workspace buttons
    const viewFavoriteBoatsBtn = document.getElementById("viewFavoriteBoatsBtn");
    if (viewFavoriteBoatsBtn) {
        viewFavoriteBoatsBtn.addEventListener("click", function() {
            showWorkspaceStatus("Interested");
        });
    }

    const viewCandidateBoatsBtn = document.getElementById("viewCandidateBoatsBtn");
    if (viewCandidateBoatsBtn) {
        viewCandidateBoatsBtn.addEventListener("click", function() {
            showWorkspaceStatus("Shortlist");
        });
    }

    const viewEvaluatingBoatsBtn = document.getElementById("viewResearchingBoatsBtn");
    if (viewEvaluatingBoatsBtn) {
        viewEvaluatingBoatsBtn.addEventListener("click", function() {
            showWorkspaceStatus("Researching");
        });
    }

    const viewRejectedBoatsBtn = document.getElementById("viewRejectedBoatsBtn");
    if (viewRejectedBoatsBtn) {
        viewRejectedBoatsBtn.addEventListener("click", function() {
            renderRejectedBoatsList();
            const modal = document.getElementById("rejectedBoatsModal");
            if (modal) {
                modal.style.display = "block";
            }
        });
    }

    // Close Rejected Boats modal (X)
    const closeRejectedBoatsModal = document.getElementById("closeRejectedBoatsModal");
    if (closeRejectedBoatsModal) {
        closeRejectedBoatsModal.addEventListener("click", function() {
            const modal = document.getElementById("rejectedBoatsModal");
            if (modal) {
                modal.style.display = "none";
            }
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRejectControls);
} else {
    initRejectControls();
}


// =====================================================
// LISTING REGISTRY — FIRST-CLASS CANDIDATE BOATS (v6.13)
// =====================================================

let activeListingId = null;
let activeListingBoatId = null;
let myBoatsListingStatus = "All";

function listingHash(value) {
    let hash = 2166136261;
    for (const ch of String(value || "")) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(36).toUpperCase();
}

function ensureProfileListings() {
    const workspace = getActiveBuyerWorkspace();
    if (!Array.isArray(workspace.Listings)) workspace.Listings = [];
    migrateLegacyListingLinks();
    return workspace.Listings;
}

function migrateLegacyListingLinks() {
    const workspace = getActiveBuyerWorkspace();
    if (!Array.isArray(workspace.BoatRelationships)) return;
    if (!Array.isArray(workspace.Listings)) workspace.Listings = [];
    const known = new Set(workspace.Listings.map(item => `${item.BoatModelID}|${item.URL}`));
    let changed = false;
    workspace.BoatRelationships.forEach(rel => {
        parseSavedListingLinks(rel.Research?.BrokerLinks).forEach((url, index) => {
            const key = `${rel.BoatModelID}|${url}`;
            if (known.has(key)) return;
            const now = new Date().toISOString();
            workspace.Listings.push({
                ListingID: `LST-${listingHash(key)}`,
                BoatModelID: rel.BoatModelID,
                URL: url,
                Title: "",
                Status: rel.Status === "Researching" ? "Evaluating" : (rel.Status === "Shortlist" ? "Candidate" : "Watching"),
                Currency: "CAD",
                Source: "Legacy saved link",
                Notes: "",
                InspectionNotes: "",
                SurveyNotes: "",
                OfferHistory: "",
                RepairEstimates: "",
                Created: now,
                LastUpdated: now,
                MigratedFromBrokerLinks: true,
                LegacyLinkIndex: index
            });
            known.add(key); changed = true;
        });
    });
    if (changed) persistCurrentSearchProfile();
}

function getListingsForBoat(boatModelId) {
    return ensureProfileListings().filter(item => String(item.BoatModelID) === String(boatModelId));
}

function getListingById(listingId) {
    return ensureProfileListings().find(item => String(item.ListingID) === String(listingId)) || null;
}

function formatListingPrice(listing) {
    const amount = Number(listing?.Price);
    if (!Number.isFinite(amount) || amount <= 0) return "Price unknown";
    const currency = listing.Currency || "CAD";
    try { return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }
    catch (_) { return `${currency} ${amount.toLocaleString("en-CA")}`; }
}

function listingDisplayTitle(listing, boat) {
    if (listing?.Title) return listing.Title;
    const model = [listing?.Year, boat?.Manufacturer, boat?.Model, boat?.Variant].filter(Boolean).join(" ");
    return model || "Specific candidate boat";
}

function openListingWorkspace(listingId, boatModelId) {
    const listing = listingId ? getListingById(listingId) : null;
    activeListingId = listing?.ListingID || null;
    activeListingBoatId = listing?.BoatModelID || boatModelId;
    const boat = allBoats.find(item => String(item.BoatModelID) === String(activeListingBoatId));
    if (!boat) return;
    const values = listing || { BoatModelID: activeListingBoatId, Status: "Watching", Currency: "CAD" };
    document.getElementById("listingWorkspaceTitle").textContent = listingDisplayTitle(values, boat);
    document.getElementById("listingWorkspaceModel").textContent = `${[boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ")} · Listing-specific information`;
    const fields = {
        listingTitle: values.Title || "", listingStatus: values.Status || "Watching", listingYear: values.Year || "",
        listingPrice: values.Price || "", listingCurrency: values.Currency || "CAD", listingLocation: values.Location || "",
        listingBroker: values.Broker || "", listingSource: values.Source || "", listingUrl: values.URL || "",
        listingNotes: values.Notes || "", listingInspection: values.InspectionNotes || "", listingSurvey: values.SurveyNotes || "",
        listingOffer: values.OfferHistory || "", listingRepairs: values.RepairEstimates || ""
    };
    Object.entries(fields).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
    const external = document.getElementById("openExternalListing");
    if (external) { external.href = values.URL || "#"; external.style.display = values.URL ? "inline-flex" : "none"; }
    const del = document.getElementById("deleteListingWorkspace"); if (del) del.style.display = listing ? "inline-flex" : "none";
    document.getElementById("listingWorkspaceModal").style.display = "block";
}

function saveListingWorkspaceRecord() {
    if (!activeListingBoatId) return;
    const listings = ensureProfileListings();
    let listing = activeListingId ? listings.find(item => item.ListingID === activeListingId) : null;
    const now = new Date().toISOString();
    if (!listing) {
        listing = { ListingID: `LST-${listingHash(`${activeListingBoatId}|${now}|${Math.random()}`)}`, BoatModelID: activeListingBoatId, Created: now };
        listings.push(listing); activeListingId = listing.ListingID;
    }
    const val = id => document.getElementById(id)?.value?.trim?.() || "";
    Object.assign(listing, {
        BoatModelID: activeListingBoatId, Title: val("listingTitle"), Status: val("listingStatus") || "Watching",
        Year: val("listingYear") ? Number(val("listingYear")) : "", Price: val("listingPrice") ? Number(val("listingPrice")) : "",
        Currency: val("listingCurrency") || "CAD", Location: val("listingLocation"), Broker: val("listingBroker"),
        Source: val("listingSource"), URL: val("listingUrl"), Notes: val("listingNotes"),
        InspectionNotes: val("listingInspection"), SurveyNotes: val("listingSurvey"), OfferHistory: val("listingOffer"),
        RepairEstimates: val("listingRepairs"), LastUpdated: now
    });
    const rel = ensureBoatRelationship(activeListingBoatId);
    if (rel && rel.Status === "Interested") rel.Status = "Shortlist";
    if (rel) { rel.LastUpdated = now; appendDecisionHistory(rel, "listing", "Candidate listing saved", listingDisplayTitle(listing, allBoats.find(b => String(b.BoatModelID) === String(activeListingBoatId)))); }
    persistCurrentSearchProfile();
    document.getElementById("listingWorkspaceStatusMessage").textContent = "Listing saved.";
    renderDecisionWorkspace();
    if (window.BScoutBoatWorkspace?.refreshActiveTab) window.BScoutBoatWorkspace.refreshActiveTab();
}

function deleteListingWorkspaceRecord() {
    if (!activeListingId) return;
    const workspace = getActiveBuyerWorkspace();
    workspace.Listings = ensureProfileListings().filter(item => item.ListingID !== activeListingId);
    persistCurrentSearchProfile();
    document.getElementById("listingWorkspaceModal").style.display = "none";
    activeListingId = null;
    renderDecisionWorkspace();
    if (window.BScoutBoatWorkspace?.refreshActiveTab) window.BScoutBoatWorkspace.refreshActiveTab();
}

if (typeof window !== "undefined") {
    window.getListingsForBoat = getListingsForBoat;
    window.openListingWorkspace = openListingWorkspace;
}

// =====================================================
// DECISION WORKSPACE
// =====================================================

let decisionWorkspaceStatus = "All";
let decisionWorkspaceSelectedBoatId = null;
const savedModelSelection = new Set();

function escapeWorkspaceHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getDecisionWorkspaceRows(status = decisionWorkspaceStatus) {
    const workspace = getActiveBuyerWorkspace();
    if (!Array.isArray(workspace.BoatRelationships)) return [];
    return workspace.BoatRelationships
        .filter(rel => rel.Status)
        .filter(rel => status === "All" || rel.Status === status)
        .map(rel => ({ rel, boat: allBoats.find(boat => String(boat.BoatModelID) === String(rel.BoatModelID)) }))
        .filter(item => item.boat)
        .sort((a, b) => new Date(b.rel.LastUpdated || 0) - new Date(a.rel.LastUpdated || 0));
}

function renderDecisionTimeline(boatId) {
    const container = document.getElementById("decisionTimeline");
    if (!container) return;
    const rel = getBoatRelationship(boatId);
    const boat = allBoats.find(item => String(item.BoatModelID) === String(boatId));
    if (!rel || !boat) {
        container.textContent = "Select a boat to view its history.";
        return;
    }
    const title = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
    let history = Array.isArray(rel.History) ? rel.History.slice() : [];
    if (!history.length && rel.Created) {
        history.push({ Label: "Added to Saved Models", Timestamp: rel.Created });
        if (rel.LastUpdated && rel.LastUpdated !== rel.Created) history.push({ Label: "Decision record updated", Timestamp: rel.LastUpdated });
    }
    history.sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));
    container.innerHTML = `<h4>${escapeWorkspaceHtml(title)}</h4>${history.length ? `<ol class="decision-timeline-list">${history.map(event => {
        const date = event.Timestamp ? new Date(event.Timestamp) : null;
        const dateLabel = date && !isNaN(date.getTime()) ? date.toLocaleString() : "Date unavailable";
        return `<li><strong>${escapeWorkspaceHtml(event.Label || "Decision updated")}</strong><span>${escapeWorkspaceHtml(event.Detail || "")}</span><time>${escapeWorkspaceHtml(dateLabel)}</time></li>`;
    }).join("")}</ol>` : "<p>No decision history recorded yet.</p>"}`;
}

function updateSavedModelBulkActions() {
    const count = savedModelSelection.size;
    const compareButton = document.getElementById("compareWorkspaceSelectionBtn");
    const moveShareButton = document.getElementById("moveShareSavedModelsBtn");
    const removeButton = document.getElementById("removeWorkspaceSelectionBtn");
    const watchButton = document.getElementById("createBoatWatchBtn");
    if (compareButton) {
        compareButton.textContent = `Compare (${count})`;
        compareButton.disabled = count < 2 || count > 4;
        compareButton.title = count > 4 ? "Compare supports up to 4 models at a time." : "";
    }
    if (moveShareButton) {
        moveShareButton.textContent = `Move / Share (${count})`;
        moveShareButton.disabled = count < 1;
    }
    if (removeButton) {
        removeButton.textContent = `Remove (${count})`;
        removeButton.disabled = count < 1;
    }
    if (watchButton) {
        watchButton.textContent = `Create Boat Watch (${count})`;
        watchButton.disabled = count < 1;
    }
    const selectAll = document.getElementById("selectAllSavedModels");
    if (selectAll) {
        const visibleIds = getDecisionWorkspaceRows().map(({boat}) => String(boat.BoatModelID));
        const selectedVisible = visibleIds.filter(id => savedModelSelection.has(id)).length;
        selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
        selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
}

function updateWorkspaceCompareButton() { updateSavedModelBulkActions(); }


function parseSavedListingLinks(value) {
    return String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function renderMyBoatsListings() {
    const container = document.getElementById("myBoatsListings");
    if (!container) return;
    const allListings = ensureProfileListings().slice().sort((a,b) => new Date(b.LastUpdated || 0) - new Date(a.LastUpdated || 0));
    const panel = container.closest(".my-boats-listings-panel");
    if (panel) panel.hidden = allListings.length === 0;
    const closedStatuses = new Set(["Rejected", "Sold", "Archived"]);
    const activeStatuses = new Set(["Watching", "Candidate", "Evaluating", "Offer"]);
    const setCount = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setCount("listingTotalCount", allListings.length);
    setCount("listingActiveCount", allListings.filter(item => activeStatuses.has(item.Status || "Watching")).length);
    setCount("listingOfferCount", allListings.filter(item => item.Status === "Offer").length);
    setCount("listingClosedCount", allListings.filter(item => closedStatuses.has(item.Status)).length);

    const listings = allListings.filter(listing => {
        if (myBoatsListingStatus === "All") return true;
        if (myBoatsListingStatus === "Closed") return closedStatuses.has(listing.Status);
        return (listing.Status || "Watching") === myBoatsListingStatus;
    });
    if (!allListings.length) {
        container.innerHTML = "";
        return;
    }
    if (!listings.length) {
        container.innerHTML = '<p class="decision-workspace-empty">No listings match this lifecycle filter.</p>';
        return;
    }
    const groups = new Map();
    listings.forEach(listing => {
        const key = String(listing.BoatModelID);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(listing);
    });
    container.innerHTML = [...groups.entries()].map(([boatId, modelListings]) => {
        const boat = allBoats.find(item => String(item.BoatModelID) === boatId);
        if (!boat) return "";
        const modelTitle = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
        return `<section class="my-boats-model-group"><header><div><span class="listing-count">${modelListings.length} listing${modelListings.length === 1 ? "" : "s"}</span><h4>${escapeWorkspaceHtml(modelTitle)}</h4></div><button type="button" class="listing-model-workspace-btn" data-id="${escapeWorkspaceHtml(boatId)}">Guide</button></header><div class="my-boats-model-listings">${modelListings.map(listing => `<article class="my-boats-listing-card">
          <div><span class="listing-source">${escapeWorkspaceHtml(listing.Source || "Saved listing")}</span><h5>${escapeWorkspaceHtml(listingDisplayTitle(listing, boat))}</h5><p>${escapeWorkspaceHtml(formatListingPrice(listing))} · ${escapeWorkspaceHtml(listing.Location || "Location unknown")} · ${escapeWorkspaceHtml(listing.Status || "Watching")}</p></div>
          <div class="listing-card-actions"><button type="button" class="open-listing-workspace-btn" data-listing-id="${escapeWorkspaceHtml(listing.ListingID)}">Listing Details</button>${listing.URL ? `<a href="${escapeWorkspaceHtml(listing.URL)}" target="_blank" rel="noopener noreferrer">Original Listing</a>` : ""}</div>
        </article>`).join("")}</div></section>`;
    }).join("");
    container.querySelectorAll(".listing-model-workspace-btn").forEach(button => button.addEventListener("click", () => {
        const boat = allBoats.find(item => String(item.BoatModelID) === String(button.dataset.id));
        if (!boat || !window.BScoutBoatWorkspace) return;
        window.BScoutWorkspaceReturnModal = "decisionWorkspaceModal";
        document.getElementById("decisionWorkspaceModal").style.display = "none";
        window.BScoutBoatWorkspace.open(boat, "listings");
    }));
    container.querySelectorAll(".open-listing-workspace-btn").forEach(button => button.addEventListener("click", () => openListingWorkspace(button.dataset.listingId)));
}

function renderDecisionWorkspace() {
    renderMyBoatsListings();
    const tbody = document.getElementById("decisionWorkspaceTableBody");
    if (!tbody) return;
    const profileLabel = document.getElementById("decisionWorkspaceProfileName");
    if (profileLabel) profileLabel.textContent = currentSearchProfile?.ProfileName || "Saved Models";
    const rows = getDecisionWorkspaceRows();
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="decision-workspace-empty">No boat models are saved at this stage.</td></tr>';
        renderDecisionTimeline(null);
        updateWorkspaceCompareButton();
        return;
    }
    tbody.innerHTML = rows.map(({ rel, boat }) => {
        const id = String(boat.BoatModelID);
        const title = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
        const rating = rel.Research?.Rating ? "★".repeat(Number(rel.Research.Rating)) : "Unrated";
        const updated = rel.LastUpdated ? new Date(rel.LastUpdated).toLocaleDateString() : "Unknown";
        return `<tr class="${decisionWorkspaceSelectedBoatId === id ? "selected" : ""}" data-workspace-boat-id="${escapeWorkspaceHtml(id)}">
            <td><input type="checkbox" class="workspace-select-checkbox" data-id="${escapeWorkspaceHtml(id)}" ${savedModelSelection.has(id) ? "checked" : ""} aria-label="Select ${escapeWorkspaceHtml(title)}"></td>
            <td><a class="workspace-boat-link" data-id="${escapeWorkspaceHtml(id)}" href="${escapeWorkspaceHtml(window.BAtlasModelURLs?.pathForBoat?.(boat) || "#")}">${escapeWorkspaceHtml(title)}</a></td>
            <td><select class="workspace-status-select" data-id="${escapeWorkspaceHtml(id)}">
                <option value="Interested" ${rel.Status === "Interested" ? "selected" : ""}>Interested</option>
                <option value="Shortlist" ${rel.Status === "Shortlist" ? "selected" : ""}>Shortlist</option>
                <option value="Researching" ${rel.Status === "Researching" ? "selected" : ""}>Researching</option>
                <option value="Rejected" ${rel.Status === "Rejected" ? "selected" : ""}>Rejected</option>
            </select></td>
            <td>${rating}</td><td>${escapeWorkspaceHtml(updated)}</td>
            <td><div class="workspace-row-actions"><button type="button" class="workspace-notebook-btn" data-id="${escapeWorkspaceHtml(id)}">Notebook</button></div></td>
        </tr>`;
    }).join("");
    tbody.querySelectorAll(".workspace-boat-link").forEach(button => button.addEventListener("click", (event) => {
        event.preventDefault();
        const boat = allBoats.find(item => String(item.BoatModelID) === String(button.dataset.id));
        if (!boat || !window.BScoutBoatWorkspace) return;
        window.BScoutWorkspaceReturnModal = "decisionWorkspaceModal";
        document.getElementById("decisionWorkspaceModal").style.display = "none";
        window.BScoutBoatWorkspace.open(boat, "overview");
    }));
    tbody.querySelectorAll(".workspace-notebook-btn").forEach(button => button.addEventListener("click", () => {
        const boat = allBoats.find(item => String(item.BoatModelID) === String(button.dataset.id));
        if (boat && window.BScoutBoatWorkspace) {
            window.BScoutWorkspaceReturnModal = "decisionWorkspaceModal";
            document.getElementById("decisionWorkspaceModal").style.display = "none";
            window.BScoutBoatWorkspace.open(boat, "notebook");
        } else {
            showResearchPanel(button.dataset.id);
        }
    }));
    tbody.querySelectorAll(".workspace-select-checkbox").forEach(input => input.addEventListener("change", () => {
        const id = String(input.dataset.id || "");
        if (input.checked) savedModelSelection.add(id); else savedModelSelection.delete(id);
        decisionWorkspaceSelectedBoatId = id || decisionWorkspaceSelectedBoatId;
        updateSavedModelBulkActions();
        renderDecisionTimeline(decisionWorkspaceSelectedBoatId);
    }));
    updateSavedModelBulkActions();
    tbody.querySelectorAll(".workspace-status-select").forEach(select => select.addEventListener("change", () => {
        const boatId = String(select.dataset.id || "");
        const nextStatus = normalizeModelStatus(select.value);
        const rel = getBoatRelationship(boatId);
        if (!rel) { renderDecisionWorkspace(); return; }
        if (nextStatus === "Rejected") {
            openRejectModal(boatId);
            select.value = normalizeModelStatus(rel.Status);
            return;
        }
        const previousStatus = normalizeModelStatus(rel.Status);
        rel.Status = nextStatus;
        rel.LastUpdated = new Date().toISOString();
        if (previousStatus !== nextStatus) {
            appendDecisionHistory(rel, "status", `Stage changed to ${STATUS_LABELS[nextStatus] || nextStatus}`, `Previously ${STATUS_LABELS[previousStatus] || previousStatus}`);
        }
        const workspace = getActiveBuyerWorkspace();
        saveBuyerWorkspace(workspace);
        if (currentSearchProfile?.ProfileID === BUYER_WORKSPACE_PROFILE_ID) currentSearchProfile = workspace;
        updateBuyerWorkspaceCounts();
        decisionWorkspaceSelectedBoatId = boatId;
        renderDecisionWorkspace();
    }));
    if (!decisionWorkspaceSelectedBoatId || !rows.some(item => String(item.boat.BoatModelID) === decisionWorkspaceSelectedBoatId)) {
        decisionWorkspaceSelectedBoatId = String(rows[0].boat.BoatModelID);
    }
    const validSavedIds = new Set((getActiveBuyerWorkspace().BoatRelationships || []).map(rel => String(rel.BoatModelID)));
    [...savedModelSelection].forEach(id => { if (!validSavedIds.has(id)) savedModelSelection.delete(id); });
    renderDecisionTimeline(decisionWorkspaceSelectedBoatId);
    updateSavedModelBulkActions();
}

function openDecisionWorkspace(options = {}) {
    renderDecisionWorkspace();
    ["lifecycleHome","discoverView","boatGuideView","guidedMatchView","contributionView","informationModal"].forEach(id => {
        const node = document.getElementById(id);
        if (!node) return;
        node.hidden = true;
        if (id === "informationModal") node.style.display = "none";
    });
    document.querySelectorAll(".modal").forEach(modal => {
        if (modal.id !== "boatWatchModal" && modal.id !== "comparisonModal" && modal.id !== "rejectModal") modal.style.display = "none";
    });
    const page = document.getElementById("decisionWorkspaceModal");
    if (page) { page.hidden = false; page.style.display = "block"; }
    if (options.history !== false && window.BScoutNavigation?.push) window.BScoutNavigation.push("saved-models");
    window.scrollTo({ top: 0, behavior: "auto" });
}

function initDecisionWorkspaceControls() {
    document.getElementById("openDecisionWorkspaceBtn")?.addEventListener("click", openDecisionWorkspace);
    document.querySelectorAll(".listing-filter-btn").forEach(button => button.addEventListener("click", () => {
        myBoatsListingStatus = button.dataset.listingStatus || "All";
        document.querySelectorAll(".listing-filter-btn").forEach(item => item.classList.toggle("active", item === button));
        renderMyBoatsListings();
    }));
    document.getElementById("closeDecisionWorkspaceModal")?.addEventListener("click", () => {
        const modal = document.getElementById("decisionWorkspaceModal");
        if (modal) modal.style.display = "none";
    });
    document.querySelectorAll(".decision-filter-btn").forEach(button => button.addEventListener("click", () => {
        decisionWorkspaceStatus = button.dataset.status || "All";
        document.querySelectorAll(".decision-filter-btn").forEach(item => item.classList.toggle("active", item === button));
        renderDecisionWorkspace();
    }));
    document.getElementById("selectAllSavedModels")?.addEventListener("change", event => {
        const ids = getDecisionWorkspaceRows().map(({boat}) => String(boat.BoatModelID));
        if (event.target.checked) ids.forEach(id => savedModelSelection.add(id));
        else ids.forEach(id => savedModelSelection.delete(id));
        renderDecisionWorkspace();
    });
    document.getElementById("removeWorkspaceSelectionBtn")?.addEventListener("click", () => {
        const ids = [...savedModelSelection];
        if (!ids.length) return;
        const label = ids.length === 1 ? "this Saved Model" : `these ${ids.length} Saved Models`;
        if (!confirm(`Remove ${label}?\n\nStage, rating, notes, tags and research history for the selected model${ids.length === 1 ? "" : "s"} will be removed. Separately saved individual listings will remain.`)) return;
        const workspace = getActiveBuyerWorkspace();
        workspace.BoatRelationships = (workspace.BoatRelationships || []).filter(rel => !savedModelSelection.has(String(rel.BoatModelID)));
        saveBuyerWorkspace(workspace);
        if (currentSearchProfile?.ProfileID === BUYER_WORKSPACE_PROFILE_ID) currentSearchProfile = workspace;
        ids.forEach(id => { boatWatchSelection.delete(id); const i = comparisonBoatIDs.indexOf(id); if (i !== -1) comparisonBoatIDs.splice(i,1); });
        savedModelSelection.clear();
        decisionWorkspaceSelectedBoatId = null;
        updateBuyerWorkspaceCounts();
        renderDecisionWorkspace();
    });
    document.getElementById("compareWorkspaceSelectionBtn")?.addEventListener("click", () => {
        const ids = [...savedModelSelection];
        if (ids.length < 2 || ids.length > 4) return;
        comparisonBoatIDs.splice(0, comparisonBoatIDs.length, ...ids);
        renderComparisonTable();
        const modal = document.getElementById("comparisonModal");
        if (modal) modal.style.display = "block";
    });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDecisionWorkspaceControls);
else initDecisionWorkspaceControls();


// =====================================================
// SAVED MODELS MOVE / SHARE — v6.72
// =====================================================
const SAVED_MODELS_TRANSFER_PREFIX = "saved-models-transfer=";
let pendingSavedModelsTransfer = null;

function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }

function base64UrlEncodeUnicode(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeUnicode(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function sanitizeTransferRelationship(rel, options = {}) {
    const research = rel?.Research || {};
    const clean = {
        BoatModelID: String(rel?.BoatModelID || ""),
        Status: normalizeModelStatus(rel?.Status || "Interested"),
        Created: rel?.Created || null,
        LastUpdated: rel?.LastUpdated || null,
        Research: {
            Rating: Number(research.Rating || 0),
            Notes: options.includeNotes ? String(research.Notes || "") : "",
            Tags: options.includeTags ? String(research.Tags || "") : "",
            BrokerLinks: ""
        }
    };
    if (options.includeHistory && Array.isArray(rel?.History)) clean.History = cloneJson(rel.History);
    return clean;
}

function getTransferRowsForScope() {
    const workspace = getActiveBuyerWorkspace();
    const rows = Array.isArray(workspace.BoatRelationships) ? workspace.BoatRelationships.filter(rel => rel?.Status) : [];
    return rows.filter(rel => savedModelSelection.has(String(rel.BoatModelID)));
}

function getSavedTransferOptions() {
    const mode = document.querySelector('input[name="savedTransferMode"]:checked')?.value || "move";
    return {
        mode,
        scope: "selected",
        includeNotes: Boolean(document.getElementById("savedTransferIncludeNotes")?.checked),
        includeTags: Boolean(document.getElementById("savedTransferIncludeTags")?.checked),
        includeHistory: Boolean(document.getElementById("savedTransferIncludeHistory")?.checked)
    };
}

function buildSavedModelsTransferPayload() {
    const options = getSavedTransferOptions();
    const relationships = getTransferRowsForScope().map(rel => sanitizeTransferRelationship(rel, options));
    return { schema: "b-atlas-saved-models-transfer", version: 1, mode: options.mode, exportedAt: new Date().toISOString(), relationships };
}

function buildSavedModelsTransferUrl() {
    const payload = buildSavedModelsTransferPayload();
    const encoded = base64UrlEncodeUnicode(JSON.stringify(payload));
    return `${window.location.origin}/saved-models/#${SAVED_MODELS_TRANSFER_PREFIX}${encoded}`;
}

function updateSavedTransferModeDefaults() {
    const mode = document.querySelector('input[name="savedTransferMode"]:checked')?.value || "move";
    const includeNotes = document.getElementById("savedTransferIncludeNotes");
    const includeTags = document.getElementById("savedTransferIncludeTags");
    const includeHistory = document.getElementById("savedTransferIncludeHistory");
    if (mode === "move") {
        if (includeNotes) includeNotes.checked = true;
        if (includeTags) includeTags.checked = true;
        if (includeHistory) includeHistory.checked = true;
    } else {
        if (includeNotes) includeNotes.checked = false;
        if (includeTags) includeTags.checked = false;
        if (includeHistory) includeHistory.checked = false;
    }
    updateSavedTransferSummary();
}

function updateSavedTransferSummary() {
    const summary = document.getElementById("savedTransferSummary");
    if (!summary) return;
    const options = getSavedTransferOptions();
    const count = getTransferRowsForScope().length;
    const fields = ["Stage", "Rating"];
    if (options.includeNotes) fields.push("My Notes");
    if (options.includeTags) fields.push("Tags");
    if (options.includeHistory) fields.push("History");
    summary.innerHTML = `<strong>${count} model${count === 1 ? "" : "s"}</strong><span>${escapeWorkspaceHtml(fields.join(" · "))}</span>`;
}

function openSavedModelsTransferBuilder() {
    const modal = document.getElementById("savedModelsTransferModal");
    const builder = document.getElementById("savedModelsTransferBuilder");
    const importer = document.getElementById("savedModelsTransferImport");
    const title = document.getElementById("savedModelsTransferTitle");
    if (builder) builder.hidden = false;
    if (importer) importer.hidden = true;
    if (title) title.textContent = "Move / Share Saved Models";
    pendingSavedModelsTransfer = null;
    updateSavedTransferModeDefaults();
    if (modal) { modal.style.display = "block"; modal.setAttribute("aria-hidden", "false"); }
}

function closeSavedModelsTransferModal() {
    const modal = document.getElementById("savedModelsTransferModal");
    if (modal) { modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
}

async function copySavedModelsTransferLink() {
    const status = document.getElementById("savedTransferStatus");
    const payload = buildSavedModelsTransferPayload();
    if (!payload.relationships.length) {
        if (status) status.textContent = "There are no Saved Models in this view to transfer.";
        return;
    }
    const url = buildSavedModelsTransferUrl();
    try {
        await navigator.clipboard.writeText(url);
        if (status) status.textContent = `Transfer link copied for ${payload.relationships.length} Saved Model${payload.relationships.length === 1 ? "" : "s"}.`;
    } catch {
        window.prompt("Copy this Saved Models transfer link:", url);
        if (status) status.textContent = "Transfer link ready to copy.";
    }
}

async function nativeShareSavedModelsTransfer() {
    const payload = buildSavedModelsTransferPayload();
    const status = document.getElementById("savedTransferStatus");
    if (!payload.relationships.length) {
        if (status) status.textContent = "There are no Saved Models in this view to share.";
        return;
    }
    const url = buildSavedModelsTransferUrl();
    if (navigator.share) {
        try { await navigator.share({ title: "B-Atlas Saved Models", text: `${payload.relationships.length} Saved Model${payload.relationships.length === 1 ? "" : "s"} from B-Atlas`, url }); }
        catch (error) { if (error?.name !== "AbortError" && status) status.textContent = "Sharing was not completed."; }
    } else {
        await copySavedModelsTransferLink();
    }
}

function validateSavedModelsTransferPayload(payload) {
    if (!payload || payload.schema !== "b-atlas-saved-models-transfer" || payload.version !== 1 || !Array.isArray(payload.relationships)) return null;
    const relationships = payload.relationships.filter(rel => rel && rel.BoatModelID).map(rel => sanitizeTransferRelationship(rel, {
        includeNotes: true, includeTags: true, includeHistory: true
    }));
    return { ...payload, relationships };
}

function renderSavedModelsTransferImport(payload) {
    const modal = document.getElementById("savedModelsTransferModal");
    const builder = document.getElementById("savedModelsTransferBuilder");
    const importer = document.getElementById("savedModelsTransferImport");
    const title = document.getElementById("savedModelsTransferTitle");
    const summary = document.getElementById("savedTransferImportSummary");
    const preview = document.getElementById("savedTransferPreview");
    if (!modal || !importer || !preview) return;
    pendingSavedModelsTransfer = payload;
    if (builder) builder.hidden = true;
    importer.hidden = false;
    if (title) title.textContent = payload.mode === "share" ? "Add Shared Saved Models" : "Move Saved Models to This Device";
    if (summary) summary.innerHTML = `<strong>${payload.relationships.length} model${payload.relationships.length === 1 ? "" : "s"} received</strong><span>Review before changing anything stored on this device.</span>`;
    preview.innerHTML = payload.relationships.map(rel => {
        const boat = allBoats.find(item => String(item.BoatModelID) === String(rel.BoatModelID));
        const titleText = boat ? [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ") : rel.BoatModelID;
        const hasNotes = Boolean(String(rel.Research?.Notes || "").trim());
        const hasTags = Boolean(String(rel.Research?.Tags || "").trim());
        return `<div class="saved-transfer-preview-row"><div><strong>${escapeWorkspaceHtml(titleText)}</strong><span>${escapeWorkspaceHtml(rel.Status || "Interested")}${rel.Research?.Rating ? ` · ${"★".repeat(Number(rel.Research.Rating))}` : ""}</span></div><small>${hasNotes ? "Notes included" : "No notes"}${hasTags ? " · Tags included" : ""}</small></div>`;
    }).join("");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
}

function clearSavedTransferFragment() {
    if (window.location.hash.startsWith(`#${SAVED_MODELS_TRANSFER_PREFIX}`)) {
        history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
    }
}

function importSavedModelsTransfer(mode) {
    const payload = pendingSavedModelsTransfer;
    if (!payload) return;
    const workspace = getActiveBuyerWorkspace();
    if (!Array.isArray(workspace.BoatRelationships)) workspace.BoatRelationships = [];
    const incoming = payload.relationships.map(cloneJson);
    if (mode === "replace") {
        workspace.BoatRelationships = incoming;
    } else {
        const byId = new Map(workspace.BoatRelationships.map(rel => [String(rel.BoatModelID), rel]));
        incoming.forEach(rel => {
            const id = String(rel.BoatModelID);
            const existing = byId.get(id);
            if (!existing) { workspace.BoatRelationships.push(rel); byId.set(id, rel); return; }
            const existingTime = new Date(existing.LastUpdated || existing.Created || 0).getTime();
            const incomingTime = new Date(rel.LastUpdated || rel.Created || 0).getTime();
            if (!Number.isFinite(existingTime) || incomingTime >= existingTime) Object.assign(existing, rel);
        });
    }
    migrateModelRelationshipStatuses(workspace);
    saveBuyerWorkspace(workspace);
    currentBuyerWorkspace = workspace;
    updateBuyerWorkspaceCounts();
    renderDecisionWorkspace();
    clearSavedTransferFragment();
    closeSavedModelsTransferModal();
    openDecisionWorkspace();
}

function detectSavedModelsTransferFromHash() {
    const hash = window.location.hash || "";
    if (!hash.startsWith(`#${SAVED_MODELS_TRANSFER_PREFIX}`)) return;
    try {
        const encoded = hash.slice(SAVED_MODELS_TRANSFER_PREFIX.length + 1);
        const payload = validateSavedModelsTransferPayload(JSON.parse(base64UrlDecodeUnicode(encoded)));
        if (!payload) throw new Error("Invalid transfer payload");
        renderSavedModelsTransferImport(payload);
    } catch (error) {
        console.warn("Saved Models transfer link could not be read.", error);
        clearSavedTransferFragment();
        alert("This Saved Models transfer link is invalid or incomplete.");
    }
}

function initSavedModelsTransferControls() {
    document.getElementById("moveShareSavedModelsBtn")?.addEventListener("click", openSavedModelsTransferBuilder);
    document.getElementById("closeSavedModelsTransferModal")?.addEventListener("click", closeSavedModelsTransferModal);
    document.getElementById("cancelSavedTransferImportBtn")?.addEventListener("click", () => { clearSavedTransferFragment(); closeSavedModelsTransferModal(); });
    document.getElementById("copySavedTransferLinkBtn")?.addEventListener("click", copySavedModelsTransferLink);
    document.getElementById("nativeShareSavedTransferBtn")?.addEventListener("click", nativeShareSavedModelsTransfer);
    document.getElementById("mergeSavedTransferBtn")?.addEventListener("click", () => importSavedModelsTransfer("merge"));
    document.getElementById("replaceSavedTransferBtn")?.addEventListener("click", () => {
        if (confirm("Replace all Saved Models on this device with the models in this transfer? Saved Listings will not be changed.")) importSavedModelsTransfer("replace");
    });
    document.querySelectorAll('input[name="savedTransferMode"]').forEach(input => input.addEventListener("change", updateSavedTransferModeDefaults));
    ["savedTransferIncludeNotes", "savedTransferIncludeTags", "savedTransferIncludeHistory"].forEach(id => document.getElementById(id)?.addEventListener("change", updateSavedTransferSummary));
    window.addEventListener("hashchange", detectSavedModelsTransferFromHash);
    if (window.location.hash.startsWith(`#${SAVED_MODELS_TRANSFER_PREFIX}`)) setTimeout(detectSavedModelsTransferFromHash, 0);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSavedModelsTransferControls);
else initSavedModelsTransferControls();

// =====================================================
// COMPARE MODELS LOGIC
// =====================================================

function toggleCompareBoat(boatId) {
    boatId = String(boatId);
    const idx = comparisonBoatIDs.indexOf(boatId);
    if (idx !== -1) {
        comparisonBoatIDs.splice(idx, 1);
    } else {
        if (comparisonBoatIDs.length >= 4) {
            alert("Maximum selection: 4 models. Please deselect another model first.");
            return;
        }
        comparisonBoatIDs.push(boatId);
    }

    // Update buttons and floating comparison controls
    updateCompareButtonsState();
    updateFloatingCompareButton();

    // Update modal if open
    const compModal = document.getElementById("comparisonModal");
    if (compModal && compModal.style.display === "block") {
        renderComparisonTable();
    }
}

window.toggleCompareBoat = toggleCompareBoat;

function updateCompareButtonsState() {
    document.querySelectorAll(".compare-btn").forEach(button => {
        const id = String(button.dataset.id);
        if (comparisonBoatIDs.includes(id)) {
            button.classList.add("selected");
            button.textContent = "Comparing";
        } else {
            button.classList.remove("selected");
            button.textContent = "Compare";
        }
    });
}

function updateFloatingCompareButton() {
    const floatBtn = document.getElementById("floatingCompareBtn");
    if (!floatBtn) return;

    const count = comparisonBoatIDs.length;
    if (count >= 2) {
        floatBtn.textContent = `Compare (${count})`;
        floatBtn.style.display = "block";
    } else {
        floatBtn.style.display = "none";
    }
    updateWorkspaceCompareButton();
}

function renderComparisonTable() {
    const table = document.getElementById("comparisonTable");
    if (!table) return;

    // Fetch selected boats
    const selectedBoats = comparisonBoatIDs.map(id => {
        return allBoats.find(b => String(b.BoatModelID) === String(id));
    }).filter(Boolean);

    if (selectedBoats.length === 0) {
        table.innerHTML = "<tr><td style='text-align: center; padding: 20px;'>No boat models selected for comparison.</td></tr>";
        return;
    }

    // Rows to build
    const rows = [
        { label: "Image / Remove", key: "header_card" },
        { label: "First Year", key: "FirstYear" },
        { label: "Last Year", key: "LastYear" },
        { label: "Search Fit Score", key: "search_fit_score" },
        { label: "Status", key: "status" },
        { label: "My Rating", key: "research_rating" },
        { label: "LOA", key: "LOA", dimension: "length", legacy: [{key:"LOA_ft",unit:"ft"}] },
        { label: "LWL", key: "LWL", dimension: "length", legacy: [{key:"LWL_ft",unit:"ft"}] },
        { label: "Beam", key: "Beam", dimension: "length", legacy: [{key:"Beam_ft",unit:"ft"}] },
        { label: "Draft", key: "Draft", dimension: "length", legacy: [{key:"Draft_ft",unit:"ft"}] },
        { label: "Air Draft", key: "AirDraft", dimension: "length", legacy: [{key:"AirDraft_ft",unit:"ft"}] },
        { label: "Displacement", key: "Displacement", dimension: "mass", legacy: [{key:"Displacement_lb",unit:"lb"}] },
        { label: "Hull Type", key: "HullType" },
        { label: "Boat Style", key: "Style" },
        { label: "Fuel Type", key: "Fuel" },
        { label: "Propulsion Type", key: "Propulsion" },
        { label: "Flybridge", key: "Flybridge" },
        { label: "Aft Cabin", key: "AftCabin" },
        { label: "Side Decks", key: "SideDecks" },
        { label: "Fuel Capacity", key: "FuelCapacity", volumeLegacy: "FuelCapacityGal" },
        { label: "Water Capacity", key: "WaterCapacity", volumeLegacy: "WaterCapacityGal" },
        { label: "Holding Capacity", key: "HoldingCapacity", volumeLegacy: "HoldingCapacityGal" },
        { label: "Berths", key: "Berths" },
        { label: "Cabins", key: "Cabins" },
        { label: "Heads", key: "Heads" },
        { label: "Shower", key: "Shower" },
        { label: "Trailerable", key: "Trailerable" },
        { label: "Best For", key: "best_for" },
        { label: "Avoid If", key: "avoid_if" },
        { label: "Inspection Focus", key: "inspection_focus" },
        { label: "My Notes", key: "research_notes" },
        { label: "Strengths", key: "Strengths" },
        { label: "Trade-offs", key: "Weaknesses" }
    ];

    let html = "";

    rows.forEach(row => {
        html += `<tr>`;
        html += `<td>${row.label}</td>`;

        selectedBoats.forEach(boat => {
            const rel = getBoatRelationship(boat.BoatModelID);
            let val = "";

            if (row.key === "header_card") {
                const title = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
                val = `
                    <div class="comparison-header-card">
                        <button class="remove-compare-btn" onclick="toggleCompareBoat('${boat.BoatModelID}')">×</button>
                        <img src="${ImageAssetManager.resolveBoatImage(boat)}" alt="${title}" onerror="ImageAssetManager.applyImageFallback(this)">
                        <h4>${title}</h4>
                    </div>
                `;
            } else if (row.key === "search_fit_score") {
                const fit = calculateFitScore(boat, currentSearchProfile ? currentSearchProfile.SearchSettings : {});
                val = `<strong>${fit.score || 100}%</strong>`;
            } else if (row.key === "status") {
                val = rel ? (STATUS_LABELS[rel.Status] || rel.Status || "Unreviewed") : "Unreviewed";
            } else if (row.key === "research_rating") {
                if (rel && rel.Research && rel.Research.Rating) {
                    val = "⭐".repeat(rel.Research.Rating);
                } else {
                    val = "Unrated";
                }
            } else if (["best_for", "avoid_if", "inspection_focus"].includes(row.key)) {
                const summary = window.BScoutIntelligenceLayer
                    ? window.BScoutIntelligenceLayer.buildModelKnowledgeSummary(boat)
                    : null;
                if (!summary) {
                    val = "Unknown";
                } else if (row.key === "best_for") {
                    val = escapeHtml(summary.bestFor || summary.positives[0] || "Unknown");
                } else if (row.key === "avoid_if") {
                    val = escapeHtml(summary.avoidIf || summary.cautions[0] || "Unknown");
                } else if (row.key === "inspection_focus") {
                    val = summary.inspectionFocus.length ? summary.inspectionFocus.map(escapeHtml).join("<br>") : "Unknown";
                }
            } else if (row.key === "research_notes") {
                if (rel && rel.Research && rel.Research.Notes) {
                    val = `<div class="comparison-notes-summary">${rel.Research.Notes}</div>`;
                } else {
                    val = "<em>No notebook notes yet</em>";
                }
            } else if (row.dimension && window.BAtlasCanonical) {
                val = window.BAtlasCanonical.formatBoatMeasurement(boat, row.key, row.dimension, row.legacy || [], "both") || "Unknown";
            } else if (row.volumeLegacy && window.BAtlasCanonical) {
                val = window.BAtlasCanonical.formatUnverifiedVolume(boat, row.key, row.volumeLegacy) || "Unknown";
            } else {
                let rawVal = boat[row.key];
                if (rawVal === undefined || rawVal === null || rawVal === "") {
                    val = "Unknown";
                } else if (typeof rawVal === "boolean") {
                    val = rawVal ? "Yes" : "No";
                } else {
                    val = rawVal + (row.suffix || "");
                }
            }

            html += `<td>${val}</td>`;
        });

        html += `</tr>`;
    });

    table.innerHTML = html;
}

// Hook up comparison modal trigger and close controls
function initComparisonControls() {
    const floatBtn = document.getElementById("floatingCompareBtn");
    if (floatBtn) {
        floatBtn.addEventListener("click", function() {
            renderComparisonTable();
            const modal = document.getElementById("comparisonModal");
            if (modal) modal.style.display = "block";
        });
    }

    const closeBtn = document.getElementById("closeComparisonModal");
    if (closeBtn) {
        closeBtn.addEventListener("click", function() {
            const modal = document.getElementById("comparisonModal");
            if (modal) modal.style.display = "none";
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initComparisonControls);
} else {
    initComparisonControls();
}


if (typeof window !== "undefined") {
    window.applySearchSettingsToControls = applySearchSettingsToControls;
    window.describeSearchProfile = describeSearchProfile;
    window.updateSearchProfileSummary = updateSearchProfileSummary;
}


// v6.13 listing workspace bindings
if (typeof document !== "undefined") {
    document.getElementById("closeListingWorkspaceModal")?.addEventListener("click", () => { document.getElementById("listingWorkspaceModal").style.display = "none"; });
    document.getElementById("saveListingWorkspace")?.addEventListener("click", saveListingWorkspaceRecord);
    document.getElementById("deleteListingWorkspace")?.addEventListener("click", deleteListingWorkspaceRecord);
    document.getElementById("listingOpenModelBtn")?.addEventListener("click", () => {
        const boat = allBoats.find(item => String(item.BoatModelID) === String(activeListingBoatId));
        document.getElementById("listingWorkspaceModal").style.display = "none";
        if (boat && window.BScoutBoatWorkspace) window.BScoutBoatWorkspace.open(boat, "overview");
    });
}

// v6.64 display units are always Imperial / Metric. Plan input units remain explicit at the input context.
// Ownership bridge: expose current listing context without changing listing behaviour.
if (typeof window !== "undefined") {
    Object.defineProperty(window, "activeListingId", { configurable: true, get: () => activeListingId });
    Object.defineProperty(window, "activeListingBoatId", { configurable: true, get: () => activeListingBoatId });
    window.getListingById = getListingById;
    window.saveListingWorkspaceRecord = saveListingWorkspaceRecord;
}

// =====================================================
// v6.70 — B-ATLAS BOAT WATCH
// =====================================================
const boatWatchSelection = new Set();

function getBoatWatchSelectedBoats() {
    return Array.from(boatWatchSelection).map(id => allBoats.find(boat => String(boat.BoatModelID) === String(id))).filter(Boolean);
}
function updateBoatWatchButton() {
    const button = document.getElementById("createBoatWatchBtn");
    if (!button) return;
    button.textContent = `Create Boat Watch (${boatWatchSelection.size})`;
    button.disabled = boatWatchSelection.size === 0;
}
function buildBoatWatchPrompt() {
    const boats = getBoatWatchSelectedBoats();
    const area = document.getElementById("boatWatchArea")?.value.trim() || "Canada and the United States";
    const price = document.getElementById("boatWatchPrice")?.value.trim();
    const requirements = document.getElementById("boatWatchRequirements")?.value.trim();
    const modelLines = boats.map(boat => {
        const name = [boat.Manufacturer, boat.Model, boat.Variant].filter(Boolean).join(" ");
        const url = window.BAtlasModelURLs?.absoluteURL ? window.BAtlasModelURLs.absoluteURL(boat) : (boat.CanonicalURL || "");
        return `- ${name}${url ? ` — B-Atlas reference: ${url}` : ""}`;
    }).join("\n");
    return `Create a recurring Boat Watch for the following boat models and notify me when a genuinely new qualifying listing appears for sale.\n\nMODELS TO WATCH\n${modelLines}\n\nSEARCH AREA\n${area}\n${price ? `\nMAXIMUM PRICE\n${price}\n` : ""}${requirements ? `\nADDITIONAL REQUIREMENTS\n${requirements}\n` : ""}\nSEARCH INSTRUCTIONS\nSearch public dealer sites, brokerages, marketplaces, classifieds and other publicly accessible boat-for-sale sources. Account for reasonable model-name variations, aliases, punctuation and listings that omit a variant name when the boat can still reasonably be identified as one of the requested models.\n\nUse the B-Atlas model links above as identification references, not as listing sources. Do not reject a potentially relevant listing merely because specifications are missing. Missing information means unknown, not unsuitable. Reject only when known information clearly conflicts with the requested model or a stated hard requirement.\n\nDeduplicate listings that appear on multiple sites. Remember listings already reported and notify me only about genuinely new candidates or a meaningful change to an existing candidate, such as a substantial price reduction or relisting.\n\nFor each candidate report: model, year if known, asking price and currency, location, source, direct listing URL, date found, and a short note explaining any identification uncertainty or important missing information.\n\nRun this as a recurring monitoring task. Daily checking is sufficient unless I specify otherwise. If no new qualifying listing is found, do not notify me.`;
}
function refreshBoatWatchPrompt() {
    const field = document.getElementById("boatWatchPrompt");
    if (field) field.value = buildBoatWatchPrompt();
}
async function copyBoatWatchPrompt() {
    refreshBoatWatchPrompt();
    const prompt = document.getElementById("boatWatchPrompt")?.value || "";
    try { await navigator.clipboard.writeText(prompt); return true; }
    catch (_) {
        const field = document.getElementById("boatWatchPrompt");
        field?.focus(); field?.select();
        return document.execCommand("copy");
    }
}
function openBoatWatchModal() {
    if (document.getElementById("decisionWorkspaceModal") && !document.getElementById("decisionWorkspaceModal").hidden) {
        boatWatchSelection.clear();
        savedModelSelection.forEach(id => boatWatchSelection.add(id));
    }
    refreshBoatWatchPrompt();
    const modal = document.getElementById("boatWatchModal");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    // On compact screens the Saved Models modal can otherwise remain the active
    // visual layer in Chromium. Boat Watch receives focus and its own overlay.
    requestAnimationFrame(() => {
        const firstField = document.getElementById("boatWatchArea");
        if (firstField && window.matchMedia?.("(max-width: 760px)").matches) firstField.focus({ preventScroll: true });
    });
}
function closeBoatWatchModal() {
    const modal = document.getElementById("boatWatchModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}
function bindBoatWatchControls() {
    document.getElementById("closeBoatWatchModal")?.addEventListener("click", closeBoatWatchModal);
    ["boatWatchArea","boatWatchPrice","boatWatchRequirements"].forEach(id => document.getElementById(id)?.addEventListener("input", refreshBoatWatchPrompt));
    document.getElementById("boatWatchCopy")?.addEventListener("click", async () => {
        const ok = await copyBoatWatchPrompt();
        document.getElementById("boatWatchStatus").textContent = ok ? "Boat Watch instructions copied. Paste them into your preferred AI." : "Select and copy the monitoring instructions manually.";
    });
    document.getElementById("boatWatchChatGPT")?.addEventListener("click", async () => {
        const ok = await copyBoatWatchPrompt();
        document.getElementById("boatWatchStatus").textContent = ok ? "Instructions copied. Paste them into ChatGPT and confirm the recurring task." : "Copy the instructions, then paste them into ChatGPT.";
        window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    });
}

// Bind immediately when scripts are loaded at the end of the document, and also
// retain a DOMContentLoaded fallback for alternate embedding/deployment paths.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindBoatWatchControls, { once: true });
else bindBoatWatchControls();

// Delegated fallback protects the dynamically refreshed Saved Models workspace
// on mobile browsers even if a direct listener is lost during a future render.
document.addEventListener("click", event => {
    const trigger = event.target.closest?.("#createBoatWatchBtn");
    if (!trigger || trigger.disabled) return;
    event.preventDefault();
    openBoatWatchModal();
});
