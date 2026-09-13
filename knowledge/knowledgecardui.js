(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.BScoutKnowledgeUI = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const COLLECTION_PATH = 'knowledge/data/knowledgecards.json';
    const RESOURCE_PATH = 'knowledge/data/curatedresources.json';
    const LISTING_PATH = 'knowledge/data/listingsearches.json';
    const INTELLIGENCE_PATH = 'boatmodels.json';
    let collectionPromise = null;
    let resourcePromise = null;
    let listingPromise = null;
    let intelligencePromise = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function displayFieldName(value) {
        return String(value || 'Information')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function getKnowledgeApi() {
        return typeof globalThis !== 'undefined' ? globalThis.BScoutKnowledge || null : null;
    }

    function getProviderApi() {
        return typeof globalThis !== 'undefined' ? globalThis.BScoutCuratedResourceProvider || null : null;
    }

    function getListingProviderApi() {
        return typeof globalThis !== 'undefined' ? globalThis.BScoutListingDiscoveryProvider || null : null;
    }

    function loadJson(path, fetchImpl) {
        const request = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        if (!request) return Promise.reject(new Error('No fetch implementation is available'));
        return request(path).then(response => {
            if (!response.ok) throw new Error(`${path} failed to load (${response.status})`);
            return response.json();
        }).then(items => Array.isArray(items) ? items : []);
    }

    async function loadKnowledgeCards(fetchImpl) {
        if (!collectionPromise) {
            collectionPromise = loadJson(COLLECTION_PATH, fetchImpl).catch(error => {
                collectionPromise = null;
                throw error;
            });
        }
        return collectionPromise;
    }

    function mergeResourceAdditions(base, additions) {
        const rows = Array.isArray(base) ? base.map(r => ({...r})) : [];
        const map = new Map(rows.map(r => [String(r.BoatModelID || ""), r]));
        for (const add of Array.isArray(additions) ? additions : []) {
            const id = String(add?.BoatModelID || "").trim();
            if (!id || !add?.url) continue;
            let row = map.get(id);
            if (!row) { row = {BoatModelID:id,schemaVersion:2,documents:[],videos:[],ownerCommunities:[],images:[],sources:[],confidence:"Unknown"}; rows.push(row); map.set(id,row); }
            const group = ["documents","videos","ownerCommunities"].includes(add.group) ? add.group : "documents";
            row[group] = Array.isArray(row[group]) ? row[group] : [];
            if (row[group].some(x => String(x?.url || "") === String(add.url))) continue;
            row[group].push({title:add.title,url:add.url,sourceLabel:add.sourceLabel,resourceType:add.resourceType,verificationStatus:add.verificationStatus,scope:add.scope,confidence:add.confidence,notes:add.notes||""});
        }
        return rows;
    }

    async function loadCuratedResources(fetchImpl) {
        if (!resourcePromise) {
            resourcePromise = loadJson(RESOURCE_PATH, fetchImpl).then(async rows => {
                try {
                    const api = typeof globalThis !== "undefined" ? globalThis.BScoutCommunityAPI : null;
                    if (api?.publicOverlays) { const live = await api.publicOverlays(); return mergeResourceAdditions(rows, live?.resourceAdditions || []); }
                } catch { /* Static resources remain authoritative fallback. */ }
                return rows;
            }).catch(error => {
                resourcePromise = null;
                throw error;
            });
        }
        return resourcePromise;
    }

    async function loadBoatIntelligence(fetchImpl) {
        if (!intelligencePromise) {
            intelligencePromise = loadJson(INTELLIGENCE_PATH, fetchImpl).catch(error => {
                intelligencePromise = null;
                throw error;
            });
        }
        return intelligencePromise;
    }

    async function loadListingSearches(fetchImpl) {
        if (!listingPromise) {
            listingPromise = loadJson(LISTING_PATH, fetchImpl).catch(error => {
                listingPromise = null;
        intelligencePromise = null;
                throw error;
            });
        }
        return listingPromise;
    }

    function resetKnowledgeCardCache() {
        collectionPromise = null;
        resourcePromise = null;
        listingPromise = null;
        intelligencePromise = null;
    }

    function findCard(cards, boatModelId) {
        const api = getKnowledgeApi();
        if (api && typeof api.findKnowledgeCard === 'function') {
            return api.findKnowledgeCard(cards, boatModelId);
        }
        const id = String(boatModelId || '').trim();
        return asArray(cards).find(card => String(card?.identity?.boatModelId || card?.BoatModelID || '').trim() === id) || null;
    }

    async function enrichCard(card, resources, listings, intelligenceRecords) {
        const knowledgeApi = getKnowledgeApi();
        const providerApi = getProviderApi();
        const listingProviderApi = getListingProviderApi();
        const intelligenceProviderApi = typeof globalThis !== 'undefined' ? globalThis.BScoutBoatIntelligenceProvider || null : null;
        const intelligenceRepositoryApi = typeof globalThis !== 'undefined' ? globalThis.BScoutBoatIntelligenceRepository || null : null;
        if (!card || !knowledgeApi) return card;
        const providers = [];
        if (providerApi) providers.push(providerApi.createCuratedResourceProvider(resources));
        if (listingProviderApi) providers.push(listingProviderApi.createListingDiscoveryProvider(listings));
        if (intelligenceProviderApi && intelligenceRepositoryApi) {
            providers.push(intelligenceProviderApi.createBoatIntelligenceProvider(intelligenceRecords, intelligenceRepositoryApi));
        }
        if (providers.length === 0) return card;
        const manager = new knowledgeApi.KnowledgeManager(providers);
        return manager.enrich(card);
    }

    function countAvailableSections(card) {
        if (!card) return 0;
        let count = Object.keys(card.specifications || {}).length > 0 ? 1 : 0;
        if (Object.keys(card.intelligence || {}).length > 0) count += 1;
        ['images', 'videos', 'documents', 'ownerCommunities', 'knownIssues', 'similarModels']
            .forEach(section => {
                if (asArray(card[section]).length > 0) count += 1;
            });
        return count;
    }

    function safeUrl(value) {
        try {
            const url = new URL(String(value || ''));
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function renderResourceList(items) {
        const resources = asArray(items);
        if (resources.length === 0) return '';
        return `<ul class="knowledge-resource-list">${resources.map(item => {
            const title = escapeHtml(item.title || item.label || 'Research resource');
            const href = safeUrl(item.url);
            const source = escapeHtml(item.sourceLabel || item.resourceType || 'External source');
            const status = escapeHtml(item.verificationStatus || 'Status unknown');
            const listingMeta = item.discoveryType === 'MarketplaceSearch'
                ? ` · ${escapeHtml(item.inventoryStatus || 'Live inventory not verified')}${item.lastChecked ? ` · Checked ${escapeHtml(item.lastChecked)}` : ''}`
                : '';
            const titleHtml = href
                ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${title}</a>`
                : `<strong>${title}</strong>`;
            return `<li>${titleHtml}<span class="knowledge-meta">${source} · ${status}${listingMeta}</span></li>`;
        }).join('')}</ul>`;
    }

    function renderSources(sources) {
        const items = asArray(sources);
        if (items.length === 0) return '<div class="knowledge-empty">No sources have been attached.</div>';
        return `<ul class="knowledge-list">${items.map(source => {
            const label = escapeHtml(source.label || source.type || 'Source');
            const status = escapeHtml(source.verificationStatus || 'Unknown');
            return `<li><strong>${label}</strong><span class="knowledge-meta">${status}</span></li>`;
        }).join('')}</ul>`;
    }

    function renderMissingInformation(items) {
        const missing = asArray(items);
        if (missing.length === 0) return '<div class="knowledge-empty">No missing-information items are currently recorded.</div>';
        return `<ul class="knowledge-list knowledge-missing-list">${missing.map(item => `
            <li><strong>${escapeHtml(displayFieldName(item.field))}</strong><span>${escapeHtml(item.reason || 'Verification is required.')}</span></li>
        `).join('')}</ul>`;
    }

    function canonicalSpecifications(boat) {
        if (!boat || typeof boat !== 'object') return [];
        const c = typeof globalThis !== 'undefined' ? globalThis.BAtlasCanonical : null;
        const profile = c && typeof c.getUnitProfile === 'function' ? c.getUnitProfile() : 'imperial';
        const fmt = (value, dimension) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return null;
            return c && typeof c.formatMeasurement === 'function' ? c.formatMeasurement(n, dimension, profile) : String(value);
        };
        const years = boat.FirstYear && boat.LastYear ? `${boat.FirstYear}–${boat.LastYear}` : (boat.FirstYear || boat.LastYear || null);
        const capacity = key => c && typeof c.formatUnverifiedVolume === 'function' ? c.formatUnverifiedVolume(boat, key, `${key}Gal`) : (boat[key] ?? null);
        const rows = [
            ['Production years', years],
            ['LOA', fmt(boat.LOA, 'length')],
            ['LWL', fmt(boat.LWL, 'length')],
            ['Beam', fmt(boat.Beam, 'length')],
            ['Draft', fmt(boat.Draft, 'length')],
            ['Air draft', fmt(boat.AirDraft, 'length')],
            ['Displacement', fmt(boat.Displacement, 'mass')],
            ['Fuel capacity', capacity('FuelCapacity')],
            ['Water capacity', capacity('WaterCapacity')],
            ['Holding capacity', capacity('HoldingCapacity')],
            ['Typical propulsion', boat.NormalizedPropulsion || boat.PropulsionCode || boat.Propulsion],
            ['Engine configuration', boat.EngineConfiguration],
            ['Accommodation', [boat.Cabins && `${boat.Cabins} cabin${boat.Cabins===1?'':'s'}`, boat.Berths && `${boat.Berths} berths`, boat.Heads && `${boat.Heads} head${boat.Heads===1?'':'s'}`].filter(Boolean).join(', ')]
        ];
        return rows.filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== 'Unknown');
    }

    function renderAvailableKnowledge(card, boat) {
        const sections = [];
        const specifications = canonicalSpecifications(boat);
        if (specifications.length > 0) {
            sections.push(`<div class="knowledge-resource-group"><h5>Specifications</h5><div class="knowledge-specification-grid">${specifications.map(([label, value]) => `<div class="knowledge-available-item"><strong>${escapeHtml(displayFieldName(label))}</strong><span>${escapeHtml(value)}</span></div>`).join('')}</div></div>`);
        }

        const labels = {
            images: 'Images', videos: 'Videos', documents: 'Documents',
            ownerCommunities: 'Owner Communities', knownIssues: 'Known Issues', similarModels: 'Similar Models'
        };
        Object.entries(labels).forEach(([key, label]) => {
            const items = asArray(card && card[key]);
            if (items.length > 0) {
                sections.push(`<div class="knowledge-resource-group"><h5>${escapeHtml(label)}</h5>${renderResourceList(items)}</div>`);
            }
        });

        if (sections.length === 0) {
            return '<div class="knowledge-empty">Identity is available, but no verified research resources have been attached yet.</div>';
        }
        return `<div class="knowledge-resource-groups">${sections.join('')}</div>`;
    }

    function buildResearchAction(card) {
        const missing = asArray(card && card.missingInformation);
        if (missing.length > 0) {
            const first = displayFieldName(missing[0].field).toLowerCase();
            return `Research and verify ${first}, then attach the source to this Knowledge Card.`;
        }
        if (countAvailableSections(card) === 0) return 'Find one reliable model-specific source and attach it to begin this Knowledge Card.';
        return 'Review the available sources and verify any information that could affect the purchase decision.';
    }

    function renderKnowledgeCard(card, boat) {
        const boatName = [boat && boat.Manufacturer, boat && boat.Model, boat && boat.Variant]
            .filter(Boolean).join(' ').trim() || 'this model';
        if (!card) {
            return `<div class="knowledge-card-state knowledge-card-unstarted"><div class="knowledge-status-row"><strong>Knowledge Card not started</strong><span class="knowledge-confidence knowledge-confidence-unknown">Confidence: Unknown</span></div><p>No curated model knowledge is attached for ${escapeHtml(boatName)}. The boat remains a valid candidate.</p></div>`;
        }

        const identity = card.identity || {};
        const confidence = escapeHtml(card.confidence || 'Unknown');
        const confidenceClass = String(card.confidence || 'Unknown').toLowerCase();
        const displayName = escapeHtml(identity.displayName || boatName);
        const missingCount = asArray(card.missingInformation).length;
        return `<div class="knowledge-card-state"><div class="knowledge-status-row"><div><strong>${displayName}</strong><span class="knowledge-meta">Knowledge Card v${escapeHtml(card.schemaVersion || 1)}</span></div><span class="knowledge-confidence knowledge-confidence-${confidenceClass}">Confidence: ${confidence}</span></div><div class="knowledge-subsection"><h4>Available Knowledge</h4>${renderAvailableKnowledge(card, boat)}</div>${renderBoatIntelligence(card.intelligence, card.evidence)}<div class="knowledge-subsection"><h4>Missing Knowledge${missingCount ? ` (${missingCount})` : ''}</h4>${renderMissingInformation(card.missingInformation)}</div><div class="knowledge-subsection"><h4>Sources</h4>${renderSources(card.sources)}</div></div>`;
    }


    function renderTextList(items) {
        const values = asArray(items).filter(Boolean);
        if (values.length === 0) return '';
        return `<ul class="knowledge-list">${values.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    function renderBoatIntelligence(intelligence, evidence) {
        const data = intelligence && typeof intelligence === 'object' ? intelligence : {};
        if (Object.keys(data).length === 0) return '';
        const rows = [
            ['B-Atlas Signature', data.signature],
            ['Design Philosophy', data.designPhilosophy],
            ['Personality', data.personality],
            ['Ideal Owner', data.idealOwner],
            ['Buyer Profile', data.buyerProfile],
            ['Ownership Ease', data.ownershipEase],
            ['Maintenance Ease', data.maintenanceEase],
            ['Market Availability', data.marketAvailability],
            ['Parts Availability', data.partsAvailability]
        ].filter(([, value]) => value);
        const groups = [
            ['Best Missions', data.bestMissions],
            ['Less Suitable Missions', data.lessSuitableMissions],
            ['Less Suitable If', data.lessSuitableIf],
            ['Strengths', data.strengths],
            ['Trade-offs', data.tradeoffs],
            ['Inspection Priorities', data.inspectionPriorities],
            ['Common Upgrades', data.commonUpgrades],
            ['Comparable Models', data.comparableModels],
            ['Crew Fit — Best For', data.crewFit && data.crewFit.bestFor],
            ['Crew Fit — Cautions', data.crewFit && data.crewFit.cautions],
            ['B-Atlas Notes', data.bScoutNotes]
        ].filter(([, value]) => asArray(value).length > 0);
        const evidenceItems = asArray(evidence);
        const ownershipScores = data.ownershipScores && typeof data.ownershipScores === 'object' ? Object.entries(data.ownershipScores) : [];
        const refitPriority = data.refitPriority && typeof data.refitPriority === 'object' ? Object.entries(data.refitPriority) : [];
        const relationships = data.knowledgeRelationships && typeof data.knowledgeRelationships === 'object' ? Object.entries(data.knowledgeRelationships) : [];
        const sectionConfidence = data.sectionConfidence && typeof data.sectionConfidence === 'object' ? Object.entries(data.sectionConfidence) : [];
        return `<div class="knowledge-subsection"><h4>Boat Knowledge</h4>
            ${rows.map(([label, value]) => `<div class="knowledge-available-item"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('')}
            ${groups.map(([label, value]) => `<div class="knowledge-resource-group"><h5>${escapeHtml(label)}</h5>${renderTextList(value)}</div>`).join('')}
            ${ownershipScores.length ? `<div class="knowledge-resource-group"><h5>Ownership Ratings (1–5; higher is better)</h5><div class="knowledge-specification-grid">${ownershipScores.map(([label, value]) => `<div class="knowledge-available-item"><strong>${escapeHtml(displayFieldName(label))}</strong><span>${escapeHtml(value)}</span></div>`).join('')}</div></div>` : ''}
            ${refitPriority.length ? `<div class="knowledge-resource-group"><h5>Refit Priorities</h5>${refitPriority.map(([label, value]) => `<div class="knowledge-resource-group"><h5>${escapeHtml(displayFieldName(label))}</h5>${renderTextList(value)}</div>`).join('')}</div>` : ''}
            ${relationships.length ? `<div class="knowledge-resource-group"><h5>Related Boats</h5>${relationships.map(([label, value]) => `<div class="knowledge-resource-group"><h5>${escapeHtml(displayFieldName(label))}</h5>${renderTextList(value)}</div>`).join('')}</div>` : ''}
            ${sectionConfidence.length ? `<div class="knowledge-resource-group"><h5>Knowledge Confidence by Section</h5><div class="knowledge-specification-grid">${sectionConfidence.map(([label, value]) => `<div class="knowledge-available-item"><strong>${escapeHtml(displayFieldName(label))}</strong><span>${escapeHtml(value)}</span></div>`).join('')}</div></div>` : ''}
            ${evidenceItems.length ? `<div class="knowledge-resource-group"><h5>Evidence & Confidence</h5>${evidenceItems.map(item => `<div class="knowledge-available-item"><span>${escapeHtml(item.claim || '')}</span><span class="knowledge-meta">${escapeHtml(item.evidenceType || 'Evidence')} · ${escapeHtml(item.confidence || 'Unknown')} confidence</span></div>`).join('')}</div>` : ''}
        </div>`;
    }

    function renderLoadingState() { return '<div class="knowledge-empty">Loading Knowledge Card…</div>'; }
    function renderErrorState() { return '<div class="knowledge-card-state knowledge-card-error"><strong>Knowledge Card unavailable</strong><p>The research record could not be loaded. This does not affect the boat\'s candidacy.</p></div>'; }

    async function loadCardForBoat(boat, options = {}) {
        const cards = options.cards || await loadKnowledgeCards(options.fetchImpl);
        const baseCard = findCard(cards, boat && boat.BoatModelID);
        if (!baseCard) return null;
        const resources = options.resources || await loadCuratedResources(options.fetchImpl);
        const listings = options.listings || await loadListingSearches(options.fetchImpl);
        const intelligenceRecords = options.intelligenceRecords || await loadBoatIntelligence(options.fetchImpl);
        return enrichCard(baseCard, resources, listings, intelligenceRecords);
    }

    async function renderForBoat(boat, options = {}) {
        const card = await loadCardForBoat(boat, options);
        return renderKnowledgeCard(card, boat);
    }

    return {
        COLLECTION_PATH, RESOURCE_PATH, LISTING_PATH, INTELLIGENCE_PATH, escapeHtml, displayFieldName, countAvailableSections,
        buildResearchAction, renderBoatIntelligence, renderKnowledgeCard, renderLoadingState, renderErrorState, loadCardForBoat, renderForBoat,
        loadKnowledgeCards, loadCuratedResources, loadListingSearches, loadBoatIntelligence, resetKnowledgeCardCache, enrichCard, safeUrl
    };
});
