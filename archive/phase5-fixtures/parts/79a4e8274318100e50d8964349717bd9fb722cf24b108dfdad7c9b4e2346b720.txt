(function (global) {
    "use strict";

    let startupPromise = null;

    function renderStartupFailure(error) {
        const message = error && error.message ? error.message : "Unknown startup error.";
        console.error("B-Atlas failed to start:", error);

        if (!global.document) return;
        const target = global.document.getElementById("boat-listings");
        if (!target) return;

        target.innerHTML = `
            <section class="startup-error" role="alert">
                <h2>B-Atlas could not load its data</h2>
                <p>${escapeHtml(message)}</p>
                <p>Refresh the page after confirming the local server and data files are available.</p>
            </section>
        `;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function start(options) {
        if (startupPromise) return startupPromise;
        const settings = options || {};
        const repository = settings.repository || global.BScoutDataRepository;
        const imageManager = settings.imageManager || global.ImageAssetManager;
        const initialize = settings.initialize || global.initializeBScoutApplication;

        if (!repository || typeof repository.loadApplicationData !== "function") {
            return Promise.reject(new Error("B-Atlas Data Repository is unavailable."));
        }
        if (!imageManager || typeof imageManager.loadImageAssetRegistry !== "function") {
            return Promise.reject(new Error("B-Atlas Image Asset Manager is unavailable."));
        }
        if (typeof initialize !== "function") {
            return Promise.reject(new Error("B-Atlas application initializer is unavailable."));
        }

        startupPromise = Promise.all([
            repository.loadApplicationData(settings.repositoryOptions),
            imageManager.loadImageAssetRegistry(settings.fetchImpl)
        ])
            .then(([data]) => initialize(data))
            .catch(error => {
                startupPromise = null;
                renderStartupFailure(error);
                throw error;
            });

        return startupPromise;
    }

    function autoStart() {
        start().catch(() => {});
    }

    global.BScoutBootstrap = {
        start,
        escapeHtml,
        renderStartupFailure
    };

    if (global.document && !global.__BSCOUT_DISABLE_AUTO_START__) {
        if (global.document.readyState === "loading") {
            global.document.addEventListener("DOMContentLoaded", autoStart, { once: true });
        } else {
            autoStart();
        }
    }
})(typeof window !== "undefined" ? window : globalThis);
