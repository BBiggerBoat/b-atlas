(function (global) {
    "use strict";

    const COMMUNITY_API_BASE = "https://api.b-atlas.org";

    const DEFAULT_MANIFEST = Object.freeze({
        boats: "boatmodels.json",

        phase2Aliases: "data/phase2-live-aliases.json",

        phase2AliasesCarver3539: "data/phase2-live-aliases-carver-35-39.json",

        phase2AliasesCarver4044: "data/phase2-live-aliases-carver-40-44.json",

        phase2AliasesCarver4550: "data/phase2-live-aliases-carver-45-50.json",

        phase2AliasesFourWinns3034: "data/phase2-live-aliases-four-winns-30-34.json",

        phase2AliasesFourWinns3539: "data/phase2-live-aliases-four-winns-35-39.json",

        phase2AliasesFourWinns4050: "data/phase2-live-aliases-four-winns-40-50.json",

        phase2AliasesRinker3034: "data/phase2-live-aliases-rinker-30-34.json",

        phase2AliasesRinker3539: "data/phase2-live-aliases-rinker-35-39.json",

        phase2AliasesRinker4050: "data/phase2-live-aliases-rinker-40-50.json",

        phase2AliasesCruisersYachts3034: "data/phase2-live-aliases-cruisers-yachts-30-34.json",

        phase2AliasesCruisersYachts3539: "data/phase2-live-aliases-cruisers-yachts-35-39.json",

        phase2AliasesCruisersYachts4044: "data/phase2-live-aliases-cruisers-yachts-40-44.json",

        phase2AliasesCruisersYachts4550: "data/phase2-live-aliases-cruisers-yachts-45-50.json",

        phase2AliasesRegal3034: "data/phase2-live-aliases-regal-30-34.json",

        phase2AliasesRegal3539: "data/phase2-live-aliases-regal-35-39.json",

        phase2AliasesRegal4044: "data/phase2-live-aliases-regal-40-44.json",

        phase2AliasesRegal4550: "data/phase2-live-aliases-regal-45-50.json",

        phase2AliasesChaparral3034: "data/phase2-live-aliases-chaparral-30-34.json",

        phase2AliasesChaparral3539: "data/phase2-live-aliases-chaparral-35-39.json",

        phase2AliasesMonterey3034: "data/phase2-live-aliases-monterey-30-34.json",

        phase2AliasesMonterey3539: "data/phase2-live-aliases-monterey-35-39.json",

        phase2AliasesMonterey4050: "data/phase2-live-aliases-monterey-40-50.json",

        phase2AliasesFormula3034: "data/phase2-live-aliases-formula-30-34.json",

        phase2AliasesFormula3539: "data/phase2-live-aliases-formula-35-39.json",

        phase2AliasesFormula4044: "data/phase2-live-aliases-formula-40-44.json",

        phase2AliasesFormula4550: "data/phase2-live-aliases-formula-45-50.json",

        phase2AliasesCobalt3034: "data/phase2-live-aliases-cobalt-30-34.json",

        phase2AliasesCobalt3539: "data/phase2-live-aliases-cobalt-35-39.json",

        phase2AliasesCobalt4044: "data/phase2-live-aliases-cobalt-40-44.json",

        phase2AliasesWellcraft3034: "data/phase2-live-aliases-wellcraft-30-34.json",

        phase2AliasesWellcraft3539: "data/phase2-live-aliases-wellcraft-35-39.json",

        phase2AliasesWellcraft4044: "data/phase2-live-aliases-wellcraft-40-44.json",

        phase2AliasesWellcraft4550: "data/phase2-live-aliases-wellcraft-45-50.json",

        phase2AliasesTiara4550: "data/phase2-live-aliases-tiara-45-50.json",

        phase2AliasesRiviera3039: "data/phase2-live-aliases-riviera-30-39.json",

        phase2AliasesRiviera4044: "data/phase2-live-aliases-riviera-40-44.json",

        phase2AliasesRiviera4550: "data/phase2-live-aliases-riviera-45-50.json",
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

            // Supplemental Phase 2 overlays: use small batch files when the primary
            // live overlay has reached the connector write/read guard. Merge them first
            // so the normal Phase 2 overlay path remains the single application behavior.
            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCarver3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCarver3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                        data.phase2Models.push(row);
                        ids.add(row.BoatModelID);
                    }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCarver3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCarver3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                        data.phase2Aliases.push(row);
                        ids.add(row.BoatModelID);
                    }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCarver4044)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCarver4044) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCarver4044)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCarver4044) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCarver4550)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCarver4550) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCarver4550)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCarver4550) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFourWinns3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFourWinns3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFourWinns3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFourWinns3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFourWinns3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFourWinns3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFourWinns3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFourWinns3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFourWinns4050)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFourWinns4050) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFourWinns4050)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFourWinns4050) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRinker3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRinker3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRinker3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRinker3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRinker3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRinker3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRinker3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRinker3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRinker4050)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRinker4050) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRinker4050)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRinker4050) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCruisersYachts3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCruisersYachts3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCruisersYachts3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCruisersYachts3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCruisersYachts3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCruisersYachts3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCruisersYachts3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCruisersYachts3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCruisersYachts4044)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCruisersYachts4044) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCruisersYachts4044)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCruisersYachts4044) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCruisersYachts4550)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCruisersYachts4550) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCruisersYachts4550)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCruisersYachts4550) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRegal3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRegal3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRegal3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRegal3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRegal3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRegal3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRegal3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRegal3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRegal4044)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRegal4044) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRegal4044)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRegal4044) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsRegal4550)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsRegal4550) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesRegal4550)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesRegal4550) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsChaparral3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsChaparral3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesChaparral3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesChaparral3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsChaparral3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsChaparral3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesChaparral3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesChaparral3539) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsMonterey3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsMonterey3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); }
                }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesMonterey3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesMonterey3034) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); }
                }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsMonterey3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsMonterey3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesMonterey3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesMonterey3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsMonterey4050)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsMonterey4050) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesMonterey4050)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesMonterey4050) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFormula3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFormula3034) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFormula3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFormula3034) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFormula3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFormula3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFormula3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFormula3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFormula4044)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFormula4044) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFormula4044)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFormula4044) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsFormula4550)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsFormula4550) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesFormula4550)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesFormula4550) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCobalt3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCobalt3034) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCobalt3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCobalt3034) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCobalt3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCobalt3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCobalt3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCobalt3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsCobalt4044)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsCobalt4044) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesCobalt4044)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesCobalt4044) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsWellcraft3034)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsWellcraft3034) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesWellcraft3034)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesWellcraft3034) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsWellcraft3539)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsWellcraft3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesWellcraft3539)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesWellcraft3539) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsWellcraft4044)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsWellcraft4044) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesWellcraft4044)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesWellcraft4044) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            if (Array.isArray(data.phase2Models) && Array.isArray(data.phase2ModelsWellcraft4550)) {
                const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2ModelsWellcraft4550) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Models.push(row); ids.add(row.BoatModelID); } }
            }
            if (Array.isArray(data.phase2Aliases) && Array.isArray(data.phase2AliasesWellcraft4550)) {
                const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2AliasesWellcraft4550) { if (row?.BoatModelID && !ids.has(row.BoatModelID)) { data.phase2Aliases.push(row); ids.add(row.BoatModelID); } }
            }

            // Riviera Phase 2 supplemental overlays.
            for (const suffix of ["Tiara4550", "Riviera3039", "Riviera4044", "Riviera4550"]) {
                const modelKey = "phase2Models" + suffix;
                const aliasKey = "phase2Aliases" + suffix;
                if (Array.isArray(data.phase2Models) && Array.isArray(data[modelKey])) {
                    const ids = new Set(data.phase2Models.map(row => row?.BoatModelID).filter(Boolean));
                    for (const row of data[modelKey]) {
                        if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                            data.phase2Models.push(row);
                            ids.add(row.BoatModelID);
                        }
                    }
                }
                if (Array.isArray(data.phase2Aliases) && Array.isArray(data[aliasKey])) {
                    const ids = new Set(data.phase2Aliases.map(row => row?.BoatModelID).filter(Boolean));
                    for (const row of data[aliasKey]) {
                        if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                            data.phase2Aliases.push(row);
                            ids.add(row.BoatModelID);
                        }
                    }
                }
            }

            // Legacy Phase 2 model-overlay merge code is retained as a no-op for compatibility;
            // model shards are no longer loaded because boatmodels.json is authoritative.
            if (Array.isArray(data.boats) && Array.isArray(data.phase2Models)) {
                const ids = new Set(data.boats.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2Models) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                        data.boats.push(row);
                        ids.add(row.BoatModelID);
                    }
                }
            }
            if (Array.isArray(data.modelSearchAliases) && Array.isArray(data.phase2Aliases)) {
                const ids = new Set(data.modelSearchAliases.map(row => row?.BoatModelID).filter(Boolean));
                for (const row of data.phase2Aliases) {
                    if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                        data.modelSearchAliases.push(row);
                        ids.add(row.BoatModelID);
                    }
                }
            }

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
