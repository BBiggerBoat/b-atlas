(function (global) {
    "use strict";

    const COMMUNITY_API_BASE = "https://api.b-atlas.org";

    // Logical source inventory for the generator and compatibility integrations.
    // Browser transport always starts with RELEASE_PATH; it never requests this monolith.
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

    function validateModels(rows) {
        const ids = new Set();
        for (const row of rows) {
            if (!row?.BoatModelID || ids.has(row.BoatModelID)) throw new Error('Missing or duplicate model ID: ' + row?.BoatModelID);
            ids.add(row.BoatModelID);
        }
        return rows;
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

    function composeApplicationData(options) {
        const settings = options || {};
        return settings.loadBaseline().then(async baseline => {
            const data = JSON.parse(JSON.stringify(baseline));
            validateModels(data.boats);

            // Complete rows and all supporting datasets belong to one verified release.

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
                const overlay = await settings.loadOverlay();
                if (overlay) {
                    if (Array.isArray(data.boats)) {
                        const patches = overlay?.modelPatches || {};
                        data.boats = data.boats.map(row => applyCanonicalCompatibility(patches[row.BoatModelID] ? { ...row, ...patches[row.BoatModelID], BoatModelID:row.BoatModelID } : row));
                        if (Array.isArray(overlay?.addedModels)) {
                            const ids = new Set(data.boats.map(x => x.BoatModelID));
                            for (const row of overlay.addedModels) if (row?.BoatModelID && !ids.has(row.BoatModelID)) {
                                data.boats.push(applyCanonicalCompatibility(row));
                                ids.add(row.BoatModelID);
                            }
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

    // Conservative projection: retain every unlisted field, including future configuration
    // and confidence keys. These audited fields are only read by full detail consumers.
    const DETAIL_ONLY_FIELDS = Object.freeze(['Overview','ModelCharacter','OwnershipCharacter','DesignLineage','EvolutionNotes','BScoutSignature','OwnerExperienceNotes','KnownConcerns','InspectionFocus','BuyerQuestions','OwnerActions','ModelVariations','EvidenceSummary','Phase2Source','DecisionDataSource','ReviewedBy','DateCreated']);
    const DEFERRED_DATASETS = Object.freeze(['curatedResources','listingSearches','knowledgeAnnotations']);
    function projectSearchModel(row) {return Object.fromEntries(Object.entries(row).filter(([key])=>!DETAIL_ONLY_FIELDS.includes(key)));}
    const RELEASE_PATH = "data/generated/models/manifest.json";
    const KNOWLEDGE_DATASETS = Object.freeze({
        curatedResources: "knowledge/data/curatedresources.json",
        listingSearches: "knowledge/data/listingsearches.json",
        knowledgeAnnotations: "knowledge/data/knowledgeannotations.json",
        communityKnowledgeItems: "data/community-knowledge-items.json",
        communityKnowledgeEvidence: "data/community-knowledge-evidence.json",
        communityReviewedContributions: "data/community-reviewed-contributions.json"
    });
    const DATASET_PATHS = Object.freeze({...DEFAULT_MANIFEST, ...KNOWLEDGE_DATASETS});
    // Capture the root script URL once: moderator pages live beneath /developer/.
    const baseUrl = global.document?.currentScript?.src ? new URL(".", global.document.currentScript.src).href : "";
    const repositories = new WeakMap();
    function freeze(value) {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
            Object.freeze(value); for (const item of Object.values(value)) freeze(item);
        }
        return value;
    }
    function createRepository(options = {}) {
        const request = options.fetchImpl || global.fetch;
        const resolve = path => (options.baseUrl || baseUrl) ? new URL(path, options.baseUrl || baseUrl).href : path;
        let snapshotPromise = null, epoch = 0, activeRequests=0;
        const waiting=[];
        async function acquire(){if(activeRequests<4){activeRequests++;return;}await new Promise(resolve=>waiting.push(resolve));}
        function release(){if(waiting.length)waiting.shift()();else activeRequests--;}

        async function digest(bytes) {
            if (!global.crypto?.subtle) throw Error("Catalogue verification requires HTTPS or localhost");
            return Array.from(new Uint8Array(await global.crypto.subtle.digest("SHA-256", bytes)), n=>n.toString(16).padStart(2,"0")).join("");
        }
        async function json(path, descriptor, fresh = false) {
            await acquire();
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            let timer;
            try {
                const operation = (async () => {
                    const response = await request(resolve(path), {cache:descriptor ? (fresh ? "reload" : "force-cache") : "no-store", ...(controller ? {signal:controller.signal} : {})});
                    if (!response?.ok) throw Error("Required catalogue file unavailable: " + path);
                    const text = await response.text(), bytes = new TextEncoder().encode(text);
                    if (bytes.length > 200000) throw Error("Catalogue file exceeds size limit: " + path);
                    if (!descriptor) return JSON.parse(text);
                    if (bytes.length !== descriptor.bytes) throw Error("Catalogue byte count mismatch: " + path);
                    if (await digest(bytes) !== descriptor.sha256) throw Error("Catalogue checksum mismatch: " + path);
                    return JSON.parse(text);
                })();
                return await Promise.race([operation, new Promise((_,reject)=> {
                    timer=setTimeout(()=>{controller?.abort();reject(Error("Catalogue request timed out: "+path));},options.timeoutMs || 30000);
                })]);
            } finally {clearTimeout(timer);release();}
        }
        async function loadRelease(fresh = false) {
            const manifest = await json(RELEASE_PATH);
            if (manifest.schemaVersion !== 3 || manifest.format !== "batlas-catalogue-release-v3" || !/^[a-f0-9]{64}$/.test(manifest.release)) throw Error("Unsupported catalogue release");
            const identity={format:manifest.format,sourceDigest:manifest.sourceDigest,baselineVersion:manifest.baselineVersion,modelCount:manifest.modelCount,shards:manifest.shards,modelToShard:manifest.modelToShard,datasets:manifest.datasets,search:manifest.search};
            if (await digest(new TextEncoder().encode(JSON.stringify(identity))) !== manifest.release) throw Error("Catalogue release identity mismatch");
            const expectedNames=Object.keys(DATASET_PATHS).filter(n=>n!=="boats");
            if(Object.keys(manifest.datasets).length!==expectedNames.length || Object.keys(manifest.datasets).some(n=>!expectedNames.includes(n)))throw Error("Unexpected catalogue dataset");
            if(manifest.search.projection !== 'batlas-search-v1' || JSON.stringify(manifest.search.detailOnlyFields)!==JSON.stringify(DETAIL_ONLY_FIELDS))throw Error('Unsupported search projection');
            const modelShards=manifest.search.shards;
            const descriptors = [...modelShards.map(s=>({...s,name:"boats"})),
                ...Object.entries(manifest.datasets).filter(([name])=>!DEFERRED_DATASETS.includes(name)).flatMap(([name,d])=>d.shards.map(s=>({...s,name})))];
            for (const name of Object.keys(DATASET_PATHS).filter(n=>n!=="boats")) {
                if (!manifest.datasets[name] || manifest.datasets[name].sourcePath !== DATASET_PATHS[name]) throw Error("Incomplete catalogue release: "+name);
            }
            for (const d of [...manifest.shards,...modelShards,...Object.values(manifest.datasets).flatMap(d=>d.shards)]) if (!/^data\/generated\/(models|catalogue)\/[a-zA-Z0-9_-]+-[a-f0-9]{64}\.json$/.test(d.path) || !d.path.includes(d.sha256) || !Number.isInteger(d.bytes) || d.bytes<2 || d.bytes>200000 || !Number.isInteger(d.records) || d.records<0) throw Error("Invalid catalogue descriptor");
            const loaded = new Array(descriptors.length); let next=0;
            let failure;
            await Promise.all(Array.from({length:Math.min(4,descriptors.length)},async()=>{
                try {
                    while(!failure && next<descriptors.length){const i=next++,d=descriptors[i];const rows=ensureArray(await json(d.path,d,fresh),d.name);if(rows.length!==d.records)throw Error("Catalogue record count mismatch");loaded[i]=rows;}
                } catch(error) {failure ||= error;}
            }));
            if(failure)throw failure;
            const baseline={boats:[],catalogueRelease:manifest.release,baselineVersion:manifest.baselineVersion};
            for(const name of Object.keys(manifest.datasets))baseline[name]=[];
            descriptors.forEach((d,i)=>baseline[d.name].push(...loaded[i]));
            validateModels(baseline.boats);
            if(baseline.boats.length!==manifest.modelCount || Object.keys(manifest.modelToShard).length!==manifest.modelCount)throw Error("Catalogue model count mismatch");
            if(Object.keys(manifest.search.modelToShard).length!==manifest.modelCount)throw Error('Search routing count mismatch');
            for(const row of baseline.boats){const index=manifest.modelToShard[row.BoatModelID];if(!Number.isInteger(index)||index<0||index>=manifest.shards.length)throw Error('Missing detail routing');}
            modelShards.forEach((_,i)=>{for(const row of loaded[i])if(manifest.search.modelToShard[row.BoatModelID]!==i)throw Error("Catalogue routing mismatch");});
            for(const [name,d] of Object.entries(manifest.datasets))if(!DEFERRED_DATASETS.includes(name)&&baseline[name].length!==d.records)throw Error("Catalogue dataset count mismatch");
            return {baseline:freeze(baseline),manifest};
        }
        async function overlay() {
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            let timer;
            try {
                return await Promise.race([(async()=>{const r=await request(COMMUNITY_API_BASE+"/api/public/overlays",{cache:"no-store",...(controller?{signal:controller.signal}:{})});if(!r?.ok)throw Error("Overlay unavailable");return r.json();})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Error("Overlay timeout"));},options.overlayTimeoutMs||5000);})]);
            } catch (_) {return null;} finally {clearTimeout(timer);}
        }
        function snapshot() {
            if(!snapshotPromise){
                const current=epoch;
                const pending=(async()=>{
                    let release;
                    try {release=await loadRelease();} catch (_) {release=await loadRelease(true);}
                    const {baseline,manifest}=release;
                    const live=await overlay();
                    const data=await composeApplicationData({loadBaseline:async()=>baseline,loadOverlay:async()=>live});
                    return {baseline,data,manifest,overlay:live,epoch:current,files:new Map(),models:new Map(),datasets:new Map()};
                })();
                snapshotPromise=pending;
                pending.catch(()=>{if(snapshotPromise===pending)snapshotPromise=null;});
            }
            return snapshotPromise;
        }
        function memo(map,key,operation) {
            if(!map.has(key)) {const pending=operation();map.set(key,pending);pending.catch(()=>{if(map.get(key)===pending)map.delete(key);});}
            return map.get(key);
        }
        async function rows(s,d) {
            return memo(s.files,d.path,async()=>{
                let value;
                try {value=await json(d.path,d);} catch (_) {value=await json(d.path,d,true);}
                ensureArray(value,d.path);if(value.length!==d.records)throw Error('Catalogue record count mismatch');return value;
            });
        }
        async function dataset(s,name) {
            if(!DEFERRED_DATASETS.includes(name))return s.baseline[name];
            return memo(s.datasets,name,async()=>{const value=[];for(const d of s.manifest.datasets[name].shards)value.push(...await rows(s,d));if(value.length!==s.manifest.datasets[name].records)throw Error('Dataset count mismatch');return freeze(value);});
        }
        async function rawModel(s,id) {
            if(!Object.hasOwn(s.manifest.modelToShard,id))return null;
            const index=s.manifest.modelToShard[id];
            const values=await rows(s,s.manifest.shards[index]);validateModels(values);
            for(const row of values)if(s.manifest.modelToShard[row.BoatModelID]!==index)throw Error('Detail routing mismatch');
            const row=values.find(row=>row.BoatModelID===id);
            if(!row)throw Error('Required model detail is missing: '+id);
            return row;
        }
        async function model(s,id) {
            return memo(s.models,id,async()=>{
                const raw=await rawModel(s,id),projected=s.data.boats.find(r=>r.BoatModelID===id);
                if(!raw)return projected||null;
                const effective=await composeApplicationData({loadBaseline:async()=>({boats:[raw],productionPhases:s.baseline.productionPhases}),loadOverlay:async()=>({...s.overlay,addedModels:[],addedManufacturers:[]})});
                // Never mutate the search projection or apply a second overlay to it.
                return effective.boats[0];
            });
        }
        async function baseline(s) {
            if(!s.fullBaseline)s.fullBaseline=(async()=>{
                const boats=[];
                // Bounded batches preserve original manifest order.
                for(let i=0;i<s.manifest.shards.length;i+=4){const batch=await Promise.all(s.manifest.shards.slice(i,i+4).map(d=>rows(s,d)));boats.push(...batch.flat());}
                validateModels(boats);for(let i=0;i<s.manifest.shards.length;i++)for(const row of await rows(s,s.manifest.shards[i]))if(s.manifest.modelToShard[row.BoatModelID]!==i)throw Error('Detail routing mismatch');if(boats.length!==s.manifest.modelCount)throw Error('Full model count mismatch');
                const value={...s.baseline,boats};for(const name of DEFERRED_DATASETS)value[name]=await dataset(s,name);return freeze(value);
            })().catch(error=>{s.fullBaseline=null;throw error;});
            return s.fullBaseline;
        }
        return {
            loadSearchData:()=>snapshot().then(s=>s.data),
            loadDataset:name=>snapshot().then(s=>dataset(s,name)),
            loadApplicationData:()=>snapshot().then(s=>{
                if(!s.fullData)s.fullData=baseline(s).then(value=>composeApplicationData({loadBaseline:async()=>value,loadOverlay:async()=>s.overlay})).catch(error=>{s.fullData=null;throw error;});return s.fullData;
            }),
            loadBaseline:()=>snapshot().then(s=>baseline(s)),
            loadOverlay:()=>snapshot().then(s=>s.overlay),
            getModel:id=>snapshot().then(s=>model(s,id)),
            invalidate:()=>{epoch++;snapshotPromise=null;},
            get epoch(){return epoch;}
        };
    }
    function getRepository(fetchImpl) {
        const request=fetchImpl || global.fetch;
        if(typeof request!=="function")throw Error("B-Atlas Data Repository requires fetch");
        if(!repositories.has(request))repositories.set(request,createRepository({fetchImpl:request}));
        return repositories.get(request);
    }
    function loadApplicationData(options={}) {return getRepository(options.fetchImpl).loadApplicationData();}
    const api = {DETAIL_ONLY_FIELDS, DEFERRED_DATASETS, projectSearchModel, loadSearchData:(options={})=>getRepository(options.fetchImpl).loadSearchData(), DEFAULT_MANIFEST, DATASET_PATHS, RELEASE_PATH, fetchJson, loadApplicationData, ensureArray, applyCanonicalCompatibility, createRepository, getRepository};
    global.BScoutDataRepository=api;
    if(typeof module === "object" && module.exports)module.exports=api;
})(typeof window !== "undefined" ? window : globalThis);
