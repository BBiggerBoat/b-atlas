(function (root) {
    "use strict";

    let taxonomy = null;
    let modelCatalog = null;
    let modelSchema = null;
    let unitRegistry = null;
    let localeMessages = {};
    let returnContext = { source: "global" };
    let selectedType = null;
    let scoreImpact = null;
    const COMMUNITY_API_BASE = "https://api.b-atlas.org";

    const STORAGE_KEY = "bscoutPendingContributionsV1";
    const ATTACHMENT_DB = "bscoutContributionAttachmentsV1";
    const ATTACHMENT_STORE = "files";
    const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
    const MAX_PHOTO_FILES = 8;
    const MAX_PHOTO_TOTAL_BYTES = 30 * 1024 * 1024;
    const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
    const RATE_LIMIT_KEY = "bscoutContributionRateV1";
    const RATE_WINDOW_MS = 10 * 60 * 1000;
    const RATE_WINDOW_MAX = 5;
    const RATE_DAY_MS = 24 * 60 * 60 * 1000;
    const RATE_DAY_MAX = 20;
    const MIN_FORM_DWELL_MS = 1800;
    let formOpenedAt = 0;
    const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf"]);
    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

    const implementedTypes = new Set(["ownership_experience", "problem_weakness", "buyer_inspection_advice", "correction", "other", "photo", "manual_document", "resource", "new_model", "new_manufacturer"]);
    const laterPhase = {};

    const fallbackModelFields = [
        ["FirstYear", "First production year"], ["LastYear", "Last production year"],
        ["LOA", "Length overall (LOA)"], ["Beam", "Beam"], ["Draft", "Draft"],
        ["Displacement", "Displacement"], ["NormalizedFuel", "Fuel"],
        ["NormalizedPropulsion", "Propulsion"], ["EngineCount", "Engine count"],
        ["BoatFamily", "Boat family"], ["HullBehaviour", "Hull behaviour"],
        ["KeelConfiguration", "Keel configuration"], ["RudderType", "Rudder type"],
        ["Trailerable", "Trailerable"], ["Other", "Something else"]
    ];

    async function loadModelSchema() {
        if (modelSchema) return modelSchema;
        try {
            const [schemaResponse, unitResponse, localeResponse] = await Promise.all([
                fetch("data/model-schema.json", { cache: "no-store" }),
                fetch("data/unit-registry.json", { cache: "no-store" }),
                fetch("data/i18n/en.json", { cache: "no-store" })
            ]);
            if (!schemaResponse.ok) throw new Error(`Model schema HTTP ${schemaResponse.status}`);
            modelSchema = await schemaResponse.json();
            unitRegistry = unitResponse.ok ? await unitResponse.json() : null;
            const locale = localeResponse.ok ? await localeResponse.json() : null;
            localeMessages = locale?.messages || {};
        } catch (error) {
            console.error("Model schema could not be loaded", error);
            modelSchema = { groups: [] };
        }
        return modelSchema;
    }

    function tr(key, fallback) { return localeMessages?.[key] || fallback || key; }

    function humanFieldLabel(field) {
        const raw = String(field?.id || "");
        return raw
            .replace(/Code$/, "")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ")
            .replace(/\bloa\b/i, "LOA")
            .replace(/^./, c => c.toUpperCase());
    }

    function humanEnumValue(value) {
        const raw = String(value ?? "");
        if (!raw) return raw;
        const translated = tr(`enum.${raw}`, "");
        if (translated) return translated;
        const tail = raw.includes(".") ? raw.split(".").slice(1).join(" ") : raw;
        return tail.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    function correctableSchemaFields() {
        const groups = Array.isArray(modelSchema?.groups) ? modelSchema.groups : [];
        return groups.map(group => ({
            label: tr(group.labelKey, String(group.id || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())),
            fields: (group.fields || []).filter(field => field.correctable)
        })).filter(group => group.fields.length);
    }

    function correctionFieldOptions() {
        const groups = correctableSchemaFields();
        if (!groups.length) return selectOptions(fallbackModelFields);
        return groups.map(group =>
            `<optgroup label="${escapeHtml(group.label)}">${group.fields.map(field =>
                `<option value="${escapeHtml(field.id)}">${escapeHtml(tr(field.labelKey, humanFieldLabel(field)))}</option>`
            ).join("")}</optgroup>`
        ).join("") + `<optgroup label="Other"><option value="Other">Something else</option></optgroup>`;
    }

    function schemaField(fieldId) {
        for (const group of (modelSchema?.groups || [])) {
            const found = (group.fields || []).find(field => field.id === fieldId);
            if (found) return found;
        }
        return null;
    }

    function currentSchemaValue(model, field) {
        if (!model?.data || !field) return undefined;
        if (field.type === "measurement") {
            const direct = Number(model.data[field.id]);
            if (Number.isFinite(direct)) return globalThis.BAtlasCanonical?.formatMeasurement(direct, field.dimension, "both") || direct;
            for (const legacy of (field.legacyMeasurements || [])) {
                const raw = model.data[legacy.key];
                if (raw === undefined || raw === null || raw === "") continue;
                if (legacy.unit === "gal_unknown") return `${raw} gal (source gallon type unresolved)`;
                const canonical = globalThis.BAtlasCanonical?.toCanonical(raw, legacy.unit);
                if (canonical !== null && canonical !== undefined) return globalThis.BAtlasCanonical?.formatMeasurement(canonical, field.dimension, "both") || raw;
            }
            return undefined;
        }
        let value = model.data[field.id];
        if (field.type === "enum" && value !== undefined && value !== null && value !== "") return humanEnumValue(value);
        if ((value === undefined || value === null || value === "") && Array.isArray(field.legacyKeys)) {
            for (const alias of field.legacyKeys) {
                const candidate = model.data[alias];
                if (candidate !== undefined && candidate !== null && candidate !== "") { value = candidate; break; }
            }
        }
        if (field.type === "enum" && value !== undefined && value !== null && value !== "") return humanEnumValue(value);
        return value;
    }

    function proposedControl(field) {
        if (!field || field.id === "Other") return `<input id="correctionProposedValue" name="ProposedValue" required maxlength="300">`;
        if (field.type === "measurement") {
            const units = (field.allowedInputUnits || [field.canonicalUnit]).map(unit => {
                const labels = {m:"metres",ft:"feet",in:"inches",kg:"kilograms",lb:"pounds",L:"litres",us_gal:"US gallons",imp_gal:"Imperial gallons",kW:"kW",hp:"hp",kn:"knots",nm:"nautical miles"};
                return `<option value="${escapeHtml(unit)}">${escapeHtml(labels[unit] || unit)}</option>`;
            }).join("");
            return `<div class="contribution-measurement-input"><input id="correctionProposedValue" name="ProposedValue" type="number" step="any" inputmode="decimal" required><select id="correctionProposedUnit" name="ProposedUnit" required><option value="">Choose unit</option>${units}</select></div>`;
        }
        if (field.type === "enum") {
            const opts = (field.options || []).map(option => `<option value="${escapeHtml(option.code)}">${escapeHtml(tr(option.labelKey, option.code))}</option>`).join("");
            return `<select id="correctionProposedValue" name="ProposedValue" required><option value="">Choose a value</option>${opts}</select>`;
        }
        if (field.type === "boolean") {
            return `<select id="correctionProposedValue" name="ProposedValue" required><option value="">Choose a value</option><option value="true">Yes</option><option value="false">No</option><option value="unknown">Unknown / not established</option></select>`;
        }
        if (field.type === "integer") return `<input id="correctionProposedValue" name="ProposedValue" type="number" step="1" inputmode="numeric" required>`;
        if (field.type === "number") return `<input id="correctionProposedValue" name="ProposedValue" type="number" step="any" inputmode="decimal" required>`;
        return `<input id="correctionProposedValue" name="ProposedValue" required maxlength="300">`;
    }

    async function loadTaxonomy() {
        if (taxonomy) return taxonomy;
        try {
            const response = await fetch("data/contribution-types.json", { cache: "no-store" });
            if (!response.ok) throw new Error(`Contribution taxonomy HTTP ${response.status}`);
            taxonomy = await response.json();
        } catch (error) {
            console.error("Contribution taxonomy could not be loaded", error);
            taxonomy = { groups: [] };
        }
        return taxonomy;
    }

    async function loadModels() {
        if (modelCatalog) return modelCatalog;
        try {
            const response = await fetch("boatmodels.json", { cache: "no-store" });
            if (!response.ok) throw new Error(`Boat models HTTP ${response.status}`);
            let rows = await response.json();
            rows = Array.isArray(rows) ? rows : [];
            try {
                const live = await fetch(`${COMMUNITY_API_BASE}/api/public/overlays`, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
                const patches = live?.modelPatches || {};
                rows = rows.map(row => patches[row.BoatModelID] ? { ...row, ...patches[row.BoatModelID] } : row);
                const ids = new Set(rows.map(row => row.BoatModelID));
                for (const row of live?.addedModels || []) if (row?.BoatModelID && !ids.has(row.BoatModelID)) { rows.push(row); ids.add(row.BoatModelID); }
            } catch (_) {}
            modelCatalog = rows.map(row => ({
                id: row.BoatModelID || "",
                manufacturer: row.Manufacturer || "",
                model: row.Model || "",
                variant: row.Variant || "",
                label: [row.Manufacturer, row.Model, row.Variant].filter(Boolean).join(" "),
                data: row
            })).sort((a,b) => a.label.localeCompare(b.label));
        } catch (error) {
            console.error("Model catalog could not be loaded", error);
            modelCatalog = [];
        }
        return modelCatalog;
    }

    function hidePrimaryViews() {
        ["lifecycleHome", "discoverView", "guidedMatchView", "boatGuideView", "decisionWorkspaceModal", "informationModal"].forEach(id => {
            const element = $(id);
            if (element) element.hidden = true;
        });
        root.BScoutOwnership?.hideOwnedView();
        document.querySelectorAll(".modal").forEach(modal => { modal.style.display = "none"; });
    }

    function contextLabel(context) {
        if (context.source !== "guide") return "Share useful knowledge, correct B-Atlas, or help add boats we do not cover yet.";
        const name = context.guideName || [context.manufacturer, context.model, context.variant].filter(Boolean).join(" ") || "this model";
        return `You are contributing to the ${name} Guide. Model identity is already attached; add a year or variant only when it matters.`;
    }

    function cardNote(type, context) {
        if (type.id === "new_model") return "Tell B-Atlas about a model that is missing. Only the manufacturer and model name will be required.";
        if (type.id === "new_manufacturer") return "Suggest a manufacturer B-Atlas does not yet cover.";
        if (type.id === "manual_document") return "Provide a model manual, brochure, technical document, diagram or related document.";
        if (type.id === "resource") return "Share a useful club, association, forum, video, virtual tour or technical resource.";
        if (type.id === "other") return "Capture useful knowledge that does not fit one of the structured contribution choices.";
        if (context.source !== "guide" && type.requiresModel) return "Choose the model in the short contribution form.";
        return "This contribution will be reviewed before it changes permanent B-Atlas knowledge.";
    }

    function renderGroups(data, context) {
        const target = $("contributionTypeGroups");
        if (!target) return;
        target.innerHTML = (data.groups || []).map(group => `
            <section class="contribution-type-group" aria-labelledby="contrib-group-${escapeHtml(group.id)}">
                <div class="contribution-group-heading"><h2 id="contrib-group-${escapeHtml(group.id)}">${escapeHtml(group.label)}</h2></div>
                <div class="contribution-type-grid">
                    ${(group.types || []).map(type => `
                        <button type="button" class="contribution-type-card" data-contribution-type="${escapeHtml(type.id)}">
                            <strong>${escapeHtml(type.label)}</strong>
                            <span>${escapeHtml(cardNote(type, context))}</span>
                        </button>`).join("")}
                </div>
            </section>`).join("");
    }

    function modelIdentityFields(required) {
        if (returnContext.source === "guide") {
            const label = returnContext.guideName || [returnContext.manufacturer, returnContext.model, returnContext.variant].filter(Boolean).join(" ");
            return `<div class="contribution-fixed-context"><span>Guide</span><strong>${escapeHtml(label)}</strong></div>`;
        }
        const options = (modelCatalog || []).map(item => `<option value="${escapeHtml(item.label)}"></option>`).join("");
        return `<div class="contribution-field contribution-field-wide">
            <label for="contributionModelLookup">Model${required ? " *" : ""}</label>
            <input id="contributionModelLookup" name="ModelLookup" list="contributionModelList" autocomplete="off" ${required ? "required" : ""} placeholder="Start typing manufacturer or model">
            <datalist id="contributionModelList">${options}</datalist>
            <small>Choose an existing B-Atlas model. Missing models are added through Add a missing model.</small>
        </div>`;
    }

    function commonOptionalFields() {
        return `<div class="contribution-field-row">
            <div class="contribution-field"><label for="contributionModelYear">Model year <span>optional</span></label><input id="contributionModelYear" name="ModelYear" type="number" min="1800" max="2200" inputmode="numeric"></div>
            <div class="contribution-field"><label for="contributionVariant">Variant/layout <span>optional</span></label><input id="contributionVariant" name="Variant" maxlength="120"></div>
        </div>
        <details class="contribution-optional-details">
          <summary>Optional attribution or contact</summary>
          <div class="contribution-field-row">
            <div class="contribution-field"><label for="contributionDisplayName">Display name <span>optional</span></label><input id="contributionDisplayName" name="DisplayName" maxlength="80"><small>Leave blank to contribute without public attribution.</small></div>
            <div class="contribution-field"><label for="contributionEmail">Email for clarification <span>optional, private</span></label><input id="contributionEmail" name="ContactEmail" type="email" autocomplete="email"><small>Never displayed publicly.</small></div>
          </div>
        </details>`;
    }

    function selectOptions(items) {
        return items.map(([value,label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
    }

    function ownershipForm() {
        return `${modelIdentityFields(true)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="experienceCategory">What is this about? *</label><select id="experienceCategory" name="Category" required><option value="">Choose one</option>${selectOptions(["Handling","Comfort","Interior/liveability","Performance","Fuel use","Engine/access","Maintenance","Construction","Storage","Cruising","Docking","Weather/seakeeping","Ownership cost","Other"].map(x=>[x,x]))}</select></div>
          <div class="contribution-field"><label for="experienceLength">Your experience <span>optional</span></label><select id="experienceLength" name="ExperienceLength"><option value="">Not specified</option>${selectOptions([["less_than_1_year","Less than 1 year"],["1_3_years","1–3 years"],["3_10_years","3–10 years"],["10_plus_years","10+ years"],["previous_owner_user","Previous owner/user"]])}</select></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="experienceNarrative">What should someone considering this model know? *</label><textarea id="experienceNarrative" name="Narrative" required maxlength="1500" rows="6"></textarea><small>Useful specifics are better than a general review. Maximum 1,500 characters.</small></div>`;
    }

    function problemForm() {
        return `${modelIdentityFields(true)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="problemArea">Area *</label><select id="problemArea" name="Area" required><option value="">Choose one</option>${selectOptions(["Hull","Deck","Windows/ports","Fuel system","Electrical","Engine installation","Steering","Tanks/plumbing","Interior","Hardware","Structural","Other"].map(x=>[x,x]))}</select></div>
          <div class="contribution-field"><label for="problemSeverity">Severity *</label><select id="problemSeverity" name="Severity" required><option value="">Choose one</option>${selectOptions([["minor_nuisance","Minor nuisance"],["maintenance_issue","Maintenance issue"],["significant_repair","Significant repair"],["safety_concern","Safety concern"]])}</select></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="problemEvidence">How do you know? *</label><select id="problemEvidence" name="EvidenceType" required><option value="">Choose one</option>${selectOptions([["direct_owner_observation","I found this on my boat"],["multiple_boats","I have seen it on more than one boat"],["professional_inspection","Professional inspection or survey"],["second_hand","Reported by another owner"],["other","Other"]])}</select></div>
        <div class="contribution-field contribution-field-wide"><label for="problemTitle">Short description *</label><input id="problemTitle" name="Title" required maxlength="120" placeholder="Example: Original fuel tank corrosion"></div>
        <div class="contribution-field contribution-field-wide"><label for="problemNarrative">What happened and what did you learn? *</label><textarea id="problemNarrative" name="Narrative" required maxlength="1500" rows="6"></textarea></div>
        <div class="contribution-field contribution-field-wide"><label for="problemRepair">Repair or resolution <span>optional</span></label><textarea id="problemRepair" name="Repair" maxlength="1000" rows="4"></textarea></div>`;
    }

    function inspectionForm() {
        return `${modelIdentityFields(true)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="inspectionArea">Area to inspect *</label><select id="inspectionArea" name="Area" required><option value="">Choose one</option>${selectOptions(["Hull","Deck","Windows/ports","Fuel system","Electrical","Engine installation","Steering","Tanks/plumbing","Interior","Hardware","Structural","Other"].map(x=>[x,x]))}</select></div>
          <div class="contribution-field"><label for="inspectionImportance">Importance *</label><select id="inspectionImportance" name="Importance" required><option value="">Choose one</option>${selectOptions([["worth_checking","Worth checking"],["check_carefully","Check carefully"],["important_before_purchase","Important before purchase"]])}</select></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="inspectionAdvice">What should a buyer look for? *</label><textarea id="inspectionAdvice" name="Advice" required maxlength="1200" rows="5"></textarea></div>
        <div class="contribution-field contribution-field-wide"><label for="inspectionWhy">Why does it matter? <span>optional</span></label><textarea id="inspectionWhy" name="Why" maxlength="800" rows="3"></textarea></div>`;
    }

    function correctionMeasurementGuidance(fieldId) {
        const notes = {
            Headroom: "If possible, choose a location-specific headroom field instead. A single general headroom value can hide important low areas.",
            HeadroomSalon: "Measure from the finished cabin sole to the lowest fixed overhead where an adult normally stands in the saloon/main cabin.",
            HeadroomHelm: "Measure at the normal standing helm position, from finished sole/deck to the lowest fixed overhead. Do not measure through an open hatch.",
            HeadroomGalley: "Measure at the primary cooking/preparation standing position, from finished sole to the lowest fixed overhead.",
            HeadroomHead: "Measure inside the head compartment at the normal standing area near the toilet/sink. Note if the shower has different clearance.",
            HeadroomForwardCabin: "Measure at the normal standing/dressing area in the forward cabin, not above the berth mattress unless that is the only standing area.",
            VBerthLength: "Measure usable sleeping length on the mattress/cushion surface. If the berth is tapered, measure the longest practical sleeping axis and describe where you measured it."
        };
        return notes[fieldId] || "";
    }

    function correctionForm() {
        return `${modelIdentityFields(true)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="correctionField">What information are you adding or correcting? *</label><select id="correctionField" name="CorrectionField" required><option value="">Choose a field</option>${correctionFieldOptions()}</select></div>
          <div class="contribution-field"><label for="correctionCurrentValue">B-Atlas currently says</label><input id="correctionCurrentValue" name="CurrentValue" readonly placeholder="Select a field"></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="correctionProposedValue">What should it say? *</label><div id="correctionProposedControl">${proposedControl(null)}</div><small id="correctionMeasurementGuidance" hidden></small></div>
        <div class="contribution-field contribution-field-wide"><label for="correctionEvidence">How do you know? *</label><select id="correctionEvidence" name="EvidenceType" required><option value="">Choose one</option>${selectOptions([["direct_owner_observation","I own / owned this model"],["manufacturer_documentation","Manufacturer documentation"],["manual_brochure","Manual or brochure"],["survey","Survey"],["professional_inspection","Professional source"],["other","Other source"]])}</select></div>
        <div class="contribution-field contribution-field-wide"><label for="correctionExplanation">Explanation or source <span>optional</span></label><textarea id="correctionExplanation" name="Explanation" maxlength="1000" rows="4"></textarea></div>
        <div class="contribution-field contribution-field-wide"><label for="correctionSourceURL">Source link <span>optional</span></label><input id="correctionSourceURL" name="SourceURL" type="url" placeholder="https://"></div>`;
    }

    function otherForm() {
        return `${modelIdentityFields(false)}${commonOptionalFields()}
        <div class="contribution-field contribution-field-wide"><label for="otherNarrative">What would you like B-Atlas to know? *</label><textarea id="otherNarrative" name="Narrative" required maxlength="2000" rows="7"></textarea><small>Use this for useful knowledge that does not fit the other contribution choices.</small></div>
        <div class="contribution-field contribution-field-wide"><label for="otherSourceURL">Useful link <span>optional</span></label><input id="otherSourceURL" name="SourceURL" type="url" placeholder="https://"></div>`;
    }


    function photoForm() {
        return `${modelIdentityFields(true)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="photoCategory">What does the photo show? *</label><select id="photoCategory" name="PhotoCategory" required><option value="">Choose one</option>${selectOptions(["Exterior","Helm","Salon","Galley","Cabin/berth","Head","Engine room","Mechanical","Deck","Storage","Layout/detail","Other"].map(x=>[x,x]))}</select></div>
          <div class="contribution-field"><label for="photoState">Original or refitted? <span>optional</span></label><select id="photoState" name="PhotoState"><option value="">Not specified</option>${selectOptions([["original","Original / as built"],["refitted","Refitted / modified"],["unknown","Not sure"]])}</select></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="contributionPhoto">Photos *</label><input id="contributionPhoto" name="PhotoFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple required><small>Add up to 8 photos at once. Maximum 12 MB per image and 30 MB total.</small></div>
        <div id="contributionPhotoPreview" class="contribution-photo-preview-grid" hidden aria-live="polite"></div>
        <div class="contribution-field contribution-field-wide"><label for="photoCaption">Caption or useful detail <span>optional</span></label><textarea id="photoCaption" name="Caption" maxlength="500" rows="3" placeholder="Example: Original lower helm arrangement before refit."></textarea></div>
        <fieldset class="contribution-rights-box contribution-photo-permission">
          <legend>Permission to use these photos *</legend>
          <p class="contribution-rights-intro">Choose the statement that applies to every photo in this contribution.</p>
          <div class="contribution-rights-options">
            <label class="contribution-radio contribution-rights-choice"><input type="radio" name="RightsStatus" value="creator_or_owner" required><span><strong>I took these photos</strong><small>I allow B-Atlas to display them as part of its boat knowledge library.</small></span></label>
            <label class="contribution-radio contribution-rights-choice"><input type="radio" name="RightsStatus" value="permission_granted" required><span><strong>I have permission to share them</strong><small>The rights holder allows B-Atlas to display these photos.</small></span></label>
          </div>
          <p class="contribution-rights-warning">Do not upload broker, marketplace, manufacturer, magazine or other third-party images unless you have permission to share them.</p>
        </fieldset>`;
    }

    function manualDocumentForm() {
        return `${modelIdentityFields(false)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="documentType">Document type *</label><select id="documentType" name="DocumentType" required><option value="">Choose one</option>${selectOptions([["owners_manual","Owner's manual"],["engine_manual","Engine manual"],["service_manual","Service manual"],["parts_manual","Parts manual"],["wiring_diagram","Wiring diagram"],["brochure","Brochure"],["specifications","Specifications"],["technical_bulletin","Technical bulletin"],["survey_example","Survey / example survey"],["other","Other"]])}</select></div>
          <div class="contribution-field"><label for="documentTitle">Document title *</label><input id="documentTitle" name="DocumentTitle" required maxlength="180" placeholder="Example: 1984 owner's manual"></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="documentManufacturer">Manufacturer <span>optional if model selected</span></label><input id="documentManufacturer" name="DocumentManufacturer" maxlength="120" placeholder="Use for manufacturer-wide material"></div>
        <fieldset class="contribution-rights-box">
          <legend>How are you providing it? *</legend>
          <label class="contribution-radio"><input type="radio" name="DocumentDelivery" value="link" required><span><strong>Link to the document</strong><small>B-Atlas stores the link and document details for review.</small></span></label>
          <label class="contribution-radio"><input type="radio" name="DocumentDelivery" value="upload" required><span><strong>Upload a PDF</strong><small>The file stays in this browser until the shared moderation queue is built.</small></span></label>
        </fieldset>
        <div id="documentLinkFields" hidden>
          <div class="contribution-field contribution-field-wide"><label for="documentSourceURL">Document link *</label><input id="documentSourceURL" name="SourceURL" type="url" placeholder="https://"></div>
          <div class="contribution-field contribution-field-wide"><label for="documentSourceName">Source <span>optional</span></label><input id="documentSourceName" name="DocumentSourceName" maxlength="160" placeholder="Manufacturer, club, archive, owner site..."></div>
        </div>
        <div id="documentUploadFields" hidden>
          <div class="contribution-field contribution-field-wide"><label for="contributionDocument">PDF file *</label><input id="contributionDocument" name="DocumentFile" type="file" accept="application/pdf,.pdf"><small>One PDF per contribution; maximum 25 MB.</small></div>
          <div id="contributionDocumentName" class="contribution-file-note" hidden></div>
          <fieldset class="contribution-rights-box">
            <legend>Document permission *</legend>
            <label class="contribution-radio"><input type="radio" name="RightsStatus" value="creator_or_owner"><span><strong>I created or own this document</strong><small>I allow B-Atlas to review it for possible publication.</small></span></label>
            <label class="contribution-radio"><input type="radio" name="RightsStatus" value="public_distribution"><span><strong>It was intended for public distribution</strong><small>For example, a manufacturer brochure or manual distributed to owners.</small></span></label>
            <label class="contribution-radio"><input type="radio" name="RightsStatus" value="permission_granted"><span><strong>I have permission to share it</strong><small>The rights holder allows B-Atlas to review and display it.</small></span></label>
            <label class="contribution-radio"><input type="radio" name="RightsStatus" value="uncertain"><span><strong>I'm not sure</strong><small>B-Atlas may use the submission as evidence but should not republish the file unless rights are resolved.</small></span></label>
            <p>Possessing a PDF does not necessarily include permission to republish it. If rights are uncertain, B-Atlas can still review the document and may publish only its title, description or original source link.</p>
          </fieldset>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="documentNotes">What is useful about this document? <span>optional</span></label><textarea id="documentNotes" name="DocumentNotes" maxlength="1000" rows="4"></textarea></div>`;
    }

    function attributionContactFields() {
        return `<details class="contribution-optional-details">
          <summary>Optional attribution or contact</summary>
          <div class="contribution-field-row">
            <div class="contribution-field"><label for="contributionDisplayName">Display name <span>optional</span></label><input id="contributionDisplayName" name="DisplayName" maxlength="80"><small>Leave blank to contribute without public attribution.</small></div>
            <div class="contribution-field"><label for="contributionEmail">Email for clarification <span>optional, private</span></label><input id="contributionEmail" name="ContactEmail" type="email" autocomplete="email"><small>Never displayed publicly.</small></div>
          </div>
        </details>`;
    }

    function resourceForm() {
        return `${modelIdentityFields(true)}${commonOptionalFields()}
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="resourceType">Resource type *</label><select id="resourceType" name="ResourceType" required><option value="">Choose one</option>${selectOptions([["club","Club"],["association","Association"],["forum","Forum / community"],["video","Video"],["virtual_tour","Virtual tour"],["technical_website","Technical website"],["other","Other"]])}</select></div>
          <div class="contribution-field"><label for="resourceTitle">Resource name *</label><input id="resourceTitle" name="ResourceTitle" required maxlength="180"></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="resourceURL">Resource link *</label><input id="resourceURL" name="SourceURL" type="url" required placeholder="https://"></div>
        <div class="contribution-field contribution-field-wide"><label for="resourceNotes">Why is it useful? <span>optional</span></label><textarea id="resourceNotes" name="ResourceNotes" maxlength="1000" rows="4" placeholder="Example: Active owner group with model-specific maintenance files and archived discussions."></textarea></div>`;
    }

    function newModelForm() {
        const manufacturers = [...new Set((modelCatalog || []).map(item => item.manufacturer).filter(Boolean))].sort((a,b) => a.localeCompare(b));
        const manufacturerOptions = manufacturers.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
        return `<div class="contribution-field-row">
          <div class="contribution-field"><label for="newModelManufacturer">Manufacturer *</label><input id="newModelManufacturer" name="ProposedManufacturer" list="newModelManufacturerList" required maxlength="120" autocomplete="off" placeholder="Existing or missing manufacturer"><datalist id="newModelManufacturerList">${manufacturerOptions}</datalist><small>If the manufacturer already exists, simply choose/type its name.</small></div>
          <div class="contribution-field"><label for="newModelName">Model *</label><input id="newModelName" name="ProposedModel" required maxlength="140" placeholder="Example: 32 Classic"></div>
        </div>
        <div id="newModelDuplicateWarning" class="contribution-inline-warning" hidden></div>
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="newModelVariant">Variant/layout <span>optional</span></label><input id="newModelVariant" name="ProposedVariant" maxlength="120"></div>
          <div class="contribution-field"><label for="newModelFamily">Boat family <span>optional</span></label><input id="newModelFamily" name="ProposedBoatFamily" maxlength="120" placeholder="Trawler, tug, cruiser..."></div>
        </div>
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="newModelYearStart">First production year <span>optional</span></label><input id="newModelYearStart" name="ProposedYearStart" type="number" min="1800" max="2200" inputmode="numeric"></div>
          <div class="contribution-field"><label for="newModelYearEnd">Last production year <span>optional</span></label><input id="newModelYearEnd" name="ProposedYearEnd" type="number" min="1800" max="2200" inputmode="numeric"></div>
        </div>
        <details class="contribution-optional-details">
          <summary>Optional specifications</summary>
          <div class="contribution-field-row">
            <div class="contribution-field"><label for="newModelLength">Length (ft)</label><input id="newModelLength" name="ProposedLengthFt" type="number" step="0.1" min="1" max="300" inputmode="decimal"></div>
            <div class="contribution-field"><label for="newModelBeam">Beam (ft)</label><input id="newModelBeam" name="ProposedBeamFt" type="number" step="0.1" min="1" max="100" inputmode="decimal"></div>
          </div>
          <div class="contribution-field-row">
            <div class="contribution-field"><label for="newModelFuel">Fuel</label><input id="newModelFuel" name="ProposedFuel" maxlength="80" placeholder="Diesel, gas, electric..."></div>
            <div class="contribution-field"><label for="newModelPropulsion">Propulsion</label><input id="newModelPropulsion" name="ProposedPropulsion" maxlength="120" placeholder="Shaft, sterndrive, outboard..."></div>
          </div>
          <div class="contribution-field"><label for="newModelHull">Hull type / behaviour</label><input id="newModelHull" name="ProposedHullType" maxlength="120" placeholder="Full displacement, semi-displacement..."></div>
        </details>
        <div class="contribution-field contribution-field-wide"><label for="newModelSourceURL">Source <span>optional</span></label><input id="newModelSourceURL" name="SourceURL" type="url" placeholder="https://"><small>A manufacturer page, brochure, listing, archive, club page or other useful reference.</small></div>
        <details class="contribution-optional-details">
          <summary>Optional model photo</summary>
          <div class="contribution-field contribution-field-wide"><label for="newModelPhoto">Photo</label><input id="newModelPhoto" name="PhotoFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"><small>Use only a photo you took or have permission to share; maximum 12 MB.</small></div>
          <div id="newModelPhotoPreview" class="contribution-photo-preview" hidden><img id="newModelPhotoPreviewImage" alt="Selected model preview"><span id="newModelPhotoPreviewName"></span></div>
          <fieldset id="newModelPhotoRights" class="contribution-rights-box" hidden>
            <legend>Photo permission *</legend>
            <label class="contribution-radio"><input type="radio" name="RightsStatus" value="creator_or_owner"><span><strong>I took this photo</strong><small>I allow B-Atlas to review it for the proposed model.</small></span></label>
            <label class="contribution-radio"><input type="radio" name="RightsStatus" value="permission_granted"><span><strong>I have permission to share this photo</strong><small>The rights holder allows B-Atlas to review and display it.</small></span></label>
          </fieldset>
        </details>
        <div class="contribution-field contribution-field-wide"><label for="newModelNotes">What should B-Atlas know? <span>optional</span></label><textarea id="newModelNotes" name="NewModelNotes" maxlength="1500" rows="5" placeholder="Add only what you know. Missing details can be completed later."></textarea></div>
        ${attributionContactFields()}`;
    }

    function newManufacturerForm() {
        const manufacturers = [...new Set((modelCatalog || []).map(item => item.manufacturer).filter(Boolean))].sort((a,b) => a.localeCompare(b));
        const manufacturerOptions = manufacturers.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
        return `<div class="contribution-field contribution-field-wide"><label for="newManufacturerName">Manufacturer name *</label><input id="newManufacturerName" name="ProposedManufacturer" list="newManufacturerList" required maxlength="120" autocomplete="off"><datalist id="newManufacturerList">${manufacturerOptions}</datalist></div>
        <div id="newManufacturerDuplicateWarning" class="contribution-inline-warning" hidden></div>
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="newManufacturerCountry">Country <span>optional</span></label><input id="newManufacturerCountry" name="ProposedCountry" maxlength="120"></div>
          <div class="contribution-field"><label for="newManufacturerWebsite">Website <span>optional</span></label><input id="newManufacturerWebsite" name="SourceURL" type="url" placeholder="https://"></div>
        </div>
        <div class="contribution-field-row">
          <div class="contribution-field"><label for="newManufacturerYearStart">Established / first known year <span>optional</span></label><input id="newManufacturerYearStart" name="ProposedYearStart" type="number" min="1800" max="2200" inputmode="numeric"></div>
          <div class="contribution-field"><label for="newManufacturerYearEnd">Last active year <span>optional</span></label><input id="newManufacturerYearEnd" name="ProposedYearEnd" type="number" min="1800" max="2200" inputmode="numeric"><small>Leave blank if still active or unknown.</small></div>
        </div>
        <div class="contribution-field contribution-field-wide"><label for="newManufacturerNotes">What should B-Atlas know? <span>optional</span></label><textarea id="newManufacturerNotes" name="NewManufacturerNotes" maxlength="1500" rows="5" placeholder="History, alternate names, relationship to another builder, useful source information..."></textarea></div>
        ${attributionContactFields()}`;
    }

    function submitArea() {
        return `<div class="contribution-submit-area">
          <p><strong>No account required.</strong> B-Atlas collects only the contribution itself plus any optional display name or clarification email you choose to provide. Do not include home addresses, phone numbers, exact boat locations or other unnecessary personal information.</p>
          <p><strong>Shared moderation:</strong> submissions and permitted attachments are sent to the B-Atlas moderation queue for review before publication.</p>
          <button type="submit" class="contribution-submit-button">Save contribution for review</button>
        </div>`;
    }

    function renderForm(type) {
        const panel = $("contributionFormPanel");
        const form = $("contributionForm");
        const groups = $("contributionTypeGroups");
        const selection = $("contributionSelectionState");
        const message = $("contributionFormMessage");
        if (!panel || !form) return;
        if (message) message.hidden = true;
        if (selection) selection.hidden = true;
        if (!implementedTypes.has(type.id)) {
            panel.hidden = false;
            groups.hidden = true;
            $("contributionFormTitle").textContent = type.label;
            $("contributionFormIntro").textContent = laterPhase[type.id] || "This contribution form is scheduled for a later phase.";
            form.innerHTML = `<div class="contribution-phase-note"><strong>Entry point ready.</strong><p>${escapeHtml(laterPhase[type.id] || "Detailed form is not part of Phase 3.")}</p></div>`;
            panel.scrollIntoView({ behavior:"smooth", block:"start" });
            return;
        }
        const renderers = {ownership_experience:ownershipForm, problem_weakness:problemForm, buyer_inspection_advice:inspectionForm, correction:correctionForm, other:otherForm, photo:photoForm, manual_document:manualDocumentForm, resource:resourceForm, new_model:newModelForm, new_manufacturer:newManufacturerForm};
        groups.hidden = true;
        panel.hidden = false;
        $("contributionFormTitle").textContent = type.label;
        const impactText = scoreImpact && Number.isFinite(scoreImpact.from) && Number.isFinite(scoreImpact.to) && scoreImpact.to > scoreImpact.from
            ? ` If verified, this contribution could raise this model's Knowledge Score from ${scoreImpact.from}% to ${scoreImpact.to}%.`
            : "";
        $("contributionFormIntro").textContent = "Share only what you know. Year, variant and attribution stay optional unless they are useful to the contribution." + impactText;
        form.innerHTML = renderers[type.id]() + submitArea();
        formOpenedAt = Date.now();
        bindDynamicFields();
        if (type.id === "photo") bindPhotoFields();
        if (type.id === "manual_document") bindDocumentFields();
        if (type.id === "new_model" || type.id === "new_manufacturer") bindCoverageFields(type.id);
        if (type.id === "new_model") bindNewModelPhotoFields();
        panel.scrollIntoView({ behavior:"smooth", block:"start" });
    }

    function selectedModelFromForm() {
        if (returnContext.source === "guide") {
            return (modelCatalog || []).find(item => item.id === returnContext.modelId) || {
                id:returnContext.modelId || "", manufacturer:returnContext.manufacturer || "", model:returnContext.model || "", variant:returnContext.variant || "", data:null
            };
        }
        const value = $("contributionModelLookup")?.value.trim() || "";
        return (modelCatalog || []).find(item => item.label.toLowerCase() === value.toLowerCase()) || null;
    }

    function updateCorrectionCurrentValue() {
        const fieldId = $("correctionField")?.value;
        const current = $("correctionCurrentValue");
        const control = $("correctionProposedControl");
        if (!current) return;
        if (!fieldId) {
            current.value = "";
            if (control) control.innerHTML = proposedControl(null);
            return;
        }
        if (fieldId === "Other") {
            current.value = "See Guide / describe below";
            if (control) control.innerHTML = proposedControl({ id:"Other", type:"text" });
            return;
        }
        const field = schemaField(fieldId);
        const model = selectedModelFromForm();
        const value = currentSchemaValue(model, field || { id:fieldId });
        current.value = value === null || value === undefined || value === "" ? "Unknown / not populated" : (Array.isArray(value) ? value.join(", ") : String(value));
        if (control) control.innerHTML = proposedControl(field || { id:fieldId, type:"text" });
        const guidance = $("correctionMeasurementGuidance");
        if (guidance) {
            const text = correctionMeasurementGuidance(fieldId);
            guidance.textContent = text;
            guidance.hidden = !text;
        }
    }

    function bindDynamicFields() {
        $("correctionField")?.addEventListener("change", updateCorrectionCurrentValue);
        $("contributionModelLookup")?.addEventListener("change", updateCorrectionCurrentValue);
    }

    function normalizeIdentity(value) {
        return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }

    function findExistingManufacturer(name) {
        const needle = normalizeIdentity(name);
        if (!needle) return null;
        return (modelCatalog || []).find(item => normalizeIdentity(item.manufacturer) === needle) || null;
    }

    function findExistingModel(manufacturer, model, variant) {
        const makeNeedle = normalizeIdentity(manufacturer);
        const modelNeedle = normalizeIdentity(model);
        const variantNeedle = normalizeIdentity(variant);
        if (!makeNeedle || !modelNeedle) return null;
        return (modelCatalog || []).find(item => {
            if (normalizeIdentity(item.manufacturer) !== makeNeedle || normalizeIdentity(item.model) !== modelNeedle) return false;
            if (!variantNeedle) return true;
            return normalizeIdentity(item.variant) === variantNeedle;
        }) || null;
    }

    function updateCoverageDuplicateState(typeId) {
        if (typeId === "new_manufacturer") {
            const input = $("newManufacturerName");
            const warning = $("newManufacturerDuplicateWarning");
            const existing = findExistingManufacturer(input?.value);
            if (!input || !warning) return;
            input.setCustomValidity(existing ? "This manufacturer already exists in B-Atlas." : "");
            warning.hidden = !existing;
            warning.innerHTML = existing ? `<strong>Already in B-Atlas.</strong> ${escapeHtml(existing.manufacturer)} already has canonical model records. Use a correction or add a missing model instead.` : "";
            return;
        }
        const make = $("newModelManufacturer");
        const model = $("newModelName");
        const variant = $("newModelVariant");
        const warning = $("newModelDuplicateWarning");
        if (!make || !model || !warning) return;
        const existing = findExistingModel(make.value, model.value, variant?.value || "");
        model.setCustomValidity(existing ? "This model already exists in B-Atlas." : "");
        warning.hidden = !existing;
        warning.innerHTML = existing ? `<strong>Already in B-Atlas.</strong> ${escapeHtml(existing.label)} has a canonical Guide. Contribute to that Guide or suggest a correction instead.` : "";
    }

    function bindNewModelPhotoFields() {
        const input = $("newModelPhoto");
        const rightsBox = $("newModelPhotoRights");
        const rights = Array.from(document.querySelectorAll('#newModelPhotoRights input[name="RightsStatus"]'));
        const preview = $("newModelPhotoPreview");
        const image = $("newModelPhotoPreviewImage");
        const name = $("newModelPhotoPreviewName");
        if (!input || !rightsBox) return;
        input.addEventListener("change", () => {
            const file = input.files?.[0];
            input.setCustomValidity("");
            rightsBox.hidden = !file;
            rights.forEach(radio => { radio.required = !!file; if (!file) radio.checked = false; });
            if (!file) {
                if (preview) preview.hidden = true;
                if (image) image.removeAttribute("src");
                if (name) name.textContent = "";
                return;
            }
            const lowerName = String(file.name || "").toLowerCase();
            if ((!ALLOWED_PHOTO_TYPES.has(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/.test(lowerName)) || file.size > MAX_PHOTO_BYTES) {
                input.setCustomValidity(file.size > MAX_PHOTO_BYTES ? "Photo must be 12 MB or smaller." : "Use a JPEG, PNG, WebP, HEIC or HEIF photo.");
                input.reportValidity();
                if (preview) preview.hidden = true;
                return;
            }
            if (name) name.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
            if (preview) preview.hidden = false;
            if (image && ["image/jpeg","image/png","image/webp"].includes(file.type)) {
                const reader = new FileReader();
                reader.onload = () => { image.src = reader.result; };
                reader.readAsDataURL(file);
            } else if (image) image.removeAttribute("src");
        });
    }

    function bindCoverageFields(typeId) {
        if (typeId === "new_manufacturer") {
            $("newManufacturerName")?.addEventListener("input", () => updateCoverageDuplicateState(typeId));
            return;
        }
        ["newModelManufacturer","newModelName","newModelVariant"].forEach(id => $(id)?.addEventListener("input", () => updateCoverageDuplicateState(typeId)));
    }

    function createId() {
        if (root.crypto?.randomUUID) return `CONTRIB-${root.crypto.randomUUID()}`;
        return `CONTRIB-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    }

    function readRateEvents() {
        try {
            const rows = JSON.parse(root.localStorage?.getItem(RATE_LIMIT_KEY) || "[]");
            return Array.isArray(rows) ? rows.filter(value => Number.isFinite(Number(value))) : [];
        } catch (_) { return []; }
    }

    function rateLimitStatus(now = Date.now()) {
        const recent = readRateEvents().map(Number).filter(ts => now - ts < RATE_DAY_MS);
        const shortCount = recent.filter(ts => now - ts < RATE_WINDOW_MS).length;
        return { blocked: shortCount >= RATE_WINDOW_MAX || recent.length >= RATE_DAY_MAX, shortCount, dayCount: recent.length, events: recent };
    }

    function recordRateEvent(now = Date.now()) {
        const state = rateLimitStatus(now);
        const events = [...state.events, now].slice(-RATE_DAY_MAX);
        try { root.localStorage?.setItem(RATE_LIMIT_KEY, JSON.stringify(events)); } catch (_) {}
    }

    async function verifyAntiAbuse(form) {
        if (String(new FormData(form).get("Website") || "").trim()) throw new Error("This submission could not be accepted.");
        if (formOpenedAt && Date.now() - formOpenedAt < MIN_FORM_DWELL_MS) throw new Error("Please review the contribution before submitting it.");
        const rate = rateLimitStatus();
        if (rate.blocked) throw new Error("Too many contributions were prepared in this browser recently. Try again later.");
        const verifier = root.BScoutContributionChallenge?.verify;
        if (typeof verifier === "function") {
            const result = await verifier({ contributionType: selectedType?.id || null });
            if (result === false) throw new Error("The anti-spam check was not completed.");
        }
        return true;
    }

    function extensionForMime(mime) {
        if (mime === "image/png") return ".png";
        if (mime === "image/webp") return ".webp";
        return ".jpg";
    }

    async function sanitizePhoto(file) {
        if (!file) throw new Error("Choose a photo to contribute.");
        let bitmap;
        try { bitmap = await createImageBitmap(file); }
        catch (_) { throw new Error("This photo format could not be privacy-cleaned in this browser. Export it as JPEG, PNG or WebP and try again."); }
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) { bitmap.close?.(); throw new Error("This browser could not prepare the photo safely."); }
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        const sourceMime = ALLOWED_PHOTO_TYPES.has(file.type) ? file.type : "image/jpeg";
        const outputMime = ["image/jpeg","image/png","image/webp"].includes(sourceMime) ? sourceMime : "image/jpeg";
        const blob = await new Promise(resolve => canvas.toBlob(resolve, outputMime, outputMime === "image/jpeg" ? 0.92 : undefined));
        if (!blob) throw new Error("This browser could not privacy-clean the photo.");
        const base = String(file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
        return { blob, fileName: `${base}${extensionForMime(outputMime)}`, mimeType: outputMime, sizeBytes: blob.size };
    }

    function readPending() {
        try {
            const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (_) { return []; }
    }

    function savePending(record) {
        const rows = readPending();
        rows.push(record);
        try {
            if (!root.localStorage) throw new Error("Browser storage unavailable");
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
        } catch (error) {
            console.error("Pending contribution could not be stored", error);
            return 0;
        }
        return rows.length;
    }

    function openAttachmentDb() {
        return new Promise((resolve, reject) => {
            if (!root.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
            const request = root.indexedDB.open(ATTACHMENT_DB, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) db.createObjectStore(ATTACHMENT_STORE, { keyPath: "AttachmentID" });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Could not open attachment storage"));
        });
    }

    async function storePhotoAttachment(file, contributionId, index = 0) {
        if (!file) throw new Error("Choose a photo to contribute.");
        const name = String(file.name || "photo").toLowerCase();
        const extensionAllowed = /\.(jpe?g|png|webp|heic|heif)$/.test(name);
        if (!ALLOWED_PHOTO_TYPES.has(file.type) && !extensionAllowed) throw new Error("Use a JPEG, PNG, WebP, HEIC or HEIF photo.");
        if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be 12 MB or smaller.");
        const cleaned = await sanitizePhoto(file);
        if (cleaned.sizeBytes > MAX_PHOTO_BYTES) throw new Error("The privacy-cleaned photo is larger than 12 MB. Resize it and try again.");
        const attachmentId = `ATT-${contributionId.replace(/^CONTRIB-/, "")}-${String(index + 1).padStart(2, "0")}`;
        const db = await openAttachmentDb();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(ATTACHMENT_STORE, "readwrite");
                tx.objectStore(ATTACHMENT_STORE).put({
                    AttachmentID: attachmentId, ContributionID: contributionId,
                    FileName: cleaned.fileName, MimeType: cleaned.mimeType, SizeBytes: cleaned.sizeBytes,
                    LastModified: null, MetadataScrubbed: true, Blob: cleaned.blob
                });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error("Could not store photo"));
                tx.onabort = () => reject(tx.error || new Error("Photo storage was interrupted"));
            });
        } finally { db.close(); }
        return attachmentId;
    }

    async function storeDocumentAttachment(file, contributionId) {
        if (!file) throw new Error("Choose a PDF to contribute.");
        const name = String(file.name || "document").toLowerCase();
        const extensionAllowed = /\.pdf$/.test(name);
        if (!ALLOWED_DOCUMENT_TYPES.has(file.type) && !extensionAllowed) throw new Error("Use a PDF document.");
        if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Document must be 25 MB or smaller.");
        const attachmentId = `ATT-DOC-${contributionId.replace(/^CONTRIB-/, "")}`;
        const db = await openAttachmentDb();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(ATTACHMENT_STORE, "readwrite");
                tx.objectStore(ATTACHMENT_STORE).put({
                    AttachmentID: attachmentId,
                    ContributionID: contributionId,
                    FileName: file.name || "document.pdf",
                    MimeType: file.type || "application/pdf",
                    SizeBytes: file.size,
                    LastModified: null,
                    MalwareScanStatus: "not_available_static_prototype",
                    Blob: file
                });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error("Could not store document"));
                tx.onabort = () => reject(tx.error || new Error("Document storage was interrupted"));
            });
        } finally { db.close(); }
        return attachmentId;
    }


    async function readStoredAttachment(attachmentId) {
        if (!attachmentId) return null;
        const db = await openAttachmentDb();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(ATTACHMENT_STORE, "readonly");
                const req = tx.objectStore(ATTACHMENT_STORE).get(attachmentId);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error || new Error("Could not read attachment"));
            });
        } finally { db.close(); }
    }

    async function attachmentForSharedUpload(attachmentId) {
        const row = await readStoredAttachment(attachmentId);
        if (!row?.Blob) return null;
        const buffer = await row.Blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunk = 0x8000;
        for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,i+chunk));
        return {attachmentRef:attachmentId,filename:row.FileName||"attachment",mime:row.MimeType||"application/octet-stream",dataBase64:btoa(binary)};
    }

    async function sendSharedContribution(record) {
        if (!root.BScoutCommunityAPI) return null;
        const status = await root.BScoutCommunityAPI.status();
        if (!status?.shared) return null;
        const attachments=[];
        for (const ref of record.AttachmentRefs||[]) { const a=await attachmentForSharedUpload(ref); if(a) attachments.push(a); }
        return root.BScoutCommunityAPI.submit(record, attachments);
    }

    function bindDocumentFields() {
        const deliveryRadios = Array.from(document.querySelectorAll('input[name="DocumentDelivery"]'));
        const linkFields = $("documentLinkFields");
        const uploadFields = $("documentUploadFields");
        const linkInput = $("documentSourceURL");
        const fileInput = $("contributionDocument");
        const rights = Array.from(document.querySelectorAll('input[name="RightsStatus"]'));
        const fileNote = $("contributionDocumentName");
        const update = () => {
            const delivery = deliveryRadios.find(r => r.checked)?.value || "";
            if (linkFields) linkFields.hidden = delivery !== "link";
            if (uploadFields) uploadFields.hidden = delivery !== "upload";
            if (linkInput) linkInput.required = delivery === "link";
            if (fileInput) fileInput.required = delivery === "upload";
            rights.forEach(r => { r.required = delivery === "upload"; if (delivery !== "upload") r.checked = false; });
        };
        deliveryRadios.forEach(radio => radio.addEventListener("change", update));
        fileInput?.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            fileInput.setCustomValidity("");
            if (!file) { if (fileNote) fileNote.hidden = true; return; }
            const validType = ALLOWED_DOCUMENT_TYPES.has(file.type) || /\.pdf$/i.test(file.name || "");
            if (!validType || file.size > MAX_DOCUMENT_BYTES) {
                fileInput.setCustomValidity(file.size > MAX_DOCUMENT_BYTES ? "Document must be 25 MB or smaller." : "Use a PDF document.");
                fileInput.reportValidity();
                if (fileNote) fileNote.hidden = true;
                return;
            }
            if (fileNote) {
                fileNote.hidden = false;
                fileNote.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
            }
        });
        update();
    }

    function bindPhotoFields() {
        const input = $("contributionPhoto");
        const preview = $("contributionPhotoPreview");
        if (!input || !preview) return;
        input.addEventListener("change", () => {
            const files = [...(input.files || [])];
            input.setCustomValidity("");
            preview.innerHTML = "";
            preview.hidden = true;
            if (!files.length) return;
            if (files.length > MAX_PHOTO_FILES) {
                input.setCustomValidity(`Choose no more than ${MAX_PHOTO_FILES} photos at a time.`);
                input.reportValidity();
                return;
            }
            const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
            if (totalBytes > MAX_PHOTO_TOTAL_BYTES) {
                input.setCustomValidity("The selected photos must total 30 MB or less.");
                input.reportValidity();
                return;
            }
            for (const file of files) {
                const lowerName = String(file.name || "").toLowerCase();
                if ((!ALLOWED_PHOTO_TYPES.has(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/.test(lowerName)) || file.size > MAX_PHOTO_BYTES) {
                    input.setCustomValidity(file.size > MAX_PHOTO_BYTES ? `${file.name} is larger than 12 MB.` : `${file.name} is not a supported photo format.`);
                    input.reportValidity();
                    preview.innerHTML = "";
                    return;
                }
            }
            preview.hidden = false;
            files.forEach(file => {
                const card = document.createElement("div");
                card.className = "contribution-photo-preview-card";
                const img = document.createElement("img");
                img.alt = "Selected contribution preview";
                const caption = document.createElement("span");
                caption.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                card.append(img, caption);
                preview.appendChild(card);
                if (["image/jpeg","image/png","image/webp"].includes(file.type)) {
                    const reader = new FileReader();
                    reader.onload = () => { img.src = reader.result; };
                    reader.readAsDataURL(file);
                } else {
                    img.hidden = true;
                }
            });
        });
    }

    function buildRecord(form) {
        const fd = new FormData(form);
        const model = selectedModelFromForm();
        const year = fd.get("ModelYear");
        const evidence = fd.get("EvidenceType") || null;
        const payload = {};
        ["Category","ExperienceLength","Area","Severity","Title","Narrative","Repair","Importance","Advice","Why","CorrectionField","CurrentValue","ProposedValue","ProposedUnit","Explanation","PhotoCategory","PhotoState","Caption","DocumentType","DocumentTitle","DocumentManufacturer","DocumentDelivery","DocumentSourceName","DocumentNotes","ResourceType","ResourceTitle","ResourceNotes","ProposedManufacturer","ProposedModel","ProposedVariant","ProposedBoatFamily","ProposedYearStart","ProposedYearEnd","ProposedLengthFt","ProposedBeamFt","ProposedFuel","ProposedPropulsion","ProposedHullType","NewModelNotes","ProposedCountry","NewManufacturerNotes"].forEach(key => {
            const value = fd.get(key);
            if (value !== null && String(value).trim() !== "") payload[key] = String(value).trim();
        });
        return {
            ContributionID: createId(),
            ContributionType: selectedType.id,
            ManufacturerID: model?.data?.ManufacturerID || null,
            ManufacturerName: selectedType.id === "new_model" || selectedType.id === "new_manufacturer" ? (String(fd.get("ProposedManufacturer") || "").trim() || null) : (model?.manufacturer || String(fd.get("DocumentManufacturer") || "").trim() || null),
            ModelID: model?.id || null,
            ModelName: selectedType.id === "new_model" ? (String(fd.get("ProposedModel") || "").trim() || null) : (model?.model || null),
            ModelYear: year ? Number(year) : null,
            Variant: selectedType.id === "new_model" ? (String(fd.get("ProposedVariant") || "").trim() || null) : (String(fd.get("Variant") || model?.variant || "").trim() || null),
            DisplayName: String(fd.get("DisplayName") || "").trim() || null,
            ContactEmail: String(fd.get("ContactEmail") || "").trim() || null,
            DateSubmitted: new Date().toISOString(),
            ModerationStatus: "pending",
            EvidenceType: evidence,
            RightsStatus: selectedType.id === "manual_document" && String(fd.get("DocumentDelivery") || "") === "link" ? "external_link_only" : (String(fd.get("RightsStatus") || "").trim() || null),
            Payload: payload,
            SourceURL: String(fd.get("SourceURL") || "").trim() || null,
            AttachmentRefs: [],
            ModeratorNotes: null,
            MergedKnowledgeItemID: null
        };
    }

    function validateModel(form) {
        const lookup = $("contributionModelLookup");
        if (!lookup) return true;
        const typed = lookup.value.trim();
        if (!typed && !lookup.required) { lookup.setCustomValidity(""); return true; }
        const model = selectedModelFromForm();
        if (model) { lookup.setCustomValidity(""); return true; }
        lookup.setCustomValidity("Choose an existing B-Atlas model from the list, or use Add a missing model.");
        lookup.reportValidity();
        return false;
    }

    async function onSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        if (selectedType.id === "new_model" || selectedType.id === "new_manufacturer") updateCoverageDuplicateState(selectedType.id);
        if (!validateModel(form) || !form.checkValidity()) { form.reportValidity(); return; }
        const message = $("contributionFormMessage");
        try { await verifyAntiAbuse(form); } catch (error) {
            if (message) { message.hidden = false; message.innerHTML = `<strong>Contribution not saved.</strong><span>${escapeHtml(error?.message || "The anti-spam check could not be completed.")}</span>`; }
            return;
        }
        const record = buildRecord(form);
        if (selectedType.id === "photo") {
            try {
                const files = [...($("contributionPhoto")?.files || [])];
                if (!files.length) throw new Error("Choose at least one photo to contribute.");
                const refs = [];
                for (let i = 0; i < files.length; i += 1) refs.push(await storePhotoAttachment(files[i], record.ContributionID, i));
                record.AttachmentRefs = refs;
                record.Payload.PhotoCount = String(refs.length);
            } catch (error) {
                if (message) {
                    message.hidden = false;
                    message.innerHTML = `<strong>Could not prepare these photos.</strong><span>${escapeHtml(error?.message || "The selected photos could not be stored in this browser.")}</span>`;
                }
                return;
            }
        }
        if (selectedType.id === "new_model" && $("newModelPhoto")?.files?.[0]) {
            try {
                const attachmentId = await storePhotoAttachment($("newModelPhoto").files[0], record.ContributionID);
                record.AttachmentRefs = [attachmentId];
            } catch (error) {
                if (message) {
                    message.hidden = false;
                    message.innerHTML = `<strong>Could not prepare this model photo.</strong><span>${escapeHtml(error?.message || "The selected photo could not be stored in this browser.")}</span>`;
                }
                return;
            }
        }
        if (selectedType.id === "manual_document" && record.Payload.DocumentDelivery === "upload") {
            try {
                const attachmentId = await storeDocumentAttachment($("contributionDocument")?.files?.[0], record.ContributionID);
                record.AttachmentRefs = [attachmentId];
                record.SourceURL = null;
            } catch (error) {
                if (message) {
                    message.hidden = false;
                    message.innerHTML = `<strong>Could not prepare this document.</strong><span>${escapeHtml(error?.message || "The selected document could not be stored in this browser.")}</span>`;
                }
                return;
            }
        }
        let sharedResult=null;
        try { sharedResult=await sendSharedContribution(record); } catch (error) { console.warn("Shared submission failed; retaining local fallback", error); }
        const count = savePending(record);
        if (!count && !sharedResult) {
            if (message) {
                message.hidden = false;
                message.innerHTML = `<strong>Could not save this contribution.</strong><span>Neither shared submission nor browser fallback storage was available.</span>`;
            }
            return;
        }
        recordRateEvent();
        root.sessionStorage?.removeItem("bscoutContributionDraft");
        form.reset();
        if (message) {
            message.hidden = false;
            const reviewLink = root.BScoutModeratorAccess?.enabled?.() ? `<a class="contribution-review-link" href="developer/contribution-review.html?contribution=${encodeURIComponent(record.ContributionID)}">Open Moderator Review →</a>` : "";
            const impactResult = scoreImpact && Number.isFinite(scoreImpact.from) && Number.isFinite(scoreImpact.to) && scoreImpact.to > scoreImpact.from
              ? `<span>If verified and accepted into the canonical Guide, this could move the model's Knowledge Score from <strong>${scoreImpact.from}%</strong> to <strong>${scoreImpact.to}%</strong>.</span>` : "";
            message.innerHTML = sharedResult
              ? `<strong>Contribution submitted.</strong><span>It has been added to B-Atlas's shared moderation queue as contribution ${escapeHtml(record.ContributionID)}.</span>${impactResult}${reviewLink}`
              : `<strong>Contribution saved locally.</strong><span>The shared B-Atlas service is not available, so this contribution remains only in this browser's fallback queue. Pending local records: ${count}.</span>${impactResult}${reviewLink}`;
            message.scrollIntoView({ behavior:"smooth", block:"nearest" });
        }
    }

    function selectType(typeId) {
        selectedType = (taxonomy?.groups || []).flatMap(group => group.types || []).find(item => item.id === typeId) || null;
        if (!selectedType) return;
        document.querySelectorAll(".contribution-type-card").forEach(card => card.classList.toggle("selected", card.dataset.contributionType === typeId));
        root.sessionStorage?.setItem("bscoutContributionDraft", JSON.stringify({
            ContributionType: typeId,
            ModelID: returnContext.modelId || null,
            ManufacturerName: returnContext.manufacturer || null,
            ModelName: returnContext.model || null,
            Variant: returnContext.variant || null,
            Source: returnContext.source,
            StartedAt: new Date().toISOString()
        }));
        renderForm(selectedType);
    }

    function resetTypeSelection() {
        selectedType = null;
        $("contributionFormPanel").hidden = true;
        $("contributionTypeGroups").hidden = false;
        $("contributionFormMessage").hidden = true;
        document.querySelectorAll(".contribution-type-card").forEach(card => card.classList.remove("selected"));
        $("contributionTypeGroups")?.scrollIntoView({ behavior:"smooth", block:"start" });
    }

    async function open(context = {}, options = {}) {
        returnContext = Object.assign({ source: "global" }, context);
        selectedType = null;
        scoreImpact = options.impact || null;
        if (options.history !== false && root.history?.pushState) root.history.pushState({ bscoutView: "contribute", contributionSource: returnContext.source }, "");
        hidePrimaryViews();
        const view = $("contributionView");
        if (view) view.hidden = false;
        $("contributionContextText").textContent = contextLabel(returnContext);
        $("contributionSelectionState").hidden = true;
        $("contributionFormPanel").hidden = true;
        $("contributionTypeGroups").hidden = false;
        const [data] = await Promise.all([loadTaxonomy(), loadModels(), loadModelSchema()]);
        renderGroups(data, returnContext);
        if (options.typeId) {
            selectType(options.typeId);
            if (options.fieldId && options.typeId === "correction") {
                const fieldSelect = $("correctionField");
                if (fieldSelect) { fieldSelect.value = options.fieldId; updateCorrectionCurrentValue(); }
            }
            if (options.resourceType && options.typeId === "resource") {
                const resourceSelect = $("resourceType");
                if (resourceSelect) resourceSelect.value = options.resourceType;
            }
            if (options.documentType && options.typeId === "manual_document") {
                const documentSelect = $("documentType");
                if (documentSelect) documentSelect.value = options.documentType;
            }
        }
        if (view) { const h=document.querySelector(".site-header")?.getBoundingClientRect().height||72; window.scrollTo({top:Math.max(0,view.getBoundingClientRect().top+window.scrollY-h-18),behavior:"smooth"}); }
    }

    function openGlobal(options = {}) { return open({ source: "global" }, options); }
    function openGuide(button, options = {}) {
        return open({ source:"guide", modelId:button?.dataset.modelId || "", manufacturer:button?.dataset.manufacturer || "", model:button?.dataset.model || "", variant:button?.dataset.variant || "", guideName:button?.dataset.guideName || "" }, options);
    }

    function goBack() {
        const view = $("contributionView");
        if (view) view.hidden = true;
        if (returnContext.source === "guide") {
            const guide = $("boatGuideView");
            if (guide) { guide.hidden = false; guide.scrollIntoView({ behavior:"smooth", block:"start" }); }
            return;
        }
        const home = $("lifecycleHome");
        if (home) { home.hidden = false; home.scrollIntoView({ behavior:"smooth", block:"start" }); }
    }

    document.addEventListener("click", event => {
        const guideButton = event.target.closest("#contributeToGuideBtn");
        if (guideButton) { event.preventDefault(); openGuide(guideButton); return; }
        const typeCard = event.target.closest("[data-contribution-type]");
        if (typeCard) { event.preventDefault(); selectType(typeCard.dataset.contributionType); }
    });
    $("contributionBack")?.addEventListener("click", goBack);
    $("changeContributionType")?.addEventListener("click", resetTypeSelection);
    $("contributionForm")?.addEventListener("submit", onSubmit);

    root.BScoutContributions = { openGlobal, openGuide, open, goBack, getPending: readPending };
})(window);
