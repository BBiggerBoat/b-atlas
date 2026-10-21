(function (global) {
    "use strict";

    let context = { boats: [], routes: [], render: null, relationshipResolver: null };

    function configure(options) {
        context = Object.assign({}, context, options || {});
        return getContext();
    }

    function getContext() {
        return Object.assign({}, context, { boats: context.boats.slice(), routes: context.routes.slice() });
    }

    function execute(options) {
        const settings = options || {};
        const stateManager = settings.stateManager || global.BScoutSearchState;
        const filterEngine = settings.filterEngine || global.BScoutFilterEngine;
        const snapshot = settings.state || stateManager.getState();
        let boats;

        if (snapshot.workspaceStatus) {
            const resolver = settings.relationshipResolver || context.relationshipResolver;
            boats = context.boats.filter(boat => {
                if (typeof resolver !== "function") return false;
                const relationship = resolver(boat.BoatModelID);
                if (!relationship) return false;
                if (["Research", "Researching"].includes(snapshot.workspaceStatus)) {
                    return ["Research", "Researching"].includes(relationship.Status);
                }
                return relationship.Status === snapshot.workspaceStatus;
            });
        } else {
            boats = filterEngine.filterBoats(context.boats, snapshot.searchSettings, context.routes, settings.dependencies);
        }

        // Temporary acquisition aid. This control is intentionally outside SearchSettings
        // so it never becomes part of a saved search profile.
        const imageOnlyControl = global.document?.getElementById("hideModelsWithoutImages");
        if (imageOnlyControl?.checked && global.ImageAssetManager) {
            boats = boats.filter(boat =>
                global.ImageAssetManager.getBoatImageAsset(boat).status === "available"
            );
        }

        // Sorting changes order only. Unsupported saved sort keys are preserved.
        const sort = snapshot.sort || {};
        if (['Manufacturer','Model','LOA','Beam','score','confidence'].includes(sort.field)) {
            const value = boat => ['score','confidence'].includes(sort.field) ? filterEngine.preferenceAssessment(boat,snapshot.searchSettings,context.routes)[sort.field] : boat[sort.field];
            boats.sort((a,b) => {
                const left=value(a),right=value(b);
                if(left == null || right == null) return left == null ? right == null ? 0 : 1 : -1;
                const comparison=typeof left==='number' && typeof right==='number' ? left-right : String(left).localeCompare(String(right));
                return comparison*(sort.direction==='desc'?-1:1);
            });
        }
        const render = settings.render || context.render;
        if (settings.render !== false && typeof render === "function") render(boats);
        return { boats, count: boats.length, state: snapshot };
    }

    function searchFromDocument(documentRef, options) {
        const stateManager = options?.stateManager || global.BScoutSearchState;
        const snapshot = stateManager.captureFromDocument(documentRef, { source: "document-search" });
        return execute(Object.assign({}, options, { state: snapshot }));
    }

    function showWorkspaceStatus(status, options) {
        const stateManager = options?.stateManager || global.BScoutSearchState;
        const snapshot = stateManager.setWorkspaceStatus(status);
        return execute(Object.assign({}, options, { state: snapshot }));
    }

    function showAll(options) {
        const stateManager = options?.stateManager || global.BScoutSearchState;
        const snapshot = stateManager.clear({ source: "show-all" });
        return execute(Object.assign({}, options, { state: snapshot }));
    }

    global.BScoutSearchOrchestrator = { configure, getContext, execute, searchFromDocument, showWorkspaceStatus, showAll };
})(typeof window !== "undefined" ? window : globalThis);
