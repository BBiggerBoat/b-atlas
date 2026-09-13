/**
 * B-Atlas Boat Knowledge Layer
 * Converts raw BoatModels data into derived characteristics.
 * This layer does not implement scoring, mission fit, or UI.
 * 
 * Principle:
 * - Raw database values remain unchanged.
 * - Missing data remains unknown (never invent fallback values).
 * - Unknown information reduces confidence only.
 */

/**
 * Calculates platform size category based on the boat's Length Overall (LOA).
 * @param {Object} boat - The raw boat model object
 * @returns {string} One of: 'Pocket', 'Compact', 'Moderate', 'Spacious', 'Large', or 'Unknown'
 */
function canonicalFeet(boat, field) {
    if (!boat) return null;
    if (typeof BAtlasCanonical !== "undefined" && BAtlasCanonical) return BAtlasCanonical.feet(boat, field, []);
    const metres = Number(boat[field]);
    return Number.isFinite(metres) && metres > 0 ? metres / 0.3048 : null;
}

function calculatePlatformSize(boat) {
    const loa = canonicalFeet(boat, "LOA");
    if (loa === null) {
        return "Unknown";
    }
    if (loa < 27) {
        return "Pocket";
    } else if (loa < 35) {
        return "Compact";
    } else if (loa < 43) {
        return "Moderate";
    } else if (loa < 50) {
        return "Spacious";
    } else {
        return "Large";
    }
}

/**
 * Calculates theoretical displacement hull speed in knots.
 * Formula: 1.34 * sqrt(LWL)
 * @param {Object} boat - The raw boat model object
 * @returns {number|null} Theoretical hull speed in knots, or null if LWL does not exist
 */
function calculateHullSpeed(boat) {
    const lwl = canonicalFeet(boat, "LWL");
    if (lwl === null) return null;
    return parseFloat((1.34 * Math.sqrt(lwl)).toFixed(2));
}

/**
 * Categorizes speed capability based on HullType.
 * @param {Object} boat - The raw boat model object
 * @returns {string} One of: 'Slow', 'Moderate', 'Fast', or 'Unknown'
 */
function calculateSpeedCategory(boat) {
    if (!boat || !boat.HullType || typeof boat.HullType !== 'string') {
        return "Unknown";
    }
    const hullType = boat.HullType.trim().toLowerCase();
    if (hullType === "displacement") {
        return "Slow";
    } else if (hullType === "semi-displacement") {
        return "Moderate";
    } else if (hullType === "planing") {
        return "Fast";
    }
    return "Unknown";
}

/**
 * Calculates data confidence percentage based on the completeness of key fields.
 * Missing information reduces confidence.
 * @param {Object} boat - The raw boat model object
 * @returns {number} Confidence score as an integer percentage (0 to 100)
 */
function calculateDataConfidence(boat) {
    if (!boat) {
        return 0;
    }

    // List of key database fields used across B-Atlas for scoring and analysis
    const trackingFields = [
        "LOA", "LWL", "Beam", "Draft", "AirDraft", "Displacement",
        "HullType", "Fuel", "Propulsion", "FuelCapacity", "WaterCapacity",
        "HoldingCapacity", "Berths", "Cabins", "Heads"
    ];

    let presentCount = 0;
    trackingFields.forEach(field => {
        const val = boat[field];
        if (val !== undefined && val !== null && val !== "" && val !== 0 && val !== false) presentCount++;
    });

    return Math.round((presentCount / trackingFields.length) * 100);
}

/**
 * Aggregates raw boat data into a derived intelligence object.
 * @param {Object} boat - The raw boat model object
 * @returns {Object} Derived boat intelligence characteristics
 */
function calculateBoatIntelligence(boat) {
    return {
        PlatformSizeCategory: calculatePlatformSize(boat),
        HullSpeed: calculateHullSpeed(boat),
        SpeedCategory: calculateSpeedCategory(boat),
        Confidence: calculateDataConfidence(boat)
    };
}

/**
 * Renders the Evaluation section based on recommendation evaluations.
 * 
 * Design Principles:
 * - Evaluation rendering is intentionally separated from evaluation logic.
 * - Evaluators produce evidence.
 * - Boat Knowledge only displays evidence.
 * - The function loops dynamically over every Evaluation Result to remain fully generic.
 * 
 * @param {Object} recommendation - The recommendation object containing evaluation results in evaluationContext
 * @returns {string} The generated HTML string for the evaluation content
 */
function renderEvaluationSection(recommendation) {
    let evaluations = [];
    if (recommendation && recommendation.evaluationContext && Array.isArray(recommendation.evaluationContext.evaluations)) {
        evaluations = recommendation.evaluationContext.evaluations;
    }

    if (evaluations.length === 0) {
        return "No evaluations available.";
    }

    const REQUIREMENT_DISPLAY_NAMES = {
        "Required": "Required",
        "Preferred": "Preferred",
        "No Requirement": "No Requirement"
    };

    const content = evaluations.map(ev => {
        const feature = ev.feature || "Unknown";
        const status = ev.status || "Unknown";
        const requirementKey = ev.requirement || "No Requirement";
        const requirementDisplay = REQUIREMENT_DISPLAY_NAMES[requirementKey] || requirementKey;
        const explanation = ev.reason || "No explanation available.";

        return `
            <br>
            <strong>${feature}</strong>
            <br><br>
            Status:<br>${status}
            <br><br>
            Requirement:<br>${requirementDisplay}
            <br><br>
            Explanation:<br>${explanation}
            <br>
        `;
    }).join("");

    return content;
}

/**
 * Renders the B-Atlas Assessment section from the Decision Report.
 * @param {Object} decisionReport - The decision report attached to recommendation
 * @returns {string} Generated HTML string
 */
function renderDecisionReportSection(decisionReport) {
    if (!decisionReport) {
        return "No assessment available.";
    }

    let html = "";

    // Matches
    if (Array.isArray(decisionReport.matches) && decisionReport.matches.length > 0) {
        html += `
            <div style="margin-bottom: 15px;">
                <strong style="display: block; margin-bottom: 5px;">Matches</strong>
                ${decisionReport.matches.map(m => `
                    <div style="margin-bottom: 10px;">
                        ✓ ${m.feature}:<br>
                        ${m.explanation}
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Conflicts
    if (Array.isArray(decisionReport.conflicts) && decisionReport.conflicts.length > 0) {
        html += `
            <div style="margin-bottom: 15px;">
                <strong style="display: block; margin-bottom: 5px;">Conflicts</strong>
                ${decisionReport.conflicts.map(c => `
                    <div style="margin-bottom: 10px;">
                        ! ${c.feature}:<br>
                        ${c.explanation}
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Unknowns
    if (Array.isArray(decisionReport.unknowns) && decisionReport.unknowns.length > 0) {
        // Future:
        // Add "Update Data Specification" action here.
        html += `
            <!-- Future: Add "Update Data Specification" action here. -->
            <div style="margin-bottom: 15px;">
                <strong style="display: block; margin-bottom: 5px;">Needs Verification</strong>
                <div style="margin-bottom: 10px; font-style: italic;">
                    Potential candidate. Verify information before proceeding.
                </div>
                ${decisionReport.unknowns.map(u => `
                    <div style="margin-bottom: 10px;">
                        ? ${u.feature}:<br>
                        ${u.explanation}
                    </div>
                `).join('')}
            </div>
        `;
    }

    return html;
}

// Expose functions globally for script loaders and console testing
window.calculatePlatformSize = calculatePlatformSize;
window.calculateHullSpeed = calculateHullSpeed;
window.calculateSpeedCategory = calculateSpeedCategory;
window.calculateDataConfidence = calculateDataConfidence;
window.calculateBoatIntelligence = calculateBoatIntelligence;
window.renderEvaluationSection = renderEvaluationSection;
window.renderDecisionReportSection = renderDecisionReportSection;

// Native event listener for the streamlined Boat Knowledge modal.
// The Community Preview intentionally presents one concise B-Atlas overview
// followed by the curated Knowledge Card. Detailed specifications, configuration,
// accommodation and raw evaluation output remain available to the engines but are
// no longer repeated in the user-facing modal.
if (typeof window !== "undefined" && typeof document !== "undefined") {
    document.addEventListener("click", (event) => {
        const btn = event.target.closest(".intelligence-btn");
        if (!btn) return;

        try {
            const boatId = btn.dataset.id;
            if (typeof allBoats === "undefined" || !Array.isArray(allBoats)) return;
            const boat = allBoats.find(item => String(item.BoatModelID) === String(boatId));
            if (!boat) return;

            const guidanceContent = document.getElementById("modalBuyerGuidanceContent");
            const knowledgeContent = document.getElementById("modalKnowledgeContent");
            if (guidanceContent) {
                guidanceContent.innerHTML = "Preparing model overview…";
                guidanceContent.dataset.boatId = String(boatId);
            }
            if (knowledgeContent) {
                knowledgeContent.dataset.boatId = String(boatId);
                knowledgeContent.innerHTML = window.BScoutKnowledgeUI
                    ? window.BScoutKnowledgeUI.renderLoadingState()
                    : "Knowledge Card unavailable.";
            }

            let recommendation = null;
            if (typeof window.evaluateBoatForProfile === "function") {
                const activeProfile = window.currentSearchProfile || {};
                recommendation = window.evaluateBoatForProfile(boat, null, activeProfile, null);
                if (guidanceContent && window.BScoutIntelligenceLayer) {
                    const guidance = window.BScoutIntelligenceLayer.buildBuyerIntelligence(boat, recommendation, null);
                    guidanceContent.innerHTML = window.BScoutIntelligenceLayer.renderBuyerIntelligence(guidance);
                }
            } else if (guidanceContent) {
                guidanceContent.innerHTML = "Model overview unavailable.";
            }

            if (window.BScoutKnowledgeUI && knowledgeContent) {
                window.BScoutKnowledgeUI.loadCardForBoat(boat)
                    .then(card => {
                        if (String(knowledgeContent.dataset.boatId || boatId) !== String(boatId)) return;
                        knowledgeContent.innerHTML = window.BScoutKnowledgeUI.renderKnowledgeCard(card, boat);
                        if (guidanceContent && recommendation && window.BScoutIntelligenceLayer &&
                            String(guidanceContent.dataset.boatId || boatId) === String(boatId)) {
                            const guidance = window.BScoutIntelligenceLayer.buildBuyerIntelligence(boat, recommendation, card);
                            guidanceContent.innerHTML = window.BScoutIntelligenceLayer.renderBuyerIntelligence(guidance);
                        }
                    })
                    .catch(error => {
                        console.error("Error loading Knowledge Card:", error);
                        knowledgeContent.innerHTML = window.BScoutKnowledgeUI.renderErrorState();
                    });
            }
        } catch (error) {
            console.error("Error rendering Boat Knowledge:", error);
            const guidanceContent = document.getElementById("modalBuyerGuidanceContent");
            const knowledgeContent = document.getElementById("modalKnowledgeContent");
            if (guidanceContent) guidanceContent.innerHTML = "Model overview unavailable.";
            if (knowledgeContent) {
                knowledgeContent.innerHTML = window.BScoutKnowledgeUI
                    ? window.BScoutKnowledgeUI.renderErrorState()
                    : "Knowledge Card unavailable.";
            }
        }
    });
}
