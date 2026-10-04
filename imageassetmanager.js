(function (global) {
    "use strict";

    const PLACEHOLDER_PATH = "images/boat-placeholder.svg";
    let registryPromise = null;
    let assetByBoatModelId = new Map();
    let candidatesByBoatModelId = new Map();

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
                .catch(() => ({ assets: [] })),
            request("data/image-candidates.json")
                .then(response => response.ok ? response.json() : { models: [] })
                .catch(() => ({ models: [] }))
        ])
            .then(([registry, externalPilot, candidateRegistry]) => {
                assetByBoatModelId = new Map((registry.assets || []).map(asset => [asset.boatModelId, asset]));
                candidatesByBoatModelId = new Map((candidateRegistry.models || []).map(item => [item.boatModelId, item]));
                for (const asset of (externalPilot.assets || [])) {
                    const existing = assetByBoatModelId.get(asset.boatModelId);
                    const existingIsUsableLocal = existing &&
                        existing.status === "available" &&
                        existing.path &&
                        existing.path !== PLACEHOLDER_PATH;
                    if (!existingIsUsableLocal) {
                        const candidateRecord = candidatesByBoatModelId.get(asset.boatModelId);
                        assetByBoatModelId.set(asset.boatModelId, candidateRecord
                            ? { ...asset, imageCandidates: candidateRecord.candidates || [], selectedCandidate: candidateRecord.selectedCandidate || 0 }
                            : asset);
                    }
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

    function externalCandidateURLs(asset) {
        if (!asset || asset.status !== "external_reference") return [];
        const ordered = [];
        const seen = new Set();
        const add = value => {
            const url = String(value || "").trim();
            if (!url || seen.has(url)) return;
            seen.add(url);
            ordered.push(url);
        };
        const candidates = Array.isArray(asset.imageCandidates) ? asset.imageCandidates : [];
        const selectedIndex = Number.isInteger(asset.selectedCandidate) ? asset.selectedCandidate : 0;
        if (candidates[selectedIndex]) add(candidates[selectedIndex].externalThumbnailURL);
        add(asset.externalThumbnailURL || asset.externalImageURL);
        candidates.forEach(candidate => add(candidate && candidate.externalThumbnailURL));
        return ordered;
    }

    function getExternalCandidate(boatOrId, url) {
        const asset = getBoatImageAsset(boatOrId);
        const candidates = Array.isArray(asset.imageCandidates) ? asset.imageCandidates : [];
        return candidates.find(candidate => String(candidate?.externalThumbnailURL || "").trim() === String(url || "").trim()) || null;
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

        const externalCandidates = externalCandidateURLs(asset);
        if (externalCandidates.length) return externalCandidates[0];

        const legacyPath = typeof boatOrId === "object" ? normalizeLegacyPath(boatOrId.ImageURL) : "";
        if (legacyPath && legacyPath !== PLACEHOLDER_PATH) return legacyPath;

        const canonicalPath = canonicalImagePath(boatOrId);
        return canonicalPath || PLACEHOLDER_PATH;
    }

    function applyImageFallback(imageElement, boatOrId) {
        if (!imageElement) return;
        const modelId = typeof boatOrId === "string"
            ? boatOrId
            : (boatOrId && boatOrId.BoatModelID) || imageElement.dataset.boatModelId || "";
        const asset = getBoatImageAsset(modelId || boatOrId);
        const candidates = externalCandidateURLs(asset);
        imageElement.dataset.imageCandidateIndex = String(Math.max(0, candidates.indexOf(imageElement.getAttribute("src"))));

        imageElement.onerror = function () {
            const currentSrc = imageElement.getAttribute("src") || "";
            const index = Number(imageElement.dataset.imageCandidateIndex || 0);
            const nextIndex = index + 1;
            if (candidates[nextIndex]) {
                imageElement.dataset.imageCandidateIndex = String(nextIndex);
                imageElement.dataset.imageStatus = "candidate-fallback";
                imageElement.setAttribute("src", candidates[nextIndex]);
                return;
            }
            if (currentSrc !== PLACEHOLDER_PATH) {
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
        externalCandidateURLs,
        getExternalCandidate,
        isExternalReference,
        getImageSourceInfo,
        applyImageFallback,
        normalizeLegacyPath
    };
})(typeof window !== "undefined" ? window : globalThis);
