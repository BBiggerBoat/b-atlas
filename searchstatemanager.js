(function (global) {
    "use strict";

    const DEFAULT_SEARCH_SETTINGS = Object.freeze({
        textSearch: "",
        routes: [],
        cruisingIntent: [],
        maxPrice: null,
        minLength: null,
        maxLength: null,
        minBeam: null,
        maxBeam: null,
        maxDraft: null,
        maxAirDraft: null,
        styles: [],
        boatFamilies: [],
        configurations: [],
        constructionMaterials: [],
        hullTypes: [],
        fuels: [],
        propulsion: [],
        engineCounts: [],
        twinEngines: false,
        flybridge: "",
        sideDecks: "",
        trailerable: "",
        greatLoop: "",
        minimumBerths: null,
        minimumCabins: null,
        minimumHeads: null,
        crewComposition: "",
        tallestCrewHeight: null,
        guestFrequency: "",
        featurePriorities: {}
    });

    let state = createState();
    const listeners = new Set();

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createState(initial) {
        const source = initial || {};
        return {
            searchSettings: Object.assign({}, clone(DEFAULT_SEARCH_SETTINGS), clone(source.searchSettings || {})),
            workspaceStatus: source.workspaceStatus || null,
            sort: Object.assign({ field: null, direction: "asc" }, clone(source.sort || {})),
            revision: Number(source.revision) || 0
        };
    }

    function getState() {
        return clone(state);
    }

    function setSearchSettings(settings, options) {
        state.searchSettings = Object.assign({}, clone(DEFAULT_SEARCH_SETTINGS), clone(settings || {}));
        state.workspaceStatus = null;
        state.revision += 1;
        notify(options && options.source ? options.source : "search-settings");
        return getState();
    }

    function setWorkspaceStatus(status) {
        state.workspaceStatus = status || null;
        state.revision += 1;
        notify("workspace-status");
        return getState();
    }

    function clear(options) {
        state = createState();
        state.revision += 1;
        notify(options && options.source ? options.source : "clear");
        return getState();
    }

    function subscribe(listener) {
        if (typeof listener !== "function") return function () {};
        listeners.add(listener);
        return function unsubscribe() { listeners.delete(listener); };
    }

    function notify(source) {
        const snapshot = getState();
        listeners.forEach(listener => listener(snapshot, source));
    }

    function readFromDocument(documentRef) {
        const doc = documentRef || global.document;
        if (!doc) return clone(DEFAULT_SEARCH_SETTINGS);
        const checkedValues = selector => Array.from(doc.querySelectorAll(`#discoverView ${selector}`)).map(node => node.value);
        const numericValue = id => {
            const raw = doc.getElementById(id)?.value;
            return raw === undefined || raw === null || raw === "" ? null : Number(String(raw).replace(",", "."));
        };
        const lengthFeetValue = id => {
            const value = numericValue(id);
            if (value === null || !Number.isFinite(value)) return value;
            const profile = global.BAtlasCanonical?.getUnitProfile?.() || "imperial";
            return profile === "metric" ? value / 0.3048 : value;
        };
        const captured = {
            textSearch: doc.getElementById("textSearch")?.value?.trim().toLowerCase() || "",
            routes: checkedValues(".routeFilter:checked"),
            cruisingIntent: [],
            maxPrice: null,
            minLength: lengthFeetValue("minLength"),
            maxLength: lengthFeetValue("maxLength"),
            minBeam: lengthFeetValue("minBeam"),
            maxBeam: lengthFeetValue("maxBeam"),
            maxDraft: null,
            maxAirDraft: null,
            styles: checkedValues(".styleFilter:checked"),
            boatFamilies: checkedValues(".familyFilter:checked"),
            configurations: checkedValues(".configurationFilter:checked"),
            constructionMaterials: checkedValues(".constructionFilter:checked"),
            hullTypes: checkedValues(".hullFilter:checked"),
            fuels: checkedValues(".fuelFilter:checked"),
            propulsion: checkedValues(".propulsionFilter:checked"),
            engineCounts: checkedValues(".engineCountFilter:checked").map(Number),
            twinEngines: false,
            flybridge: doc.getElementById("flybridgeFilter")?.value || "",
            sideDecks: doc.getElementById("sideDeckFilter")?.value || "",
            trailerable: doc.getElementById("trailerFilter")?.value || "",
            greatLoop: doc.getElementById("loopFilter")?.value || "",
            minimumBerths: null,
            minimumCabins: null,
            minimumHeads: null,
            crewComposition: doc.getElementById("crewComposition")?.value || "",
            tallestCrewHeight: numericValue("tallestCrewHeight"),
            guestFrequency: doc.getElementById("guestFrequency")?.value || "",
            featurePriorities: Array.from(doc.querySelectorAll("#discoverView .featurePriority")).reduce((result, node) => {
                if (node.value) result[node.dataset.feature] = node.value;
                return result;
            }, {})
        };
        const controls = {textSearch:'textSearch',minLength:'minLength',maxLength:'maxLength',minBeam:'minBeam',maxBeam:'maxBeam',maxDraft:'maxDraft',maxAirDraft:'maxAirDraft',flybridge:'flybridgeFilter',sideDecks:'sideDeckFilter',trailerable:'trailerFilter',greatLoop:'loopFilter',minimumBerths:'minimumBerths',minimumCabins:'minimumCabins',minimumHeads:'minimumHeads',crewComposition:'crewComposition',tallestCrewHeight:'tallestCrewHeight',guestFrequency:'guestFrequency'};
        const groups = {routes:'.routeFilter',styles:'.styleFilter',boatFamilies:'.familyFilter',configurations:'.configurationFilter',constructionMaterials:'.constructionFilter',hullTypes:'.hullFilter',fuels:'.fuelFilter',propulsion:'.propulsionFilter',engineCounts:'.engineCountFilter',featurePriorities:'.featurePriority'};
        for(const [key,id] of Object.entries(controls)) {
            if(!doc.getElementById(id))captured[key]=clone(state.searchSettings[key]);
            else if(['maxDraft','maxAirDraft'].includes(key))captured[key]=lengthFeetValue(id);
            else if(['minimumBerths','minimumCabins','minimumHeads'].includes(key))captured[key]=numericValue(id);
        }
        for(const [key,selector] of Object.entries(groups)){
            const nodes=Array.from(doc.querySelectorAll(`#discoverView ${selector}`));
            if(!nodes.length)captured[key]=clone(state.searchSettings[key]);
            else if(Array.isArray(captured[key])){
                const visible=new Set(nodes.map(node=>String(node.value)));
                captured[key].push(...(state.searchSettings[key]||[]).filter(value=>!visible.has(String(value))));
            }
        }
        if(!doc.querySelectorAll('#discoverView .engineCountFilter').length)captured.twinEngines=state.searchSettings.twinEngines;
        // Preserve saved requirements which this screen cannot edit; Clear explicitly resets them.
        return Object.assign({},clone(state.searchSettings),captured);
    }

    function captureFromDocument(documentRef, options) {
        return setSearchSettings(readFromDocument(documentRef), options);
    }

    global.BScoutSearchState = {
        DEFAULT_SEARCH_SETTINGS,
        createState,
        getState,
        setSearchSettings,
        setWorkspaceStatus,
        clear,
        subscribe,
        readFromDocument,
        captureFromDocument
    };
})(typeof window !== "undefined" ? window : globalThis);
