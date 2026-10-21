/**
 * B-Atlas Intelligence Layer
 *
 * Synthesizes existing structured engine outputs into concise buyer guidance.
 * It does not evaluate boats, infer missing specifications, or introduce facts.
 */

const INTELLIGENCE_CONFIDENCE_LABELS = {
    High: "High",
    Medium: "Medium",
    Low: "Low"
};

function intelligenceEscapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function firstItem(items) {
    return normalizeArray(items)[0] || null;
}


function cleanKnownValue(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === "unknown" || text.toLowerCase() === "not specified") return null;
    return text;
}

function buildBoatName(boat) {
    const nickname = cleanKnownValue(boat && boat.Nickname);
    if (nickname) return nickname;
    const parts = [
        cleanKnownValue(boat && (boat.Manufacturer || boat.Make)),
        cleanKnownValue(boat && boat.Model),
        cleanKnownValue(boat && boat.Variant)
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : "This boat";
}

function buildRecordedCharacteristics(boat) {
    if (!boat) return [];
    const facts = [];
    const fuel = cleanKnownValue(boat.Fuel);
    const hull = cleanKnownValue(boat.HullType || boat.NormalizedHullType);
    const style = cleanKnownValue(boat.Style || boat.NormalizedStyle);
    const propulsion = cleanKnownValue(boat.Propulsion);
    const sideDecks = cleanKnownValue(boat.SideDecks);

    if (fuel) facts.push({ feature: "Power", text: `${fuel} power is recorded for this model.` });
    if (hull) facts.push({ feature: "Hull", text: `${hull} hull form is recorded.` });
    else if (style) facts.push({ feature: "Design", text: `${style} design is recorded.` });
    if (propulsion) facts.push({ feature: "Propulsion", text: `${propulsion} propulsion is recorded.` });
    if (sideDecks) facts.push({ feature: "Deck access", text: `${sideDecks} side decks are recorded.` });

    return facts;
}

function buildConfidenceExplanation(decisionReport, recommendation) {
    const score = decisionReport?.confidence ?? null;
    const label = decisionReport?.confidenceLevel || 'Not assessed';
    return {score,label,explanation:decisionReport?.assessment?.confidenceExplanation || 'No buyer assessment is available.'};
}

function buildRouteStatement(recommendation) {
    const route = recommendation && recommendation.routeCompatibility;
    if (!route || route.status === "Unknown") {
        return null;
    }
    const warnings = normalizeArray(route.warnings);
    if (route.status === "Fail") {
        return warnings.length > 0
            ? `Known route conflict: ${warnings[0]}`
            : "A known route limit is exceeded.";
    }
    return warnings.length === 0
        ? "No known selected-route limit is exceeded."
        : warnings[0];
}

function buildKnowledgeStatement(knowledgeCard) {
    if (!knowledgeCard) return null;
    const available = [];
    if (normalizeArray(knowledgeCard.videos).length) available.push("videos");
    if (normalizeArray(knowledgeCard.listings).length) available.push("listing searches");
    if (normalizeArray(knowledgeCard.documents).length) available.push("documents");
    if (normalizeArray(knowledgeCard.ownerCommunities).length) available.push("owner communities");
    if (available.length === 0) return "No curated research resources are available yet.";
    return `Research support is available through ${available.join(", ")}.`;
}


function firstSentence(value, fallback = null) {
    const text = cleanKnownValue(value);
    if (!text) return fallback;
    const match = text.match(/^(.+?[.!?])(?:\s|$)/);
    return (match ? match[1] : text).trim();
}

function normalizeResearchConfidence(boat) {
    const candidates = [boat && boat.DataConfidence];
    for (const candidate of candidates) {
        const value = cleanKnownValue(candidate);
        if (!value) continue;
        if (/^high$/i.test(value)) return "High";
        if (/^(medium|moderate)$/i.test(value)) return "Moderate";
        if (/^low$/i.test(value)) return "Low";
    }

    return "Unknown";
}

function splitGuidance(value, limit = 5) {
    const text = cleanKnownValue(value);
    if (!text) return [];
    return text
        .split(/(?:\r?\n|;|,|\s+•\s+|\s+\|\s+)/)
        .map(item => item.trim().replace(/^[-•]\s*/, ""))
        .filter(Boolean)
        .slice(0, limit);
}

function buildMissionBadges(boat) {
    const source = cleanKnownValue(boat && (boat.BestFor || boat.TypicalMission));
    if (!source) return [];
    const candidates = source.split(/[,;/]|\band\b/i).map(item => item.trim()).filter(Boolean);
    const badges = [];
    for (const candidate of candidates) {
        const normalized = candidate
            .replace(/\bwith .*$/i, "")
            .replace(/\bdependent on .*$/i, "")
            .replace(/\bsuitability .*$/i, "")
            .trim();
        if (normalized.length < 3 || normalized.length > 42) continue;
        const label = normalized.replace(/\b\w/g, c => c.toUpperCase());
        if (!badges.some(item => item.toLowerCase() === label.toLowerCase())) badges.push(label);
        if (badges.length === 4) break;
    }
    return badges;
}

function buildOwnershipComplexity(boat) {
    if (!boat) return { label: "Unknown", explanation: "Ownership demands have not been documented." };
    const evidence = [boat.Weaknesses, boat.CommonProblems, boat.OwnerExperienceNotes, boat.Construction, boat.Propulsion, boat.EngineConfiguration]
        .map(cleanKnownValue).filter(Boolean).join(" ").toLowerCase();
    if (!evidence) return { label: "Unknown", explanation: "Ownership demands have not been documented." };

    let points = 0;
    const advancedTerms = [/extensive.*teak/, /steel hull/, /wood hull/, /aging systems/, /tank replacement/, /stabilizer/, /complex systems/, /triple outboard/, /twin.*diesel/, /v-drive/];
    const moderateTerms = [/teak/, /stern.?drive/, /twin/, /outboard/, /window leaks?/, /deck core/, /fuel tanks?/, /electrical/, /corrosion/];
    advancedTerms.forEach(pattern => { if (pattern.test(evidence)) points += 2; });
    moderateTerms.forEach(pattern => { if (pattern.test(evidence)) points += 1; });

    if (points >= 6) return { label: "Enthusiast", explanation: "Recorded systems and maintenance notes indicate a substantial ownership commitment." };
    if (points >= 3) return { label: "Advanced", explanation: "Recorded systems and maintenance notes indicate above-average upkeep or technical demands." };
    if (points >= 1) return { label: "Moderate", explanation: "Some model-specific upkeep or system complexity is documented." };
    return { label: "Easy", explanation: "The available model notes do not identify unusual ownership complexity." };
}

function buildConfidenceBasis(boat, inspectionFocus) {
    const basis = [];
    const status = String(boat && boat.ResearchStatus || "").toLowerCase();
    if (status.includes("reviewed")) basis.push("Reviewed model research");
    if (cleanKnownValue(boat && boat.Strengths) || cleanKnownValue(boat && boat.Weaknesses)) basis.push("Recorded strengths and trade-offs");
    if (inspectionFocus.length) basis.push("Model-specific inspection notes");
    if (cleanKnownValue(boat && boat.ResearchNotes)) basis.push("Research notes");
    return basis.slice(0, 4);
}


function normalizeAvailabilityLabel(value) {
    const text = cleanKnownValue(value);
    if (!text) return "Unknown";
    const lower = text.toLowerCase();
    if (/very\s+rare|extremely\s+rare|exceptionally\s+rare/.test(lower)) return "Very Rare";
    if (/\brare\b|scarce|limited/.test(lower)) return "Rare";
    if (/occasional|periodic|sometimes|varies/.test(lower)) return "Occasional";
    if (/common|regularly appears|widely available|frequent/.test(lower)) return "Common";
    if (/unknown|not documented|not established/.test(lower)) return "Unknown";
    return "Unknown";
}

function buildBrokerDiscovery(boat) {
    if (!boat) return { query: "", aliases: [], groups: [], sourceCount: 0, curatedCount: 0 };
    const make = cleanKnownValue(boat.Manufacturer || boat.Make);
    const model = cleanKnownValue(boat.Model);
    const variant = cleanKnownValue(boat.Variant);
    const fallbackCanonical = [make, model, variant].filter(Boolean).join(" ").trim();
    if (!fallbackCanonical) return { query: "", aliases: [], groups: [], sourceCount: 0, curatedCount: 0 };

    const searchRecord = (Array.isArray(globalThis.BScoutModelSearchAliases) ? globalThis.BScoutModelSearchAliases : [])
        .find(item => item && item.BoatModelID === boat.BoatModelID) || null;
    const registryBoat = globalThis.BScoutRegistry && typeof globalThis.BScoutRegistry.getBoat === "function"
        ? globalThis.BScoutRegistry.getBoat(boat.BoatModelID) : null;

    const manufacturerTerms = [...new Set([
        ...(Array.isArray(searchRecord?.ManufacturerTerms) ? searchRecord.ManufacturerTerms : []),
        make
    ].map(value => String(value || "").trim()).filter(Boolean))];
    const modelTerms = [...new Set([
        ...(Array.isArray(searchRecord?.ModelTerms) ? searchRecord.ModelTerms : []),
        [model, variant].filter(Boolean).join(" "),
        model
    ].map(value => String(value || "").trim()).filter(Boolean))];
    const canonical = cleanKnownValue(searchRecord?.CanonicalName) || fallbackCanonical;
    const aliases = [...new Set([
        canonical,
        ...manufacturerTerms.flatMap(manufacturer => modelTerms.map(modelTerm => `${manufacturer} ${modelTerm}`)),
        ...(Array.isArray(registryBoat?.Aliases) ? registryBoat.Aliases : [])
    ].map(value => String(value || "").trim()).filter(Boolean))].slice(0, 12);

    const primaryMake = manufacturerTerms[0] || make;
    const sourceModelTerms = searchRecord && searchRecord.SourceModelTerms && typeof searchRecord.SourceModelTerms === "object"
        ? searchRecord.SourceModelTerms : {};
    const encoded = value => encodeURIComponent(String(value || "").trim());
    const slug = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    function sourceDestination(source) {
        const sourceId = String(source.SourceID || "");
        const capability = source.SearchCapability === "DirectModelSearch" ? "DirectModelSearch" : "BrowseInventory";
        if (capability !== "DirectModelSearch") {
            return { url: source.InventoryURL || "", action: "Browse inventory", capability };
        }
        const searchModel = cleanKnownValue(sourceModelTerms[sourceId]) || modelTerms[0] || model;
        const country = source.Country === "Canada" ? "canada" : "united-states";
        if (sourceId === "BOATS_COM_CA") {
            return { url: `https://ca.boats.com/boats-for-sale/?country=canada&make=${encoded(primaryMake)}&model=${encoded(searchModel)}`, action: "Search model", capability };
        }
        if (sourceId === "BOATS_COM_US") {
            return { url: `https://www.boats.com/boats-for-sale/?country=united-states&make=${encoded(primaryMake)}&model=${encoded(searchModel)}`, action: "Search model", capability };
        }
        if (sourceId === "YACHTWORLD_CA") {
            return { url: `https://www.yachtworld.com/boats-for-sale/make-${slug(primaryMake)}/model-${slug(searchModel)}/country-canada/`, action: "Search model", capability };
        }
        if (sourceId === "YACHTWORLD_US") {
            return { url: `https://www.yachtworld.com/boats-for-sale/make-${slug(primaryMake)}/model-${slug(searchModel)}/country-united-states/`, action: "Search model", capability };
        }
        if (sourceId === "BOATTRADER") {
            return { url: `https://www.boattrader.com/boats/make-${slug(primaryMake)}/model-${slug(searchModel)}/`, action: "Search model", capability };
        }
        if (sourceId === "BOATDEALERS_CA") {
            return { url: `https://www.boatdealers.ca/boats-for-sale/${country}/power/${slug(primaryMake)}-boats/model-${slug(searchModel)}`, action: "Search model", capability };
        }
        return { url: source.InventoryURL || "", action: "Browse inventory", capability: "BrowseInventory" };
    }

    const sources = (Array.isArray(globalThis.BScoutMarketplaceSources) ? globalThis.BScoutMarketplaceSources : [])
        .filter(source => source && source.Active !== false && source.Domain && source.Name);
    const groups = ["Canada", "USA"].map(country => {
        const countrySources = sources.filter(source => source.Country === country).sort((a,b) => (a.Priority || 999) - (b.Priority || 999));
        return {
            region: country === "USA" ? "United States" : country,
            brokerCount: countrySources.filter(source => source.SourceType === "Broker").length,
            marketplaceCount: countrySources.filter(source => source.SourceType === "Marketplace").length,
            links: countrySources.map(source => {
                const destination = sourceDestination(source);
                const validation = (Array.isArray(globalThis.BScoutMarketplaceSourceValidation)
                    ? globalThis.BScoutMarketplaceSourceValidation
                    : (Array.isArray(globalThis.BScoutBrokerSourceValidation) ? globalThis.BScoutBrokerSourceValidation : []))
                    .find(item => item && item.BoatModelID === boat.BoatModelID && item.SourceID === source.SourceID) || null;
                const status = validation?.Status || source.SourceStatus || "NotChecked";
                return {
                    SourceID: source.SourceID,
                    label: source.Name,
                    sourceType: source.SourceType,
                    region: source.Region || "",
                    url: validation?.SearchURL || validation?.ListingURL || destination.url,
                    inventoryUrl: source.InventoryURL || "",
                    action: destination.action,
                    capability: destination.capability,
                    status,
                    matchCount: Number.isFinite(Number(validation?.MatchCount)) ? Number(validation.MatchCount) : null,
                    message: validation?.Message || source.SourceStatusMessage || "This source has not been checked for this model.",
                    lastChecked: validation?.CheckedAt || validation?.LastChecked || "",
                    confidence: validation?.Confidence || "Unknown"
                };
            })
        };
    }).filter(group => group.links.length);

    return { query: canonical, aliases, groups, sourceCount: sources.length, curatedCount: 0, searchRecordFound: Boolean(searchRecord) };
}

function renderBrokerDiscovery(discovery) {
    if (!discovery || !Array.isArray(discovery.groups) || discovery.groups.length === 0) return "";
    const statusMeta = {
        ListingLikely: { icon: "✓", label: "Listing likely", className: "is-viable" },
        NoListingIndicated: { icon: "—", label: "No listing indicated", className: "is-empty" },
        SourceUnavailable: { icon: "!", label: "Source unavailable", className: "is-unresponsive" },
        Inconclusive: { icon: "?", label: "Check inconclusive", className: "is-unknown" },
        CheckPending: { icon: "?", label: "Automated check pending", className: "is-unknown" },
        NotChecked: { icon: "?", label: "Automated check pending", className: "is-unknown" }
    };
    const groups = discovery.groups.map(group => {
        const links = normalizeArray(group.links).filter(item => item && item.url && item.label);
        if (!links.length) return "";
        const rows = links.map(item => {
            const meta = statusMeta[item.status] || statusMeta.NotChecked;
            const titleParts = [meta.label, item.message, item.lastChecked ? `Checked ${item.lastChecked}` : ""].filter(Boolean);
            const action = item.status === "ListingLikely"
                ? "Open search"
                : item.action;
            const content = `<span class="broker-status-icon" aria-hidden="true">${meta.icon}</span>
                <span class="broker-source-copy"><span class="broker-source-name">${intelligenceEscapeHtml(item.label)}</span><span class="broker-source-message">${intelligenceEscapeHtml(meta.label)}</span></span>
                <span class="broker-source-action">${intelligenceEscapeHtml(item.status === "SourceUnavailable" ? "Unavailable" : action)}</span>`;
            if (item.status === "SourceUnavailable") {
                return `<div class="broker-source-row ${meta.className} is-disabled" role="status" title="${intelligenceEscapeHtml(titleParts.join(" · "))}">${content}</div>`;
            }
            return `<a class="broker-source-row ${meta.className}" href="${intelligenceEscapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="${intelligenceEscapeHtml(titleParts.join(" · "))}">${content}</a>`;
        }).join("");
        return `<div class="broker-discovery-group"><h5>${intelligenceEscapeHtml(group.region)}</h5><div class="broker-discovery-links">${rows}</div></div>`;
    }).filter(Boolean).join("");
    return groups ? `<div class="model-knowledge-group broker-discovery"><strong>Marketplace searches</strong><div class="broker-status-legend"><span>✓ listing likely</span><span>— none indicated</span><span>! unavailable</span><span>? inconclusive / pending</span></div><div class="broker-discovery-groups">${groups}</div></div>` : "";
}

function buildModelKnowledgeSummary(boat) {
    if (!boat) {
        return {
            verdictLevel: "Insufficient Knowledge",
            verdictLabel: "Why B-Atlas Is Cautious",
            verdict: "Model knowledge is not available.",
            positives: [], cautions: [], inspectionFocus: [], missions: [],
            ownershipComplexity: { label: "Unknown", explanation: "Ownership demands have not been documented." },
            bestFor: null, avoidIf: null, confidence: "Low", confidenceBasis: []
        };
    }

    const positives = [];
    const cautions = [];
    const strength = firstSentence(boat.Strengths);
    const bestFor = cleanKnownValue(boat.BestFor || boat.CrewFitBestFor);
    const weakness = firstSentence(boat.Weaknesses);
    const avoidIf = cleanKnownValue(boat.AvoidIf || boat.CrewFitCautions);
    const inspectionFocus = splitGuidance(boat.CommonProblems, 5);

    if (strength) positives.push(strength);
    if (bestFor) {
        const sentence = firstSentence(bestFor, bestFor);
        if (sentence && !positives.includes(sentence)) positives.push(sentence);
    }
    if (weakness) cautions.push(weakness);
    if (avoidIf) {
        const sentence = firstSentence(avoidIf, avoidIf);
        if (sentence && !cautions.includes(sentence)) cautions.push(sentence);
    }

    const confidence = normalizeResearchConfidence(boat);
    const registryRecord = typeof window !== "undefined" && window.BScoutRegistry && typeof window.BScoutRegistry.getBoat === "function"
        ? window.BScoutRegistry.getBoat(boat.BoatModelID)
        : null;
    const identityText = [registryRecord && registryRecord.IdentityStatus, registryRecord && registryRecord.Resolution, registryRecord && registryRecord.IdentityReviewStatus].filter(Boolean).join(" ").toLowerCase();
    const identityUnverified = identityText.includes("unverified") || identityText.includes("reviewrequired");
    const duplicateIdentity = identityText.includes("duplicateof") || identityText.includes("mergedduplicate") || Boolean(registryRecord && registryRecord.RedirectTo);
    const hasPositiveGuidance = positives.length > 0;

    let verdictLevel = ["High", "Verified"].includes(confidence) ? "Recommended" : "Worth Investigating";
    let verdictLabel = "Why B-Atlas Likes This Boat";
    let verdict = hasPositiveGuidance
        ? positives[0]
        : "This model remains in the discovery set, but researched buyer guidance is still limited.";

    if (duplicateIdentity) {
        verdictLevel = "Proceed Carefully";
        verdictLabel = "Why B-Atlas Is Cautious";
        verdict = "This is a duplicate or legacy identity. Use the canonical model record for comparison and research.";
    } else if (identityUnverified) {
        verdictLevel = "Insufficient Knowledge";
        verdictLabel = "Why B-Atlas Is Cautious";
        verdict = "The model identity or supporting specifications are not sufficiently verified for a firm assessment.";
    } else if (!hasPositiveGuidance) {
        verdictLevel = "Insufficient Knowledge";
        verdictLabel = "Why B-Atlas Is Cautious";
        verdict = cautions[0] || "The available model evidence is incomplete and should be verified before making a firm comparison.";
    } else if (confidence === "Low") {
        verdictLevel = "Proceed Carefully";
    }

    return {
        verdictLevel,
        verdictLabel,
        verdict,
        positives: positives.slice(0, 3),
        cautions: cautions.slice(0, 3),
        inspectionFocus,
        missions: buildMissionBadges(boat),
        ownershipComplexity: buildOwnershipComplexity(boat),
        bestFor,
        avoidIf,
        confidence,
        confidenceBasis: buildConfidenceBasis(boat, inspectionFocus),
        brokerDiscovery: buildBrokerDiscovery(boat)
    };
}

function renderModelKnowledgeSummary(summary, options = {}) {
    if (!summary) return "";
    const compact = Boolean(options.compact);
    const list = (items, className, emptyText = "") => items.length
        ? `<ul class="${className}">${items.map(item => `<li>${intelligenceEscapeHtml(item)}</li>`).join("")}</ul>`
        : (emptyText ? `<p class="model-knowledge-empty">${intelligenceEscapeHtml(emptyText)}</p>` : "");
    const confidenceClass = String(summary.confidence || "Low").toLowerCase();
    const complexityClass = String(summary.ownershipComplexity?.label || "unknown").toLowerCase();
    return `
        <section class="model-knowledge-summary${compact ? " model-knowledge-summary-compact" : ""}">
            <div class="model-knowledge-verdict-row">
                <div>
                    <span class="model-knowledge-eyebrow">General model guidance</span>
                    <strong class="model-knowledge-verdict-level model-knowledge-verdict-${intelligenceEscapeHtml(summary.verdictLevel.toLowerCase().replace(/\s+/g, "-"))}">${intelligenceEscapeHtml(summary.verdictLevel)}</strong>
                </div>
                <span class="model-knowledge-confidence model-knowledge-confidence-${confidenceClass}">Knowledge: ${intelligenceEscapeHtml(summary.confidence)}</span>
            </div>
            <p class="model-knowledge-verdict">${intelligenceEscapeHtml(summary.verdict)}</p>
            ${compact ? "" : `
                <div class="model-knowledge-decision-grid">
                    <div class="model-knowledge-group"><strong>${intelligenceEscapeHtml(summary.verdictLabel)} — Known strengths</strong>${list(summary.positives, "model-knowledge-positive", "No positive model guidance is documented yet.")}</div>
                    <div class="model-knowledge-group"><strong>Trade-offs</strong>${list(summary.cautions, "model-knowledge-caution", "No model-specific trade-offs are documented yet.")}</div>
                </div>
                ${summary.missions.length ? `<div class="model-knowledge-group"><strong>Best Missions</strong><div class="model-mission-badges">${summary.missions.map(item => `<span>${intelligenceEscapeHtml(item)}</span>`).join("")}</div></div>` : ""}
                <div class="model-knowledge-group model-ownership-complexity"><strong>Ownership Complexity</strong><div><span class="ownership-complexity ownership-complexity-${complexityClass}">${intelligenceEscapeHtml(summary.ownershipComplexity?.label || "Unknown")}</span><p>${intelligenceEscapeHtml(summary.ownershipComplexity?.explanation || "Ownership demands have not been documented.")}</p></div></div>
                <div class="model-knowledge-group"><strong>Inspect Carefully — Inspection focus</strong>${list(summary.inspectionFocus, "model-knowledge-inspection", "No model-specific inspection priorities are documented yet.")}</div>
                ${renderBrokerDiscovery(summary.brokerDiscovery)}
                <div class="model-knowledge-group model-confidence-basis"><strong>Knowledge Confidence</strong><p>${intelligenceEscapeHtml(summary.confidence)} confidence</p>${list(summary.confidenceBasis, "model-knowledge-confidence-basis", "The basis for this assessment is not yet documented.")}</div>
            `}
        </section>
    `;
}

function buildBuyerIntelligence(boat, recommendation, knowledgeCard = null) {
    const report = recommendation && recommendation.decisionReport ? recommendation.decisionReport : {};
    const recommendationLabel = report.recommendation || "Needs Review";
    const matches = normalizeArray(report.matches);
    const conflicts = normalizeArray(report.conflicts);
    const unknowns = normalizeArray(report.unknowns);
    const actions = normalizeArray(report.actions);
    const routeStatement = buildRouteStatement(recommendation);
    const confidence = buildConfidenceExplanation(report, recommendation);
    const modelKnowledge = buildModelKnowledgeSummary(boat);

    const evidence = [];
    matches.slice(0, 3).forEach(item => evidence.push({ type: "positive", feature: item.feature, text: item.explanation }));
    conflicts.slice(0, 3).forEach(item => evidence.push({ type: "conflict", feature: item.feature, text: item.explanation }));
    unknowns.slice(0, 3).forEach(item => evidence.push({ type: "unknown", feature: item.feature, text: item.explanation }));
    if (routeStatement) evidence.push({ type: recommendation.routeCompatibility.status === "Fail" ? "conflict" : "route", feature: "Route", text: routeStatement });

    // A profile with no active feature requirements can legitimately produce no
    // match/conflict evidence. In that case, provide transparent model context
    // from recorded fields without claiming those facts satisfy a preference.
    if (evidence.length === 0) {
        buildRecordedCharacteristics(boat).slice(0, 4).forEach(item => {
            evidence.push({ type: "recorded", feature: item.feature, text: item.text });
        });
    }

    const primaryAction = firstItem(actions) || {
        type: "Proceed",
        priority: "Low",
        title: "Continue researching this candidate",
        instruction: "Review vessel-specific condition and current listings before contacting a seller.",
        destination: "KnowledgeCard"
    };

    const boatName = buildBoatName(boat);
    const recordedFacts = buildRecordedCharacteristics(boat);
    let narrative = report.summary || `${boatName} requires further review.`;
    if (recommendationLabel === "Strong Candidate" && matches.length > 0) {
        const supportingMatches = matches.slice(0, 2).map(item => item.explanation).join(" ");
        narrative = `${boatName} is a strong candidate under the current profile. ${supportingMatches}`;
    } else if (recommendationLabel === "Strong Candidate") {
        const context = recordedFacts.slice(0, 3).map(item => item.text).join(" ");
        narrative = `${boatName} is a strong candidate under the current profile.${context ? ` Recorded model characteristics include: ${context}` : ""} No evaluated requirement conflict was identified.`;
    } else if (recommendationLabel === "Poor Match" && conflicts.length > 0) {
        narrative = `${boatName} has a known requirement conflict. ${conflicts[0].explanation}`;
    } else if ((recommendationLabel === "Needs Review" || recommendationLabel === "Candidate") && unknowns.length > 0) {
        narrative = `${boatName} remains a candidate, but important information is unresolved. ${unknowns[0].explanation}`;
    }

    return {
        boatModelId: boat && boat.BoatModelID ? String(boat.BoatModelID) : null,
        classification: recommendationLabel,
        narrative,
        confidence,
        evidence,
        primaryAction,
        knowledgeStatement: buildKnowledgeStatement(knowledgeCard),
        modelKnowledge,
        trace: {
            decisionReport: Boolean(recommendation && recommendation.decisionReport),
            routeCompatibility: Boolean(recommendation && recommendation.routeCompatibility),
            knowledgeCard: Boolean(knowledgeCard)
        }
    };
}

function renderBuyerIntelligence(intelligence) {
    if (!intelligence) return "Model overview unavailable.";

    return `
        <div class="buyer-intelligence-summary">
            <div class="buyer-intelligence-classification">${intelligenceEscapeHtml(intelligence.classification)}</div>
            <p>${intelligenceEscapeHtml(intelligence.narrative)}</p>
            <div class="buyer-intelligence-confidence">
                <strong>${intelligenceEscapeHtml(intelligence.confidence.label)} confidence (${intelligenceEscapeHtml(intelligence.confidence.score)}%)</strong>
                <span>${intelligenceEscapeHtml(intelligence.confidence.explanation)}</span>
            </div>
            ${intelligence.modelKnowledge ? renderModelKnowledgeSummary(intelligence.modelKnowledge) : ""}
            ${intelligence.knowledgeStatement ? `<div class="buyer-intelligence-support"><strong>Knowledge coverage</strong><span>${intelligenceEscapeHtml(intelligence.knowledgeStatement)}</span></div>` : ""}
        </div>
    `;
}

const intelligenceLayerApi = {
    buildBuyerIntelligence,
    renderBuyerIntelligence,
    buildConfidenceExplanation,
    buildRouteStatement,
    buildKnowledgeStatement,
    buildModelKnowledgeSummary,
    renderModelKnowledgeSummary,
    buildBrokerDiscovery,
    renderBrokerDiscovery,
    normalizeAvailabilityLabel,
    intelligenceEscapeHtml
};

if (typeof window !== "undefined") {
    window.BScoutIntelligenceLayer = intelligenceLayerApi;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = intelligenceLayerApi;
}
