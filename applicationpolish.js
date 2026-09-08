(function () {
    "use strict";

    const INFO_PAGES = {
        about: `
            <p class="workspace-eyebrow">About B-Atlas</p>
            <h1 class="information-page-title">Boat knowledge for better decisions.</h1>
            <p>B-Atlas helps people discover boats, research models, make better buying decisions and contribute knowledge that improves the permanent Guides.</p>
            <section class="information-section"><h3>What makes B-Atlas different?</h3><p>It is not another marketplace search. B-Atlas helps buyers understand which boats deserve further investigation and why.</p></section>
            <blockquote>Known undesirable information eliminates boats. Unknown information does not.</blockquote>
            <section class="information-section"><h3>How it works</h3><ul><li>Search broadly across boat families and missions.</li><li>Keep incomplete candidates visible with lower confidence.</li><li>Review model knowledge, ownership trade-offs and inspection priorities.</li><li>Save models, compare candidates and investigate actual boats for sale.</li><li>Create a Boat Watch for one or several models and use the prepared monitoring instructions with ChatGPT or another AI.</li></ul></section>
            <section class="information-section"><h3>Use your Saved Models across devices and browsers</h3><p>B-Atlas deliberately does not require a user account to move your Saved Models. Select the models you want, choose <strong>Move / Share</strong>, and copy the transfer link. Open that link on another computer, phone, tablet or browser—including Chrome, Edge or Firefox—and review the incoming models before merging or replacing anything.</p><p>Your Stage and Rating travel with every selected model. In <strong>Move</strong> mode, My Notes, Tags and research history are included by default regardless of whether the model is Interested, Shortlist, Researching or Rejected. Rejecting a model does not delete its notebook; only explicitly removing the Saved Model deletes that model-level record. Saved individual listings are intentionally excluded from Move / Share.</p></section><section class="information-section"><h3>Back up before a computer rebuild or browser reset</h3><p>Because personal research is stored locally rather than in a B-Atlas account, rebuilding a computer, clearing browser site data or resetting a browser can erase that browser’s local copy. Saved Models therefore includes <strong>Backup / Restore</strong>. Download the backup file before a rebuild and keep it with your normal files or backups; restore it afterward in any supported browser.</p><p>The backup includes Saved Models, stages, ratings, notes, tags and history, plus Saved Listings, saved Find Your Boat profiles and owned-boat records. The backup file is created and restored locally; B-Atlas does not need to receive it.</p></section>
            <section class="information-section"><h3>Privacy and data security by design</h3><p>Saved Models remain local to the browser unless you deliberately create a transfer link. The transfer data is encoded in the URL fragment after the <strong>#</strong> symbol, which browsers normally keep out of the page request sent to the B-Atlas server. B-Atlas does not need an account or a server-side personal profile for this workflow.</p><p>This approach is intentionally simple and may require an extra copy-and-open step, but it reduces the amount of personal research data B-Atlas needs to hold. A transfer link can contain the information you chose to include, so it should be treated as private and shared only with people or devices you trust.</p></section>
            <section class="information-section"><h3>The lifecycle</h3><p>Discover → Research → Decide → Contribute → Improve. Community knowledge is reviewed before it changes the permanent Guide.</p></section>
            <section class="information-section"><h3>Support B-Atlas</h3><p>B-Atlas is free and independent. If it has helped you, voluntary support helps keep the project available and improving.</p><p><a class="workspace-primary-action" href="https://ko-fi.com/batlas" target="_blank" rel="noopener noreferrer">Support B-Atlas on Ko-fi</a></p></section>`,
        contact: `
            <p class="workspace-eyebrow">Contact</p><h1 class="information-page-title">Contact B-Atlas</h1>
            <p>B-Atlas is currently a prototype and public-interest boat knowledge project.</p>
            <p>Contact details and feedback channels will be added before public release.</p>`,
        privacy: `
            <p class="workspace-eyebrow">Privacy</p><h1 class="information-page-title">Local-first personal research</h1>
            <p>B-Atlas stores Saved Models, notes, search preferences and comparison selections in your browser's local storage. No user account or cloud profile is required.</p>
            <p>You can deliberately move selected Saved Models to another device or browser by creating a transfer link. The transfer is encoded in the URL fragment after the # symbol and is not stored by B-Atlas as a personal account record. You review the incoming models before merging or replacing anything.</p>
            <p>Because a transfer link can contain Stage, Rating and any Notes, Tags or history you elect to include, treat that link as private. Clearing browser storage can still remove locally stored work, so the transfer feature can also be used to move important Saved Models before changing browsers or devices. Community contributions are separate and are submitted only when you deliberately choose to contribute.</p>`
    };

    function viewURL(view, extra = {}) {
        if (view === "guide" && extra.url) return extra.url;
        if (view === "guided") return "/#find-your-boat";
        if (view === "discover") return "/#boat-models";
        if (view === "contribute") return "/#help-build-b-atlas";
        if (view === "saved-models") return "/saved-models/";
        if (view === "about") return "/about/";
        if (view === "privacy") return "/privacy/";
        if (view === "home") return "/";
        return undefined;
    }
    function updateHistory(view, extra = {}, replace = false) {
        const state = Object.assign({ bscoutView: view }, extra);
        const method = replace ? "replaceState" : "pushState";
        const url = viewURL(view, extra);
        if (window.history?.[method]) window.history[method](state, "", url);
    }


    function scrollViewTop(node) {
        if (!node) return;
        const header = document.querySelector(".site-header");
        const offset = (header?.getBoundingClientRect().height || 72) + 18;
        const top = node.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = "none";
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = "block";
    }

    function hidePrimaryViews(exceptId = "") {
        ["lifecycleHome","discoverView","boatGuideView","guidedMatchView","contributionView","decisionWorkspaceModal","informationModal"].forEach(id => {
            if (id === exceptId) return;
            const node = document.getElementById(id);
            if (!node) return;
            node.hidden = true;
            if (id === "decisionWorkspaceModal" || id === "informationModal") node.style.display = "none";
        });
    }

    function openInfo(page, options = {}) {
        const content = document.getElementById("informationModalContent");
        const view = document.getElementById("informationModal");
        if (!content || !view || !INFO_PAGES[page]) return;
        hidePrimaryViews("informationModal");
        document.querySelectorAll(".modal").forEach(modal => { modal.style.display = "none"; });
        content.innerHTML = INFO_PAGES[page];
        view.hidden = false;
        view.style.display = "block";
        if (options.history !== false) updateHistory(page);
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    function showDiscover(options = {}) {
        if (options.history !== false) updateHistory("discover");
        hidePrimaryViews("discoverView");
        window.BScoutOwnership?.hideOwnedView();
        closeModal("informationModal");
        const home = document.getElementById("lifecycleHome");
        const discover = document.getElementById("discoverView");
        const guide = document.getElementById("boatGuideView");
        const guided = document.getElementById("guidedMatchView");
        const contribute = document.getElementById("contributionView");
        if (home) home.hidden = true;
        if (guide) guide.hidden = true;
        if (guided) guided.hidden = true;
        if (contribute) contribute.hidden = true;
        if (discover) discover.hidden = false;
        scrollViewTop(discover);
        if (options.focusSearch) document.getElementById("textSearch")?.focus();
    }

    function showHome(options = {}) {
        if (options.history !== false) updateHistory("home");
        hidePrimaryViews("lifecycleHome");
        window.BScoutOwnership?.hideOwnedView();
        document.querySelectorAll(".modal").forEach(modal => { modal.style.display = "none"; });
        const home = document.getElementById("lifecycleHome");
        const discover = document.getElementById("discoverView");
        const guide = document.getElementById("boatGuideView");
        const guided = document.getElementById("guidedMatchView");
        const contribute = document.getElementById("contributionView");
        if (home) home.hidden = false;
        if (discover) discover.hidden = true;
        if (guide) guide.hidden = true;
        if (guided) guided.hidden = true;
        if (contribute) contribute.hidden = true;
        scrollViewTop(home);
    }


    function showGuidedMatches(options = {}) {
        if (options.history !== false) updateHistory("guided", { guidedStep });
        hidePrimaryViews("guidedMatchView");
        window.BScoutOwnership?.hideOwnedView();
        closeModal("informationModal");
        const home = document.getElementById("lifecycleHome");
        const discover = document.getElementById("discoverView");
        const guide = document.getElementById("boatGuideView");
        const guided = document.getElementById("guidedMatchView");
        const contribute = document.getElementById("contributionView");
        if (home) home.hidden = true;
        if (discover) discover.hidden = true;
        if (guide) guide.hidden = true;
        if (guided) guided.hidden = false;
        if (contribute) contribute.hidden = true;
        initializeGuidedProfile();
        scrollViewTop(guided);
    }

    let guidedStep = 0;
    const GUIDED_DESCRIPTIONS = {
        Trawler: "Roomy, economical cruising at modest speed; usually prioritizes comfort and range over speed.",
        Cruiser: "General-purpose accommodation with more speed; layout and economy vary widely.",
        Tug: "Compact, practical cruising style with a protected helm and distinctive workboat character.",
        Downeast: "Low-profile coastal layout, efficient at moderate speeds and often easy to handle from the helm.",
        Sportfisher: "Large cockpit and faster running; fishing space is prioritized over interior living space.",
        "Motor Yacht": "More interior volume and separate living areas; often larger, heavier and more complex.",
        "Full Displacement": "Most efficient at slow speed, steady and predictable, but cannot plane or travel fast.",
        "Semi-Displacement": "A compromise between economical slow cruising and moderate speed, usually with higher fuel use when pushed.",
        Planing: "Designed to rise and run quickly; fast and responsive, but generally uses more fuel at cruising speed.",
        Diesel: "Usually best fuel economy and durability for regular cruising; engines and repairs can cost more initially.",
        Gas: "Often cheaper to buy and familiar to service; normally higher fuel use and requires careful fuel-system safety.",
        Shaft: "Simple, durable inboard drive with good service life; deeper underwater gear and less agile manoeuvring without thrusters or twins.",
        Outboard: "Easy engine access, shallow-water capability and strong manoeuvrability; uses transom space and may be less economical at displacement speed.",
        "Stern Drive": "Automotive-style engine with steerable drive gives good manoeuvrability and speed; underwater drive maintenance is more involved.",
        "1": "One propulsion engine. Usually simpler, cheaper to service and more space-efficient, but without propulsion redundancy if the engine becomes unavailable.",
        "2": "Two propulsion engines. Adds redundancy and often improves docking control, but increases purchase, fuel and maintenance costs."
    };

    const GUIDED_FEATURE_DESCRIPTIONS = {
        "Walkthrough Transom": "Creates direct cockpit-to-platform access for boarding, swimming, pets and dockside movement.",
        "Wide Side Decks": "Makes moving fore and aft safer and easier when handling lines, fenders or anchors.",
        "Side Helm Door": "Lets the helmsperson reach a side deck quickly for docking and line handling.",
        "Galley Up with Helm": "Keeps cooking, navigation and social space together on the main level while underway.",
        "Air Conditioning": "Improves summer comfort at dock or on shore power.",
        "Generator": "Supports air conditioning and onboard systems away from shore power.",
        "Bow Thruster": "Makes docking and close-quarters manoeuvring easier.",
        "Stern Thruster": "Improves close-quarters control, especially in wind or current.",
        "Flybridge": "Adds visibility, ventilation and a second helm position.",
        "Lower Helm": "Allows protected operation in poor weather or cool conditions.",
        "Inside Helm": "Allows protected operation in poor weather or cool conditions.",
        "Side Decks": "Makes line handling and moving forward safer and easier.",
        "Walkaround Side Decks": "Makes line handling and moving forward safer and easier.",
        "Teak Interior": "Adds traditional warmth and classic character.",
        "Wood Interior": "Adds traditional warmth and classic character.",
        "Two Cabins": "Provides privacy and sleeping flexibility for cruising couples or guests.",
        "Twin Cabins": "Provides privacy and sleeping flexibility for cruising couples or guests.",
        "Two Heads": "Reduces sharing pressure for guests and longer trips.",
        "Separate Shower": "Improves comfort for extended cruising and liveability.",
        "Aft Cabin": "Adds a private stateroom separated from the main salon.",
        "Removable Flybridge": "Can help with bridge clearance, transport and winter storage.",
        "Long Keel": "Improves tracking and often protects running gear.",
        "Skeg-Hung Rudder": "Adds rudder protection and directional stability.",
        "Trailerable": "Can reduce marina dependence and widen cruising options."
    };

    const GUIDED_FEATURE_ICONS = {
        "Air Conditioning": "snowflake",
        "Generator": "bolt",
        "Bow Thruster": "propeller",
        "Stern Thruster": "propeller",
        "Flybridge": "globe",
        "Lower Helm": "helm",
        "Inside Helm": "helm",
        "Side Decks": "deck",
        "Walkaround Side Decks": "deck",
        "Teak Interior": "wood",
        "Wood Interior": "wood",
        "Two Cabins": "cabins",
        "Twin Cabins": "cabins",
        "Two Heads": "heads",
        "Separate Shower": "shower",
        "Aft Cabin": "bed",
        "Removable Flybridge": "bridge",
        "Long Keel": "keel",
        "Skeg-Hung Rudder": "shield",
    };

    function slugifyLabel(value = "") {
        return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }

    function guidedSvgIcon(name) {
        const icons = {
            globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a14 14 0 0 0 0 18"></path><path d="M12 3a14 14 0 0 1 0 18"></path></svg>',
            dimensions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M4 17h10"></path><path d="M4 5l-2 2 2 2"></path><path d="M20 5l2 2-2 2"></path><path d="M12 21V9"></path><path d="M10 19l2 2 2-2"></path><path d="M10 11l2-2 2 2"></path></svg>',
            model: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h16l2 3H8c-2 0-3.3-.9-5-3Z"></path><path d="M10 10h5l2 5H6l4-5Z"></path></svg>',
            systems: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h8"></path><path d="M4 12h12"></path><path d="M4 16h8"></path><circle cx="18" cy="8" r="2"></circle><circle cx="20" cy="12" r="2"></circle><circle cx="18" cy="16" r="2"></circle></svg>',
            fuel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h9v14H6z"></path><path d="M9 9h3"></path><path d="M15 8h2l2 2v5a2 2 0 0 0 4 0v-3"></path></svg>',
            propeller: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2"></circle><path d="M12 3c3 0 4 3.4 2.2 5.2S9 9 7.2 7.2 9 3 12 3Z"></path><path d="M20.5 14.5c-1.5 2.6-5 1.8-6.1-.5s.4-4.4 2.7-5 4.9 2.9 3.4 5.5Z"></path><path d="M6.3 19.3C4 17.6 5 14.1 7.4 13.3s4.4 1.2 4.7 3.6-3.5 4.1-5.8 2.4Z"></path></svg>',
            engine: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h11v7H4z"></path><path d="M15 12h3l2 2v3h-2"></path><path d="M7 10V7h4v3"></path><circle cx="8" cy="18" r="1"></circle><circle cx="13" cy="18" r="1"></circle></svg>',
            features: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h10"></path><circle cx="8" cy="7" r="2"></circle><circle cx="16" cy="12" r="2"></circle><circle cx="12" cy="17" r="2"></circle></svg>',
            people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2.5"></circle><circle cx="16" cy="9" r="2.5"></circle><path d="M3.5 18c.6-2.5 2.6-4 5-4s4.4 1.5 5 4"></path><path d="M12.5 18c.5-2.1 2.1-3.4 4.2-3.4s3.8 1.3 4.3 3.4"></path></svg>',
            snowflake: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M5 7l14 10"></path><path d="M19 7L5 17"></path></svg>',
            bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z"></path></svg>',
            helm: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M5 5l3 3"></path><path d="M16 16l3 3"></path><path d="M19 5l-3 3"></path><path d="M8 16l-3 3"></path></svg>',
            bridge: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h16"></path><path d="M7 14V9h10v5"></path><path d="M10 9V6h4v3"></path><path d="M6 18h12"></path></svg>',
            deck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h16"></path><path d="M6 10h12"></path><path d="M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 2-2"></path></svg>',
            wood: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16"></path><path d="M12 4v16"></path><path d="M17 4v16"></path><path d="M5 8c1 0 1 .8 2 .8S8 8 9 8s1 .8 2 .8S12 8 13 8"></path><path d="M11 14c1 0 1 .8 2 .8s1-.8 2-.8 1 .8 2 .8 1-.8 2-.8"></path></svg>',
            cabins: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h8v11H3z"></path><path d="M13 8h8v11h-8z"></path><path d="M7 12h.01"></path><path d="M17 12h.01"></path></svg>',
            heads: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0Z"></path><path d="M9 16h6"></path><path d="M7 19h10"></path></svg>',
            shower: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7a4 4 0 1 1 8 0v3"></path><path d="M8 10h9"></path><path d="M16 10l3 3"></path><path d="M17 15v.01"></path><path d="M14 16v.01"></path><path d="M11 15v.01"></path></svg>',
            trailer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h11l3 3H8c-2.1 0-3.7-.9-5-3Z"></path><circle cx="8" cy="19" r="1.8"></circle><circle cx="18" cy="19" r="1.8"></circle><path d="M17 8h3l2 3"></path></svg>',
            shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 7.7 7 10 4.2-2.3 7-5.5 7-10V6l-7-3Z"></path></svg>',
            anchor: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><path d="M12 7v11"></path><path d="M8 11H5"></path><path d="M19 11h-3"></path><path d="M6 12a6 6 0 0 0 12 0"></path></svg>',
            bed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16v6H4z"></path><path d="M4 10V7h6a2 2 0 0 1 2 2v1"></path><path d="M4 18v2"></path><path d="M20 18v2"></path></svg>',
            keel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h15l2 3H6c-1.8 0-2.6-.7-3-3Z"></path><path d="M11 13v6l-2-2"></path></svg>',
            genericBoat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 15.5h16l2.5 3H8.2c-2.2 0-3.8-.8-5.7-3Z"></path><path d="M9 10h5.5l2 5H6.2L9 10Z"></path></svg>'
        };
        return icons[name] || icons.genericBoat;
    }

    function familyVisual(label) {
        const key = slugifyLabel(label);
        const approved = {
            trawler: "images/style-icons/trawler.png",
            cruiser: "images/style-icons/express-cruiser.png",
            tug: "images/style-icons/tug.png",
            downeast: "images/style-icons/downeast.png",
            sportfisher: "images/style-icons/sportfisher.png",
            "motor-yacht": "images/style-icons/motor-yacht.png"
        };
        if (approved[key]) {
            return `<img src="${approved[key]}" alt="" loading="lazy" decoding="async">`;
        }
        return guidedSvgIcon("genericBoat");
    }

    function buildGuidedVisual(className, labelText, sourceValue) {
        const normalized = slugifyLabel(labelText || sourceValue || '');
        if (className === 'familyFilter') {
            return `<div class="guided-option-visual guided-boat-visual guided-boat-${normalized}" aria-hidden="true">${familyVisual(labelText || sourceValue)}</div>`;
        }
        if (className === 'engineCountFilter') return '';
        return '';
    }

    function buildFeatureIcon(featureName) {
        const iconName = GUIDED_FEATURE_ICONS[featureName];
        if (!iconName) return "";
        return `<div class="guided-feature-icon" aria-hidden="true">${guidedSvgIcon(iconName)}</div>`;
    }

    function sourceControls(selector) {
        return document.querySelectorAll(`#discoverView ${selector}`);
    }

    function cloneChoices(target) {
        const className = target.dataset.mirrorClass;
        if (!className || target.dataset.ready) return;
        sourceControls(`.${className}`).forEach(source => {
            const labelText = source.closest("label")?.textContent?.trim() || source.value;
            const wrapper = document.createElement("label");
            wrapper.className = "guided-choice";
            if (GUIDED_DESCRIPTIONS[source.value]) wrapper.classList.add("guided-info-choice");
            if (className === "familyFilter") wrapper.classList.add("guided-choice-visual");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.dataset.guidedSourceValue = source.value;
            input.checked = source.checked;
            input.addEventListener("change", () => {
                source.checked = input.checked;
                source.dispatchEvent(new Event("change", { bubbles: true }));
            });
            source.addEventListener("change", () => { input.checked = source.checked; });
            const text = document.createElement("span");
            const title = document.createElement("strong");
            title.textContent = (className === "familyFilter" && source.value === "Cruiser") ? "Express Cruiser" : labelText;
            text.appendChild(title);
            if (GUIDED_DESCRIPTIONS[source.value]) {
                const description = document.createElement("small");
                description.textContent = GUIDED_DESCRIPTIONS[source.value];
                text.appendChild(description);
            }
            const visualMarkup = buildGuidedVisual(className, labelText, source.value);
            if (visualMarkup) {
                const visual = document.createElement("div");
                visual.innerHTML = visualMarkup;
                wrapper.append(visual.firstElementChild);
            }
            wrapper.append(input, text);
            target.appendChild(wrapper);
        });
        target.dataset.ready = "true";
    }

    function mirrorStandardPreferences() {
        const target = document.getElementById("guidedStandardPreferences");
        if (!target || target.dataset.ready) return;
        sourceControls(".featurePriority").forEach(source => {
            const row = document.createElement("label");
            row.className = "guided-preference-row";
            const featureName = source.closest(".feature-priority-row")?.querySelector("span")?.textContent?.trim() || source.dataset.feature;
            const featureKey = source.dataset.feature || featureName;
            const copyWrap = document.createElement("div");
            copyWrap.className = "guided-preference-copywrap guided-preference-copywrap-text-only";
            const copy = document.createElement("div");
            copy.className = "guided-preference-copy";
            const name = document.createElement("span");
            name.textContent = featureName;
            copy.appendChild(name);
            if (GUIDED_FEATURE_DESCRIPTIONS[featureKey]) {
                const detail = document.createElement("small");
                detail.textContent = GUIDED_FEATURE_DESCRIPTIONS[featureKey];
                copy.appendChild(detail);
            }
            const select = document.createElement("select");
            select.innerHTML = source.innerHTML;
            select.value = source.value;
            select.setAttribute("aria-label", `${featureName} priority`);
            select.addEventListener("change", () => {
                source.value = select.value;
                source.dispatchEvent(new Event("change", { bubbles: true }));
            });
            source.addEventListener("change", () => { select.value = source.value; });
            copyWrap.append(copy);
            row.append(copyWrap, select);
            target.appendChild(row);
        });
        target.dataset.ready = "true";
    }

    function mirrorFields() {
        document.querySelectorAll("#guidedMatchView [data-mirror-id]").forEach(mirror => {
            if (mirror.dataset.ready) return;
            const source = document.getElementById(mirror.dataset.mirrorId);
            if (!source) return;
            if (mirror.tagName === "SELECT") mirror.innerHTML = source.innerHTML;
            mirror.value = source.value;
            const syncToSource = () => {
                source.value = mirror.value;
                source.dispatchEvent(new Event("change", { bubbles: true }));
                source.dispatchEvent(new Event("input", { bubbles: true }));
            };
            mirror.addEventListener("change", syncToSource);
            mirror.addEventListener("input", syncToSource);
            source.addEventListener("change", () => { mirror.value = source.value; });
            source.addEventListener("input", () => { mirror.value = source.value; });
            mirror.dataset.ready = "true";
        });
    }

    function initializeCrewScenarioCards() {
        const cards = document.querySelectorAll("#guidedCrewCards .guided-crew-card");
        const crewSelect = document.querySelector('#guidedMatchView [data-mirror-id="crewComposition"]');
        if (!cards.length || !crewSelect || cards[0].dataset.ready) return;
        const sync = () => {
            cards.forEach(card => card.classList.toggle('active', crewSelect.value === card.dataset.crewValue));
        };
        cards.forEach(card => {
            card.dataset.ready = 'true';
            card.addEventListener('click', () => {
                crewSelect.value = card.dataset.crewValue;
                crewSelect.dispatchEvent(new Event('change', { bubbles: true }));
                sync();
            });
        });
        crewSelect.addEventListener('change', sync);
        sync();
    }

    function renderGuidedStep() {
        const steps = [...document.querySelectorAll("#guidedMatchView .guided-step")];
        guidedStep = Math.max(0, Math.min(guidedStep, steps.length - 1));
        steps.forEach((step, index) => {
            step.hidden = index !== guidedStep;
            step.classList.toggle("active", index === guidedStep);
        });
        const pct = ((guidedStep + 1) / steps.length) * 100;
        const bar = document.getElementById("guidedProgressBar");
        if (bar) bar.style.width = `${pct}%`;
        const text = document.getElementById("guidedProgressText");
        if (text) text.textContent = `Step ${guidedStep + 1} of ${steps.length}`;
        const prev = document.getElementById("guidedPrevious");
        if (prev) prev.disabled = guidedStep === 0;
        const next = document.getElementById("guidedNext");
        if (next) next.hidden = guidedStep === steps.length - 1;
        const view = document.getElementById("guidedViewMatches");
        if (view) view.hidden = guidedStep !== steps.length - 1;
    }

    function initializeGuidedProfile() {
        document.querySelectorAll("#guidedMatchView [data-mirror-class]").forEach(cloneChoices);
        mirrorStandardPreferences();
        mirrorFields();
        renderGuidedStep();
    }

    function openSavedBoats(options = {}) {
        closeModal("informationModal");
        if (typeof window.openDecisionWorkspace === "function") window.openDecisionWorkspace(options);
        else document.getElementById("openDecisionWorkspaceBtn")?.click();
    }

    function openMyBoats(mode = "own") {
        closeModal("informationModal");
        if (window.BScoutOwnership) window.BScoutOwnership.openMyBoats(null, mode);
    }


    document.addEventListener("click", event => {
        const actionTarget = event.target.closest("[data-app-action]");
        if (actionTarget) {
            event.preventDefault();
            const action = actionTarget.dataset.appAction;
            if (action === "home") showHome();
            else if (action === "plan") {
                if (typeof window.resetSearchControls === "function") window.resetSearchControls();
                if (window.BScoutSearchState?.clear) window.BScoutSearchState.clear({ source: "new-plan" });
                guidedStep = 0;
                showGuidedMatches();
            }
            else if (action === "dream") showDiscover({ focusSearch: false });
            else if (action === "research") showDiscover({ focusSearch: true });
            else if (action === "buy") openSavedBoats();
            else if (action === "own") openMyBoats("own");
            else if (action === "sell") openMyBoats("sell");
            else if (action === "discover" || action === "research-models" || action === "boat-guides") showDiscover({ focusSearch: action !== "discover" });
            else if (action === "find-matches") showGuidedMatches();
            else if (action === "saved-models" || action === "saved-boats") openSavedBoats();
            else if (action === "contribute") window.BScoutContributions?.openGlobal();
            else if (action === "my-boats") openMyBoats("own");
            else openInfo(action);
            return;
        }

        const back = event.target.closest("[data-close-modal]");
        if (back) {
            event.preventDefault();
            closeModal(back.dataset.closeModal);
            const returnModal = back.dataset.openModal || "";
            window.BScoutWorkspaceReturnModal = "";
            if (returnModal) openModal(returnModal);
        }
    });

    function moveGuidedStep(delta) {
        const total = document.querySelectorAll("#guidedMatchView .guided-step").length;
        const nextStep = Math.max(0, Math.min(total - 1, guidedStep + delta));
        if (nextStep === guidedStep) return;
        guidedStep = nextStep;
        renderGuidedStep();
        updateHistory("guided", { guidedStep });
        scrollViewTop(document.querySelector("#guidedMatchView .guided-match-header"));
    }
    document.getElementById("guidedPrevious")?.addEventListener("click", () => moveGuidedStep(-1));
    document.getElementById("guidedNext")?.addEventListener("click", () => moveGuidedStep(1));
    document.getElementById("guidedViewMatches")?.addEventListener("click",()=>{showDiscover();requestAnimationFrame(()=>{if(typeof window.runCurrentSearch==="function") window.runCurrentSearch(); else document.getElementById("searchButton")?.click();});});
    document.getElementById("closeModal")?.addEventListener("click", () => showDiscover());
    document.getElementById("closeInformationModal")?.addEventListener("click", () => closeModal("informationModal"));

    if (!window.history.state?.bscoutView) {
        const requestedModel = new URLSearchParams(window.location.search).get("model");
        const path = window.location.pathname.replace(/\/+$/, "") || "/";
        const hash = String(window.location.hash || "").toLowerCase();
        if (requestedModel) window.history.replaceState({ bscoutView:"guide", boatModelId:requestedModel, pendingDeepLink:true }, "", window.location.href);
        else if (path === "/saved-models" && hash.startsWith("#saved-models-transfer=")) window.history.replaceState({ bscoutView:"saved-models" }, "", window.location.href);
        else if (path === "/saved-models") updateHistory("saved-models", {}, true);
        else if (path === "/about") updateHistory("about", {}, true);
        else if (path === "/privacy") updateHistory("privacy", {}, true);
        else if (hash === "#find-your-boat") updateHistory("guided", { guidedStep:0 }, true);
        else if (hash === "#boat-models") updateHistory("discover", {}, true);
        else if (hash === "#help-build-b-atlas") updateHistory("contribute", {}, true);
        else updateHistory("home", {}, true);
    }
    const initialView = window.history.state?.bscoutView;
    if (initialView === "saved-models") requestAnimationFrame(() => openSavedBoats({ history:false }));
    else if (initialView === "about") requestAnimationFrame(() => openInfo("about", { history:false }));
    else if (initialView === "privacy") requestAnimationFrame(() => openInfo("privacy", { history:false }));
    else if (initialView === "guided") requestAnimationFrame(() => { guidedStep = Number.isInteger(window.history.state?.guidedStep) ? window.history.state.guidedStep : 0; showGuidedMatches({ history:false }); renderGuidedStep(); });
    else if (initialView === "discover") requestAnimationFrame(() => showDiscover({ history:false }));
    else if (initialView === "contribute") requestAnimationFrame(() => window.BScoutContributions?.openGlobal({ history:false }));
    window.addEventListener("popstate", event => {
        const state = event.state || { bscoutView: "home" };
        if (state.bscoutView === "guide") {
            const boats = (typeof allBoats !== "undefined" && Array.isArray(allBoats)) ? allBoats : [];
            const boat = boats.find(item => String(item.BoatModelID) === String(state.boatModelId || ""));
            if (boat && window.BScoutBoatWorkspace?.open) window.BScoutBoatWorkspace.open(boat, state.tab || "research", { history: false });
            return;
        }
        if (state.bscoutView === "contribute") {
            window.BScoutContributions?.openGlobal({ history: false });
            return;
        }
        if (state.bscoutView === "saved-models") { openSavedBoats({ history:false }); return; }
        if (state.bscoutView === "about" || state.bscoutView === "privacy") { openInfo(state.bscoutView, { history:false }); return; }
        if (state.bscoutView === "guided") {
            guidedStep = Number.isInteger(state.guidedStep) ? state.guidedStep : 0;
            showGuidedMatches({ history: false });
            renderGuidedStep();
        } else if (state.bscoutView === "discover") showDiscover({ history: false });
        else showHome({ history: false });
    });
    window.BScoutNavigation = { push: (view, extra = {}) => updateHistory(view, extra), replace: (view, extra = {}) => updateHistory(view, extra, true) };

    window.BScoutApplicationPolish = { openInfo, openMyBoats, openSavedBoats, showDiscover, showGuidedMatches, showHome, closeModal };
})();
