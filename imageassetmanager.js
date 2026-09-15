(function (global) {
    "use strict";

    const PLACEHOLDER_PATH = "images/boat-placeholder.svg";
    let registryPromise = null;
    let assetByBoatModelId = new Map();

    function loadImageAssetRegistry(fetchImpl) {
        if (registryPromise) return registryPromise;
        const request = fetchImpl || global.fetch;
        if (typeof request !== "function") {
            return Promise.reject(new Error("Image Asset Registry requires fetch."));
        }
        registryPromise = request("data/imageassets.json")
            .then(response => {
                if (!response.ok) throw new Error(`Image registry failed to load (${response.status}).`);
                return response.json();
            })
            .then(registry => {
                assetByBoatModelId = new Map((registry.assets || []).map(asset => [asset.boatModelId, asset]));
                return registry;
            })
            .catch(error => {
                registryPromise = null;
                throw error;
            });
        return registryPromise;
    }

    function normalizeLegacyPath(path) {
        if (!path) return "";
        return String(path).replace(/\\/g, "/").replace(/^Images\//, "images/");
    }

    function getBoatImageAsset(boatOrId) {
        const id = typeof boatOrId === "string" ? boatOrId : boatOrId && boatOrId.BoatModelID;
        const registered = id ? assetByBoatModelId.get(id) : null;
        if (registered) return registered;
        const legacyPath = typeof boatOrId === "object" ? normalizeLegacyPath(boatOrId.ImageURL) : "";
        return {
            boatModelId: id || "",
            role: "representative",
            status: legacyPath ? "unregistered" : "missing",
            path: legacyPath || PLACEHOLDER_PATH,
            requestedPath: legacyPath,
            provenance: { status: "unknown" },
            publicUseEligible: false
        };
    }

    function canonicalImagePath(boatOrId) {
        const id = typeof boatOrId === "string" ? boatOrId : boatOrId && boatOrId.BoatModelID;
        return id ? `images/${String(id).toLowerCase()}.jpg` : "";
    }

    function resolveBoatImage(boatOrId) {
        // Prefer a verified registry asset, then the model's explicit image reference.
        // Fall back to the BoatModelID-derived path only when neither is usable.
        // This preserves legacy approved filenames while still supporting canonical IDs.
        const asset = getBoatImageAsset(boatOrId);
        if (asset && asset.status === "available" && asset.path && asset.path !== PLACEHOLDER_PATH) {
            return asset.path;
        }

        const legacyPath = typeof boatOrId === "object" ? normalizeLegacyPath(boatOrId.ImageURL) : "";
        if (legacyPath && legacyPath !== PLACEHOLDER_PATH) return legacyPath;

        const canonicalPath = canonicalImagePath(boatOrId);
        return canonicalPath || PLACEHOLDER_PATH;
    }

    function applyImageFallback(imageElement) {
        if (!imageElement) return;
        imageElement.onerror = function () {
            if (imageElement.getAttribute("src") !== PLACEHOLDER_PATH) {
                imageElement.setAttribute("src", PLACEHOLDER_PATH);
                imageElement.dataset.imageStatus = "missing";
            }
        };
        imageElement.onload = function () {
            if (imageElement.getAttribute("src") !== PLACEHOLDER_PATH) {
                imageElement.dataset.imageStatus = "available";
            }
        };
    }

    global.ImageAssetManager = {
        PLACEHOLDER_PATH,
        loadImageAssetRegistry,
        getBoatImageAsset,
        canonicalImagePath,
        resolveBoatImage,
        applyImageFallback,
        normalizeLegacyPath
    };
})(typeof window !== "undefined" ? window : globalThis);
