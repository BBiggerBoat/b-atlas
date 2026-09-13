(function (global) {
    "use strict";

    const COMMUNITY_API_BASE = "https://api.b-atlas.org";

    const DEFAULT_MANIFEST = Object.freeze({
        boats: "boatmodels.json",
        productionPhases: "data/production-phases.json",
        routes: "routes.json",
        missionTemplates: "data/missionTemplates.json",
        searchProfiles: "data/search-profiles.json",
        marketplaceSources: "data/marketplace-sources.json",
        modelSearchAliases: "data/model-search-aliases.json",
        marketplaceSourceValidation: "data/marketplace-source-validation.json",
        manufacturerKnowledge: "knowledge/data/manufacturerknowledge.json",
        manufacturers: "data/registry/manufacturers.json",
        boatRegistry: "data/registry/boat-registry.json",
        modelFamilies: "data/model-families.json",
        fuelTypes: "data/taxonomy/fuel-types.json",
        propulsionTypes: "data/taxonomy/propulsion-types.json",
        hullForms: "data/taxonomy/hull-forms.json",
        hullConfigurations: "data/taxonomy/hull-configurations.json",
        styleFamilies: "data/taxonomy/style-families.json",
        factAttributes: "knowledge/data/fact-attributes.json",
        evidence: "knowledge/data/evidence.json",
        contradictions: "knowledge/data/contradictions.json",
        relationships: "knowledge/data/relationships.json",
        knowledgeCoverage: "knowledge/data/knowledge-coverage.json",
        confidenceLevels: "knowledge/data/confidence-levels.json",
        sourceTypes: "knowledge/data/source-types.json",
        relationshipTypes: "knowledge/data/relationship-types.json"
    });

    function ensureArray(value, datasetName) {
        if (!Array.isArray(value)) {
            throw new Error(`B-Atlas dataset '${datasetName}' must be an array.`);
        }
        return value;
    }

    function fetchJson(url, fetchImpl) {
        const request = fetchImpl || global.fetch;
        if (typeof request !== "function") {
            return Promise.reject(new Error("B-Atlas Data Repository requires fetch."));
        }

        return request(url).then(response => {
            if (!response || !response.ok) {
                const status = response && response.status ? ` (${response.status})` : "";
                throw new Error(`Failed to load B-Atlas data from '${url}'${status}.`);
            }
            return response.json();
        });
    }


    function applyCanonicalCompatibility(row) {
        if (!row || typeof row !== "object") return row;
        const c = global.BAtlasCanonical;
        const out = { ...row };
        // Capacity fields predate the SI canonical migration and contain mixed unit semantics.
        // Never synthesize gallon values unless the record explicitly declares its canonical unit state.
        for (const key of ["FuelCapacity","WaterCapacity","HoldingCapacity"]) {
            if (out[`${key}UnitStatus`] === "canonical_litres" && Number.isFinite(Number(out[key])) && c) {
                out[`${key}Gal`] = c.fromCanonical(Number(out[key]), "us_gal");
            }
        }
        const enumPairs = [["FuelCode","NormalizedFuel"],["PropulsionCode","NormalizedPropulsion"],["HullBehaviourCode","HullBehaviour"],["BoatFamilyCode","BoatFamily"],["RudderTypeCode","RudderType"],["KeelConfigurationCode","KeelConfiguration"],["SideDecksCode","SideDecks"],["ShowerTypeCode","ShowerType"]];
        for (const [canonical, legacy] of enumPairs) if (out[canonical] !== undefined && out[canonical] !== null) out[legacy] = out[canonical];
        if (!out.PropulsionCode && out.MechanicalPropulsionCode) out.PropulsionCode = out.MechanicalPropulsionCode;
        return out;
    }

    function loadApplicationData(options) {
        const settings = options || {};
        const manifest = Object.assign({}, DEFAULT_MANIFEST, settings.manifest || {});
        const fetchImpl = settings.fetchImpl;
        const entries = Object.entries(manifest);

        return Promise.all(entries.map(([name, url]) =>
            fetchJson(url, fetchImpl).then(value => [name, ensureArray(value, name)])
        )).then(async results => {
            const data = Object.fromEntries(results);
            if (Array.isArray(data.boats)) {
                const phaseIndex = new Map();
                for (const phase of (Array.isArray(data.productionPhases) ? data.productionPhases : [])) {
                    if (!phase?.BoatModelID) continue;
                    if (!phaseIndex.has(phase.BoatModelID)) phaseIndex.set(phase.BoatModelID, []);
                    phaseIndex.get(phase.BoatModelID).push(phase);
                }
                for (const list of phaseIndex.values()) list.sort((a,b) => Number(a.Sequence||0)-Number(b.Sequence||0));
                data.boats = data.boats.map(row => applyCanonicalCompatibility({
                    ...row,
                    ProductionPhases: phaseIndex.get(row.BoatModelID) || []
                }));
            }
            try {
                const request = fetchImpl || global.fetch;
                const response = await request(`${COMMUNITY_API_BASE}/api/public/overlays`, { cache: "no-store" });
                if (response?.ok) {
                    const overlay = await response.json();
                    if (Array.isArray(data.boats)) {
                        const patches = overlay?.modelPatches || {};
                        data.boats = data.boats.map(row => applyCanonicalCompatibility(patches[row.BoatModelID] ? { ...row, ...patches[row.BoatModelID] } : row));
                        if (Array.isArray(overlay?.addedModels)) {
                            const ids = new Set(data.boats.map(x => x.BoatModelID));
                            for (const row of overlay.addedModels) if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.boats.push(row); ids.add(row.BoatModelID); }
                        }
                    }
                    if (Array.isArray(data.manufacturers) && Array.isArray(overlay?.addedManufacturers)) {
                        const keys = new Set(data.manufacturers.map(x => String(x.CanonicalName || "").toLowerCase()));
                        for (const row of overlay.addedManufacturers) {
                            const key = String(row?.CanonicalName || "").toLowerCase();
                            if (key && !keys.has(key)) { data.manufacturers.push(row); keys.add(key); }
                        }
                    }
                    data.communityOverlay = overlay;
                }
            } catch (_) {
                // Static/local mode intentionally continues without the live overlay API.
            }
            return data;
        });
    }

    global.BScoutDataRepository = {
        DEFAULT_MANIFEST,
        fetchJson,
        loadApplicationData,
        ensureArray,
        applyCanonicalCompatibility
    };
})(typeof window !== "undefined" ? window : globalThis);
