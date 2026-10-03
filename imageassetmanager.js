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
        registryPromise = Promise.all([
            request("data/imageassets.json").then(response => {
                if (!response.ok) throw new Error(`Image registry failed to load (${response.status}).`);
                return response.json();
            }),
            request("data/imageassets-external-pilot.json")
                .then(response => response.ok ? response.json() : { assets: [] })
                .catch(() => ({ assets: [] }))
        ])
            .then(([registry, externalPilot]) => {
                assetByBoatModelId = new Map((registry.assets || []).map(asset => [asset.boatModelId, asset]));
                for (const asset of (externalPilot.assets || [])) {
                    const existing = assetByBoatModelId.get(asset.boatModelId);
                    const existingIsUsableLocal = existing &&
                        existing.status === "available" &&
                        existing.path &&
                        existing.path !== PLACEHOLDER_PATH;
                    if (!existingIsUsableLocal) assetByBoatModelId.set(asset.boatModelId, asset);
                }
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

    function externalImageURL(asset) {
        if (!asset || asset.status !== "external_reference") return "";
        return String(asset.externalThumbnailURL || asset.externalImageURL || "").trim();
    }

    function isExternalReference(assetOrBoat) {
        const asset = assetOrBoat && assetOrBoat.boatModelId !== undefined
            ? assetOrBoat
            : getBoatImageAsset(assetOrBoat);
        return Boolean(asset && asset.status === "external_reference" && externalImageURL(asset));
    }

    function getImageSourceInfo(boatOrId) {
        const asset = getBoatImageAsset(boatOrId);
        if (!isExternalReference(asset)) return null;
        return {
            sourcePageURL: String(asset.sourcePageURL || "").trim(),
            sourceDomain: String(asset.sourceDomain || "").trim(),
            matchConfidence: asset.matchConfidence || null,
            status: "external_reference"
        };
    }

    function resolveBoatImage(boatOrId) {
        // Priority: local/authorized registry image -> external reference -> explicit
        // legacy image -> canonical local path -> placeholder.
        const asset = getBoatImageAsset(boatOrId);
        if (asset && asset.status === "available" && asset.path && asset.path !== PLACEHOLDER_PATH) {
            return asset.path;
        }

        const external = externalImageURL(asset);
        if (external) return external;

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
        externalImageURL,
        isExternalReference,
        getImageSourceInfo,
        applyImageFallback,
        normalizeLegacyPath
    };
})(typeof window !== "undefined" ? window : globalThis);
