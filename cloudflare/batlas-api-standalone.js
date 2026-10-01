// B-Atlas standalone Cloudflare Worker bundle.
// GENERATED FILE — do not hand edit.
// Sources: functions/_lib/bscout-store.js, functions/api/[[path]].js, cloudflare/worker.js.
// Regenerate with: npm run build:worker

const STATE_KEYS = ["pending", "reviewed", "knowledgeItems", "knowledgeEvidence", "resourceReview", "published"];

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function cleanFilename(value) {
  return String(value || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function emptyPublished() {
  return {
    modelPatches: {},
    addedModels: [],
    addedManufacturers: [],
    reviewedContributions: [],
    knowledgeItems: [],
    knowledgeEvidence: [],
    resourceAdditions: [],
    updatedAt: null
  };
}

async function getJsonRow(db, key, fallback) {
  const row = await db.prepare("SELECT json FROM bscout_state WHERE key = ?1").bind(key).first();
  if (!row?.json) return fallback;
  try { return JSON.parse(row.json); } catch { return fallback; }
}

async function putJsonRow(db, key, value) {
  const updatedAt = new Date().toISOString();
  await db.prepare(`
    INSERT INTO bscout_state (key, json, updated_at)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
  `).bind(key, JSON.stringify(value), updatedAt).run();
  return updatedAt;
}

async function getSnapshot(db) {
  const [pending, reviewed, knowledgeItems, knowledgeEvidence, resourceReview] = await Promise.all([
    getJsonRow(db, "pending", []),
    getJsonRow(db, "reviewed", []),
    getJsonRow(db, "knowledgeItems", []),
    getJsonRow(db, "knowledgeEvidence", []),
    getJsonRow(db, "resourceReview", [])
  ]);
  const stamp = await db.prepare("SELECT MAX(updated_at) AS updatedAt FROM bscout_state").first();
  return {
    schema: "bscout-shared-community-v2-cloudflare",
    pending: Array.isArray(pending) ? pending : [],
    reviewed: Array.isArray(reviewed) ? reviewed : [],
    knowledgeItems: Array.isArray(knowledgeItems) ? knowledgeItems : [],
    knowledgeEvidence: Array.isArray(knowledgeEvidence) ? knowledgeEvidence : [],
    resourceReview: Array.isArray(resourceReview) ? resourceReview : [],
    updatedAt: stamp?.updatedAt || null
  };
}

async function saveSnapshot(db, snapshot) {
  const now = new Date().toISOString();
  const statements = STATE_KEYS.slice(0, 5).map(key => db.prepare(`
    INSERT INTO bscout_state (key, json, updated_at)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
  `).bind(key, JSON.stringify(Array.isArray(snapshot[key]) ? snapshot[key] : []), now));
  await db.batch(statements);
  return now;
}

async function getPublished(db) {
  const value = await getJsonRow(db, "published", emptyPublished());
  return { ...emptyPublished(), ...(value && typeof value === "object" ? value : {}) };
}

async function savePublished(db, value) {
  value.updatedAt = new Date().toISOString();
  await putJsonRow(db, "published", value);
  return value;
}

async function constantTimeTokenMatches(request, expected) {
  if (!expected) return false;
  const auth = String(request.headers.get("Authorization") || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const supplied = match ? match[1].trim() : "";
  const a = new TextEncoder().encode(String(supplied));
  const b = new TextEncoder().encode(String(expected));
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

function adminOriginAllowed(request) {
  const origin = String(request.headers.get("Origin") || "");
  return origin === "https://b-atlas.org" || origin === "https://www.b-atlas.org";
}

async function recordAdminAuthFailure(db, request, secret, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hash = `admin:${await anonymousIpHash(request, secret)}`;
  const row = await db.prepare("SELECT COUNT(*) AS n FROM bscout_rate_events WHERE ip_hash = ?1 AND created_at >= ?2")
    .bind(hash, windowStart).first();
  if (Number(row?.n || 0) >= limit) return false;
  await db.batch([
    db.prepare("INSERT INTO bscout_rate_events (ip_hash, created_at) VALUES (?1, ?2)").bind(hash, now),
    db.prepare("DELETE FROM bscout_rate_events WHERE created_at < ?1").bind(now - 24 * 60 * 60 * 1000)
  ]);
  return true;
}

async function anonymousIpHash(request, secret) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${secret || "bscout"}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(db, request, secret, {
  namespace = "public",
  limit = 60,
  windowMs = 10 * 60 * 1000,
  record = true
} = {}) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hash = `${namespace}:${await anonymousIpHash(request, secret)}`;
  const row = await db.prepare("SELECT COUNT(*) AS n FROM bscout_rate_events WHERE ip_hash = ?1 AND created_at >= ?2")
    .bind(hash, windowStart).first();
  const used = Number(row?.n || 0);
  const allowed = used < limit;
  if (allowed && record) {
    await db.batch([
      db.prepare("INSERT INTO bscout_rate_events (ip_hash, created_at) VALUES (?1, ?2)").bind(hash, now),
      db.prepare("DELETE FROM bscout_rate_events WHERE created_at < ?1").bind(now - 24 * 60 * 60 * 1000)
    ]);
  }
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - used - (allowed && record ? 1 : 0)),
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil(windowMs / 1000))
  };
}

async function rateAllowed(db, request, secret) {
  const result = await rateLimit(db, request, secret, { namespace:"contribution", limit:5, windowMs:10 * 60 * 1000 });
  return result.allowed;
}

async function contributionDailyAllowed(db, request, secret) {
  const result = await rateLimit(db, request, secret, { namespace:"contribution-day", limit:20, windowMs:24 * 60 * 60 * 1000 });
  return result;
}

function decodeBase64(base64) {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function correctionTarget(field) {
  const legacy = {
    YearStart: "FirstYear", YearEnd: "LastYear", LengthFt: "LOA", BeamFt: "Beam",
    DraftFt: "Draft", DisplacementLb: "Displacement", FuelCapacityGal: "FuelCapacity",
    WaterCapacityGal: "WaterCapacity", NormalizedHullType: "HullConfigurationCode",
    NormalizedFuel: "FuelCode", NormalizedPropulsion: "MechanicalPropulsionCode",
    BoatFamily: "BoatFamilyCode", ModelCharacter: "StyleCode"
  };
  if (legacy[field]) return legacy[field];

  const canonical = new Set([
    "Manufacturer","Brand","Builder","Model","Variant","Nickname","FirstYear","LastYear","Designer","TotalBuilt",
    "BuilderCountryCode","DesignCountryCode","ModelAliases","VesselCategoryCode","PrimaryPropulsionModeCode",
    "LOA","LWL","Beam","Draft","AirDraft","Headroom","HeadroomSalon","HeadroomHelm","HeadroomGalley","HeadroomHead",
    "HeadroomForwardCabin","Displacement","FuelCapacity","WaterCapacity","HoldingCapacity","CruiseSpeed","MaxSpeed",
    "Range","MastHeight","SailArea","Ballast","HullMaterialCode","HullBehaviourCode","HullConfigurationCode",
    "KeelConfigurationCode","RudderTypeCode","RunningGearProtectionCode","Construction","FuelCode",
    "MechanicalPropulsionCode","EngineCount","EngineConfiguration","TypicalEngineID","EnginePowerPerEngine",
    "TotalInstalledPower","CoolingCode","SteeringTypeCode","PropellerCount","AuxiliaryEnginePresent","RigTypeCode",
    "MastCount","MastMaterialCode","MastSteppingCode","MastLoweringCode","StandingRiggingCode","MainsailTypeCode",
    "HeadsailConfigurationCode","BoatFamilyCode","StyleCode","Configuration","Cabins","Berths","Heads","FlybridgeCode",
    "AftCabin","SideDecksCode","GalleyUpWithHelm","ShowerTypeCode","WalkthroughTransom","SideHelmDoor",
    "RemovableFlybridge","Trailerable","VBerthLength","CECategoryCode","CertificationNotes",
    "DisplacementCruiseSpeed","DisplacementCruiseFuelBurn","PlaningCruiseSpeed","PlaningCruiseFuelBurn"
  ]);
  return canonical.has(field) ? field : null;
}

function normalizeCorrectionValue(target, raw, sourceField = "", proposedUnit = "") {
  const integerTargets = new Set(["FirstYear","LastYear","TotalBuilt","EngineCount","PropellerCount","MastCount","Cabins","Berths","Heads"]);
  if (integerTargets.has(target)) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  const booleanTargets = new Set(["AuxiliaryEnginePresent","AftCabin","GalleyUpWithHelm","WalkthroughTransom","SideHelmDoor","RemovableFlybridge","Trailerable"]);
  if (booleanTargets.has(target)) {
    if (raw === true || String(raw).toLowerCase() === "true") return true;
    if (raw === false || String(raw).toLowerCase() === "false") return false;
    if (String(raw).toLowerCase() === "unknown") return null;
    return undefined;
  }

  const measurementTargets = new Set([
    "LOA","LWL","Beam","Draft","AirDraft","Headroom","HeadroomSalon","HeadroomHelm","HeadroomGalley","HeadroomHead",
    "HeadroomForwardCabin","Displacement","FuelCapacity","WaterCapacity","HoldingCapacity","CruiseSpeed","MaxSpeed",
    "Range","MastHeight","SailArea","Ballast","EnginePowerPerEngine","TotalInstalledPower","VBerthLength",
    "DisplacementCruiseSpeed","DisplacementCruiseFuelBurn","PlaningCruiseSpeed","PlaningCruiseFuelBurn"
  ]);
  if (measurementTargets.has(target)) {
    const n = Number(String(raw ?? "").replace(/[^0-9.+-]/g, ""));
    if (!Number.isFinite(n)) return undefined;

    const unit = String(proposedUnit || "").trim();
    if (unit === "ft") return n * 0.3048;
    if (unit === "in") return n * 0.0254;
    if (unit === "lb") return n * 0.45359237;
    if (unit === "us_gal") return n * 3.785411784;
    if (unit === "imp_gal") return n * 4.54609;
    if (unit === "hp") return n * 0.745699872;
    if (unit === "us_gal_h") return n * 3.785411784;
    if (unit === "imp_gal_h") return n * 4.54609;

    if (["LengthFt","BeamFt","DraftFt"].includes(sourceField)) return n * 0.3048;
    if (sourceField === "DisplacementLb") return n * 0.45359237;
    return n;
  }

  if (target === "ModelAliases") {
    if (Array.isArray(raw)) return raw;
    return String(raw || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  return raw;
}

function uniqueCode(name, existing) {
  let base = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X");
  let code = base, n = 1;
  while (existing.has(code)) { code = base.slice(0, 3) + String(n % 10); n++; }
  return code;
}

const ALLOWED_RIGHTS = new Set(["creator_or_owner", "permission_granted", "public_distribution"]);
const ACCEPTED_UPLOAD_RIGHTS = new Set(["creator_or_owner", "permission_granted", "public_distribution", "uncertain"]);
const ALLOWED_CONTRIBUTION_TYPES = new Set([
  "ownership_experience","problem_weakness","buyer_inspection_advice","correction","other",
  "photo","manual_document","resource","new_model","new_manufacturer"
]);
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg","image/png","image/webp"]);
const ALLOWED_DOCUMENT_MIME = new Set(["application/pdf"]);
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_PHOTO_FILES = 8;
const MAX_PHOTO_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_REQUEST_BYTES = 45 * 1024 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireBindings(env) {
  if (!env.BSCOUT_DB) throw new Error("BSCOUT_DB D1 binding is not configured");
  if (!env.BSCOUT_FILES) throw new Error("BSCOUT_FILES KV binding is not configured");
}

async function readBody(request, limit = MAX_REQUEST_BYTES) {
  const type = String(request.headers.get("Content-Type") || "").toLowerCase();
  if (!type.startsWith("application/json")) throw httpError(415, "Content-Type must be application/json");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length && length > limit) throw httpError(413, "Request too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) throw httpError(413, "Request too large");
  try { return JSON.parse(text); }
  catch { throw httpError(400, "Invalid JSON request"); }
}

function attachmentKey(id) { return `attachment:${cleanFilename(id)}`; }

function detectedMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0,5)) === "%PDF-") return "application/pdf";
  return null;
}

function validateContributionRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw httpError(400, "Invalid contribution record");
  if (new TextEncoder().encode(JSON.stringify(record)).byteLength > MAX_RECORD_BYTES) throw httpError(413, "Contribution record is too large");
  const id = String(record.ContributionID || "");
  if (!/^CONTRIB-[A-Za-z0-9-]{8,120}$/.test(id)) throw httpError(400, "Invalid contribution ID");
  if (!ALLOWED_CONTRIBUTION_TYPES.has(String(record.ContributionType || ""))) throw httpError(400, "Invalid contribution type");
  if (!Array.isArray(record.AttachmentRefs)) throw httpError(400, "Invalid attachment references");
  if (record.AttachmentRefs.length > MAX_PHOTO_FILES) throw httpError(400, "Too many attachments");
  if (new Set(record.AttachmentRefs).size !== record.AttachmentRefs.length) throw httpError(400, "Duplicate attachment reference");
}

function validateAttachmentRef(contributionId, ref, index, isDocument) {
  const suffix = String(contributionId).replace(/^CONTRIB-/, "");
  const expected = isDocument
    ? `ATT-DOC-${suffix}`
    : `ATT-${suffix}-${String(index + 1).padStart(2, "0")}`;
  if (String(ref || "") !== expected) throw httpError(400, "Attachment reference does not match contribution");
}

function validatedAttachments(record, attachments) {
  const rows = Array.isArray(attachments) ? attachments : [];
  const refs = record.AttachmentRefs || [];
  if (rows.length !== refs.length) throw httpError(400, "Attachment payload does not match contribution references");

  const type = String(record.ContributionType || "");
  if (!["photo","manual_document","new_model"].includes(type) && rows.length) throw httpError(400, "Attachments are not allowed for this contribution type");

  if (rows.length && !ACCEPTED_UPLOAD_RIGHTS.has(String(record.RightsStatus || ""))) throw httpError(400, "Attachment rights declaration is required");

  if (type === "manual_document") {
    if (String(record.Payload?.DocumentDelivery || "") !== "upload") {
      if (rows.length) throw httpError(400, "Document attachment not expected");
      return [];
    }
    if (rows.length !== 1) throw httpError(400, "Exactly one PDF document is required");
  }

  if (type === "new_model" && rows.length > 1) throw httpError(400, "Only one new-model photo may be uploaded");
  if (type === "photo" && (rows.length < 1 || rows.length > MAX_PHOTO_FILES)) throw httpError(400, "Photo contribution must contain 1 to 8 photos");

  let totalBytes = 0;
  const validated = rows.map((a,index) => {
    if (!a || typeof a !== "object" || !a.dataBase64) throw httpError(400, "Attachment data is missing");
    const isDocument = type === "manual_document";
    validateAttachmentRef(record.ContributionID, a.attachmentRef, index, isDocument);
    if (String(a.attachmentRef) !== String(refs[index])) throw httpError(400, "Attachment order/reference mismatch");

    let bytes;
    try { bytes = decodeBase64(a.dataBase64); }
    catch { throw httpError(400, "Attachment data is not valid base64"); }

    const actualMime = detectedMime(bytes);
    const declaredMime = String(a.mime || a.type || "").toLowerCase().trim();
    if (!actualMime) throw httpError(415, "Unsupported attachment file type");
    if (declaredMime && declaredMime !== actualMime) throw httpError(415, "Attachment type does not match file contents");

    if (isDocument) {
      if (!ALLOWED_DOCUMENT_MIME.has(actualMime)) throw httpError(415, "Only PDF documents are accepted");
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw httpError(413, "Document must be 25 MB or smaller");
    } else {
      if (!ALLOWED_IMAGE_MIME.has(actualMime)) throw httpError(415, "Only JPEG, PNG or WebP images are accepted");
      if (bytes.byteLength > MAX_PHOTO_BYTES) throw httpError(413, "Photo must be 12 MB or smaller");
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_PHOTO_TOTAL_BYTES) throw httpError(413, "Combined photos must be 30 MB or smaller");
    }

    const filename = cleanFilename(a.filename || a.attachmentRef);
    const lower = filename.toLowerCase();
    const extOk = actualMime === "image/jpeg" ? /\.jpe?g$/.test(lower)
      : actualMime === "image/png" ? /\.png$/.test(lower)
      : actualMime === "image/webp" ? /\.webp$/.test(lower)
      : actualMime === "application/pdf" ? /\.pdf$/.test(lower)
      : false;
    if (!extOk) throw httpError(415, "Attachment filename extension does not match file contents");

    return { attachmentRef:a.attachmentRef, filename, contentType:actualMime, bytes };
  });

  return validated;
}

async function storeAttachments(env, record, attachments) {
  const validated = validatedAttachments(record, attachments);
  for (const a of validated) {
    await env.BSCOUT_FILES.put(attachmentKey(a.attachmentRef), a.bytes, {
      metadata: {
        filename: a.filename,
        contentType: a.contentType,
        contributionId: String(record.ContributionID || "").slice(0, 160),
        validatedAt: new Date().toISOString()
      }
    });
  }
}

async function attachmentManifest(env) {
  const rows = [];
  let cursor;
  do {
    const page = await env.BSCOUT_FILES.list({ prefix: "attachment:", limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const key of page.keys || []) rows.push({
      attachmentRef: String(key.name || "").replace(/^attachment:/, ""),
      key: key.name,
      metadata: key.metadata || null,
      expiration: key.expiration || null
    });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return rows;
}

async function publicOverlays(env) {
  const published = await getPublished(env.BSCOUT_DB);
  const { canonicalChangeHistory, ...publicPublished } = published;
  return jsonResponse(publicPublished, 200, { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" });
}

function canonicalChangeRecord({ type, targetType, targetId, fields = [], before = null, after = null, row = null, reason = null }) {
  const now = new Date().toISOString();
  return {
    ChangeID: `chg-${now.replace(/[^0-9]/g, "").slice(0, 17)}-${crypto.randomUUID().slice(0, 8)}`,
    ChangedAt: now,
    Type: type,
    TargetType: targetType,
    TargetID: targetId,
    Fields: fields,
    Before: before,
    After: after,
    SourceContributionID: row?.ContributionID || null,
    Reason: reason || row?.ModeratorNotes || row?.CanonicalDraft?.ResearchNotes || row?.Payload?.Notes || "Reviewed canonical change",
    ChangedBy: "B-Atlas Community Moderation",
    RevertedAt: null,
    RevertedByChangeID: null
  };
}

function appendCanonicalHistory(published, change) {
  published.canonicalChangeHistory = [...(published.canonicalChangeHistory || []), change];
  return change;
}

async function ensureCanonicalHistory(env, published) {
  if ((published.canonicalChangeHistory || []).length) return published.canonicalChangeHistory;
  const seeded = [];
  for (const [modelId, patch] of Object.entries(published.modelPatches || {})) {
    seeded.push(canonicalChangeRecord({
      type: "legacy_overlay_import", targetType: "model_patch", targetId: modelId,
      fields: Object.keys(patch || {}).filter(k => !["LastUpdated","ReviewedBy"].includes(k)),
      before: null, after: patch,
      reason: "Existing published D1 overlay captured when Phase 1F change history was initialized"
    }));
  }
  for (const rec of published.addedModels || []) {
    seeded.push(canonicalChangeRecord({
      type: "legacy_overlay_import", targetType: "added_model", targetId: rec.BoatModelID,
      fields: Object.keys(rec), before: null, after: rec,
      reason: "Existing D1-added model captured when Phase 1F change history was initialized"
    }));
  }
  for (const rec of published.addedManufacturers || []) {
    seeded.push(canonicalChangeRecord({
      type: "legacy_overlay_import", targetType: "added_manufacturer", targetId: rec.ManufacturerCode,
      fields: Object.keys(rec), before: null, after: rec,
      reason: "Existing D1-added manufacturer captured when Phase 1F change history was initialized"
    }));
  }
  published.canonicalChangeHistory = seeded;
  await savePublished(env.BSCOUT_DB, published);
  return seeded;
}

async function revertCanonicalChange(env, changeId) {
  const published = await getPublished(env.BSCOUT_DB);
  const history = [...(published.canonicalChangeHistory || [])];
  const index = history.findIndex(x => x.ChangeID === changeId);
  if (index < 0) throw new Error("Canonical change not found");
  const original = history[index];
  if (original.RevertedAt) throw new Error("Canonical change already reverted");
  const laterActiveChange = history.slice(index + 1).some(x =>
    x.TargetType === original.TargetType &&
    x.TargetID === original.TargetID &&
    !x.RevertedAt &&
    x.Type !== "revert"
  );
  if (laterActiveChange) throw new Error("A newer canonical change exists for this record. Revert the newest change first.");

  if (original.TargetType === "model_patch") {
    const patches = { ...(published.modelPatches || {}) };
    if (original.Before && Object.keys(original.Before).length) patches[original.TargetID] = original.Before;
    else delete patches[original.TargetID];
    published.modelPatches = patches;
  } else if (original.TargetType === "added_model") {
    published.addedModels = (published.addedModels || []).filter(x => x.BoatModelID !== original.TargetID);
  } else if (original.TargetType === "added_manufacturer") {
    published.addedManufacturers = (published.addedManufacturers || []).filter(x => x.ManufacturerCode !== original.TargetID);
  } else {
    throw new Error("Canonical change type cannot be reverted");
  }

  const reversal = canonicalChangeRecord({
    type: "revert",
    targetType: original.TargetType,
    targetId: original.TargetID,
    fields: original.Fields || [],
    before: original.After,
    after: original.Before,
    reason: `Reverted canonical change ${original.ChangeID}`
  });
  history[index] = { ...original, RevertedAt: reversal.ChangedAt, RevertedByChangeID: reversal.ChangeID };
  published.canonicalChangeHistory = [...history, reversal];
  await savePublished(env.BSCOUT_DB, published);
  return { reverted: original.ChangeID, reversal };
}

function publicReviewedRow(row) {
  const pub = { ...row, ContactEmail: null, ModeratorNotes: null };
  const urls = [];
  if (ALLOWED_RIGHTS.has(row.RightsStatus)) {
    for (const ref of row.AttachmentRefs || []) urls.push(`/api/public/attachments/${encodeURIComponent(ref)}`);
  }
  pub.PublishedAttachmentURLs = urls;
  return pub;
}

function resourceReviewPublicRow(row) {
  return {
    ResourceReviewID: row.ResourceReviewID, BoatModelID: row.BoatModelID, Manufacturer: row.Manufacturer || null, Model: row.Model || null, Variant: row.Variant || null,
    title: row.Title || `${row.Manufacturer || ""} ${row.Model || ""} resource`.trim(), url: row.URL, sourceLabel: row.SourceLabel || "B-Atlas research",
    resourceType: row.ResourceType || String(row.Category || "Resource").replace(/_/g, " "), verificationStatus: row.VerificationStatus || "Reviewed",
    scope: row.Scope || "Model-specific", confidence: row.Confidence || "Unknown", notes: row.Notes || "",
    group: row.Category === "video" ? "videos" : row.Category === "owner_community" ? "ownerCommunities" : "documents", category: row.Category || "unclassified"
  };
}

async function publishCommunity(env) {
  const snapshot = await getSnapshot(env.BSCOUT_DB);
  const published = await getPublished(env.BSCOUT_DB);
  await ensureCanonicalHistory(env, published);
  const now = new Date().toISOString();
  const reviewed = snapshot.reviewed || [];
  const modelPatches = { ...(published.modelPatches || {}) };
  let canonicalCorrections = 0;

  for (const row of reviewed) {
    if (row.ModerationStatus !== "approved" || row.ReviewAction !== "corrected" || row.ContributionType !== "correction" || row.CanonicalPublishedAt) continue;
    const source = row.Payload?.CorrectionField;
    const target = correctionTarget(source);
    if (!target || source === "Other" || !row.ModelID) continue;
    const value = normalizeCorrectionValue(target, row.Payload?.ProposedValue, source, row.Payload?.ProposedUnit);
    if (value === undefined) continue;
    const beforePatch = modelPatches[row.ModelID] ? { ...modelPatches[row.ModelID] } : null;
    modelPatches[row.ModelID] = { ...(modelPatches[row.ModelID] || {}), [target]: value, LastUpdated: now.slice(0, 10), ReviewedBy: "B-Atlas Community Moderation" };
    appendCanonicalHistory(published, canonicalChangeRecord({
      type: "correction",
      targetType: "model_patch",
      targetId: row.ModelID,
      fields: [target],
      before: beforePatch,
      after: { ...modelPatches[row.ModelID] },
      row
    }));
    row.CanonicalPublishedAt = now;
    row.CanonicalActionRef = `cloudflare:model-patch:${row.ModelID}:${target}`;
    canonicalCorrections++;
  }

  const existingResourceIds = new Set((published.resourceAdditions || []).map(r => r.ResourceReviewID));
  const resourceAdditions = [...(published.resourceAdditions || [])];
  let newResourceAdditions = 0;
  for (const row of snapshot.resourceReview || []) {
    if (row.Status !== "published" || !row.BoatModelID || !row.URL || existingResourceIds.has(row.ResourceReviewID)) continue;
    resourceAdditions.push(resourceReviewPublicRow(row)); existingResourceIds.add(row.ResourceReviewID); row.PublishedAt = row.PublishedAt || now; newResourceAdditions++;
  }
  if (canonicalCorrections || newResourceAdditions) await saveSnapshot(env.BSCOUT_DB, snapshot);
  const next = {
    ...published,
    modelPatches,
    reviewedContributions: reviewed.filter(r => r.ModerationStatus === "approved").map(publicReviewedRow),
    knowledgeItems: snapshot.knowledgeItems || [],
    knowledgeEvidence: snapshot.knowledgeEvidence || [],
    resourceAdditions,
    canonicalChangeHistory: published.canonicalChangeHistory || []
  };
  await savePublished(env.BSCOUT_DB, next);
  return {
    knowledgeItems: next.knowledgeItems.length,
    knowledgeEvidence: next.knowledgeEvidence.length,
    reviewedContributions: next.reviewedContributions.length,
    resourceAdditions: next.resourceAdditions.length,
    newResourceAdditions,
    canonicalCorrections
  };
}

function modelSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
}
function permanentModelFields(manufacturer, model, variant, rows) {
  const used = new Set((rows || []).map(x => String(x.CanonicalSlug || '')).filter(Boolean));
  const base = modelSlug([manufacturer, model, variant].filter(Boolean).join(' '));
  let slug = base, n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  return { CanonicalSlug: slug, CanonicalPath: `/models/${slug}/`, CanonicalURL: `https://b-atlas.org/models/${slug}/` };
}

async function promoteCanonical(env, row, baseline = {}) {
  if (!row?.CanonicalDraft) throw new Error("No moderator canonical draft supplied");
  const f = row.CanonicalDraft.Fields || {};
  const extra = Object.fromEntries((row.CanonicalDraft.AdditionalFields || []).filter(x => x.Key).map(x => [x.Key, x.Value]));
  const published = await getPublished(env.BSCOUT_DB);
  await ensureCanonicalHistory(env, published);
  const baselineModels = Array.isArray(baseline.models) ? baseline.models : [];
  const baselineManufacturers = Array.isArray(baseline.manufacturers) ? baseline.manufacturers : [];

  if (row.ContributionType === "new_manufacturer") {
    const name = String(f.CanonicalName || "").trim();
    if (!name) throw new Error("Canonical manufacturer name is required");
    const all = [...baselineManufacturers, ...(published.addedManufacturers || [])];
    if (all.some(x => String(x.CanonicalName || "").toLowerCase() === name.toLowerCase())) throw new Error("Manufacturer already exists");
    const codes = new Set(all.map(x => x.ManufacturerCode).filter(Boolean));
    const code = String(f.ManufacturerCode || "").trim().toUpperCase() || uniqueCode(name, codes);
    const rec = {
      ManufacturerCode: code, CanonicalName: name, LegacyManufacturerIDs: [],
      Aliases: String(f.Aliases || "").split(",").map(x => x.trim()).filter(Boolean),
      Status: f.Status || "Unknown", CodeStatus: "CommunityReviewed", BoatRecordCount: 0,
      Country: f.Country || null, YearStart: f.YearStart ? Number(f.YearStart) : null,
      YearEnd: f.YearEnd ? Number(f.YearEnd) : null, Website: f.Website || null,
      ResearchNotes: row.CanonicalDraft.ResearchNotes || null, ...extra
    };
    published.addedManufacturers = [...(published.addedManufacturers || []), rec].sort((a,b) => String(a.CanonicalName).localeCompare(String(b.CanonicalName)));
    appendCanonicalHistory(published, canonicalChangeRecord({ type: "add", targetType: "added_manufacturer", targetId: code, fields: Object.keys(rec), before: null, after: rec, row }));
    await savePublished(env.BSCOUT_DB, published);
    return { type: "manufacturer", id: code, record: rec };
  }

  if (row.ContributionType === "new_model") {
    const manufacturer = String(f.Manufacturer || "").trim(), model = String(f.Model || "").trim();
    if (!manufacturer || !model) throw new Error("Manufacturer and model are required");
    const allModels = [...baselineModels, ...(published.addedModels || [])];
    if (allModels.some(x => String(x.Manufacturer || "").toLowerCase() === manufacturer.toLowerCase() && String(x.Model || "").toLowerCase() === model.toLowerCase() && String(x.Variant || "").toLowerCase() === String(f.Variant || "").toLowerCase())) throw new Error("Model already exists");
    const allMfr = [...baselineManufacturers, ...(published.addedManufacturers || [])];
    const mfr = allMfr.find(x => String(x.CanonicalName || "").toLowerCase() === manufacturer.toLowerCase());
    const codes = new Set(allModels.map(x => String(x.BoatModelID || "").split("-")[0]).filter(Boolean));
    const code = String(f.ManufacturerCode || mfr?.ManufacturerCode || uniqueCode(manufacturer, codes)).toUpperCase();
    let slug = String(model).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18);
    let id = `${code}-${slug}`, i = 2;
    while (allModels.some(x => x.BoatModelID === id)) id = `${code}-${slug}-${i++}`;
    const existingMfrModel = allModels.find(x => String(x.Manufacturer || "").toLowerCase() === manufacturer.toLowerCase());
    const permanent = permanentModelFields(manufacturer, model, f.Variant, allModels);
    const rec = {
      ManufacturerID: existingMfrModel?.ManufacturerID || code, Manufacturer: manufacturer, Model: model,
      Variant: f.Variant || null, Nickname: [manufacturer, model, f.Variant].filter(Boolean).join(" "), ...permanent,
      ImageURL: "images/boat-placeholder.svg", Active: true, FirstYear: f.YearStart ? Number(f.YearStart) : null,
      LastYear: f.YearEnd ? Number(f.YearEnd) : null, LOA: f.LengthFt ? Number(f.LengthFt) * 0.3048 : null,
      Beam: f.BeamFt ? Number(f.BeamFt) * 0.3048 : null, Draft: f.DraftFt ? Number(f.DraftFt) * 0.3048 : null,
      Displacement: f.DisplacementLb ? Number(f.DisplacementLb) * 0.45359237 : null, BoatFamily: f.BoatFamily || null,
      Fuel: f.Fuel || null, NormalizedFuel: f.Fuel || null, Propulsion: f.Propulsion || null,
      NormalizedPropulsion: f.Propulsion || null, HullBehaviour: f.HullBehaviour || null,
      EngineConfiguration: f.EngineConfiguration || null, Designer: f.Designer || null,
      Construction: f.Construction || null, BoatModelID: id, DateCreated: new Date().toISOString().slice(0,10),
      LastUpdated: new Date().toISOString().slice(0,10), ReviewedBy: "B-Atlas Community Moderation", Revision: 1,
      CommunitySourceURL: f.SourceURL || null, ResearchNotes: row.CanonicalDraft.ResearchNotes || null, ...extra
    };
    published.addedModels = [...(published.addedModels || []), rec];
    appendCanonicalHistory(published, canonicalChangeRecord({ type: "add", targetType: "added_model", targetId: id, fields: Object.keys(rec), before: null, after: rec, row }));
    await savePublished(env.BSCOUT_DB, published);
    return { type: "model", id, record: rec };
  }
  throw new Error("Contribution is not a promotable manufacturer/model");
}

async function serveAttachment(env, id, admin) {
  if (!admin) {
    const published = await getPublished(env.BSCOUT_DB);
    const expected = `/api/public/attachments/${encodeURIComponent(id)}`;
    const allowed = (published.reviewedContributions || []).some(row => (row.PublishedAttachmentURLs || []).includes(expected));
    if (!allowed) return jsonResponse({ error: "Attachment not published" }, 404);
  }
  const result = await env.BSCOUT_FILES.getWithMetadata(attachmentKey(id), { type: "arrayBuffer" });
  if (!result?.value) return jsonResponse({ error: "Attachment not found" }, 404);
  const meta = result.metadata || {};
  const headers = {
    "Content-Type": meta.contentType || "application/octet-stream",
    "Content-Disposition": `${meta.contentType === "application/pdf" ? "attachment" : "inline"}; filename="${String(meta.filename || id).replace(/\"/g, "")}"`,
    "Cache-Control": admin ? "no-store" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
    "Cross-Origin-Resource-Policy": "same-site"
  };
  return new Response(result.value, { status: 200, headers });
}

async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, "");
  try {
    requireBindings(env);

    const publicOrigin = String(request.headers.get("Origin") || "");
    const allowedPublicOrigin = publicOrigin === "https://b-atlas.org" || publicOrigin === "https://www.b-atlas.org";

    async function enforceLimit(namespace, limit, windowMs) {
      const result = await rateLimit(env.BSCOUT_DB, request, env.BSCOUT_ADMIN_TOKEN, { namespace, limit, windowMs });
      if (result.allowed) return null;
      return jsonResponse(
        { error: "Too many requests. Try again later." },
        429,
        { "Retry-After": String(result.retryAfter), "X-RateLimit-Limit": String(result.limit), "X-RateLimit-Remaining": "0" }
      );
    }

    if (route === "health" && request.method === "GET") {
      const limited = await enforceLimit("health", 120, 10 * 60 * 1000);
      if (limited) return limited;
      return jsonResponse({ shared: true, version: "2.0-cloudflare", adminConfigured: !!env.BSCOUT_ADMIN_TOKEN, persistence: "D1+KV" });
    }
    if (route === "public/overlays" && request.method === "GET") {
      const limited = await enforceLimit("overlays", 60, 10 * 60 * 1000);
      if (limited) return limited;
      return publicOverlays(env);
    }
    if (route.startsWith("public/attachments/") && request.method === "GET") {
      const limited = await enforceLimit("public-attachment", 30, 10 * 60 * 1000);
      if (limited) return limited;
      return serveAttachment(env, decodeURIComponent(route.slice("public/attachments/".length)), false);
    }
    if (route === "contributions" && request.method === "POST") {
      if (!allowedPublicOrigin) return jsonResponse({ error: "Contribution origin not allowed" }, 403);
      if (!(await rateAllowed(env.BSCOUT_DB, request, env.BSCOUT_ADMIN_TOKEN))) {
        return jsonResponse({ error: "Too many submissions. Try again later." }, 429, { "Retry-After": "600" });
      }
      const daily = await contributionDailyAllowed(env.BSCOUT_DB, request, env.BSCOUT_ADMIN_TOKEN);
      if (!daily.allowed) {
        return jsonResponse({ error: "Daily submission limit reached. Try again later." }, 429, { "Retry-After": String(daily.retryAfter) });
      }
      const payload = await readBody(request);
      const record = payload?.record;
      validateContributionRecord(record);
      const snapshot = await getSnapshot(env.BSCOUT_DB);
      if ([...snapshot.pending, ...snapshot.reviewed].some(x => x.ContributionID === record.ContributionID)) return jsonResponse({ ok: true, id: record.ContributionID, duplicate: true });
      await storeAttachments(env, record, payload.attachments || []);
      snapshot.pending.push({ ...record, ModerationStatus: "pending", SharedReceivedAt: new Date().toISOString() });
      await saveSnapshot(env.BSCOUT_DB, snapshot);
      return jsonResponse({ ok: true, id: record.ContributionID, pending: snapshot.pending.length }, 201);
    }

    if (route.startsWith("admin/")) {
      if (!adminOriginAllowed(request)) return jsonResponse({ error: "Administrative requests must originate from B-Atlas" }, 403);
      if (!(await constantTimeTokenMatches(request, env.BSCOUT_ADMIN_TOKEN))) {
        const retryAllowed = await recordAdminAuthFailure(env.BSCOUT_DB, request, env.BSCOUT_ADMIN_TOKEN);
        return jsonResponse(
          { error: retryAllowed ? "Moderator authentication required" : "Too many failed moderator authentication attempts. Try again later." },
          retryAllowed ? 401 : 429
        );
      }
      const adminLimit = await enforceLimit("admin-authenticated", 240, 10 * 60 * 1000);
      if (adminLimit) return adminLimit;
      if (request.method !== "GET") {
        const mutationLimit = await enforceLimit("admin-mutation", 60, 10 * 60 * 1000);
        if (mutationLimit) return mutationLimit;
      }
      if (route === "admin/snapshot" && request.method === "GET") return jsonResponse(await getSnapshot(env.BSCOUT_DB));
      if (route === "admin/snapshot" && request.method === "PUT") {
        const payload = await readBody(request, 8 * 1024 * 1024);
        const current = await getSnapshot(env.BSCOUT_DB);
        const next = { ...current };
        for (const key of ["pending", "reviewed", "knowledgeItems", "knowledgeEvidence", "resourceReview"]) if (Array.isArray(payload[key])) next[key] = payload[key];
        const updatedAt = await saveSnapshot(env.BSCOUT_DB, next);
        return jsonResponse({ ok: true, updatedAt });
      }
      if (route === "admin/publish" && request.method === "POST") return jsonResponse({ ok: true, ...(await publishCommunity(env)) });
      if (route === "admin/promote" && request.method === "POST") {
        const payload = await readBody(request, 6 * 1024 * 1024);
        return jsonResponse({ ok: true, ...(await promoteCanonical(env, payload.contribution, payload.baseline || {})) });
      }
      if (route === "admin/canonical-history" && request.method === "GET") {
        const published = await getPublished(env.BSCOUT_DB);
        const changes = await ensureCanonicalHistory(env, published);
        return jsonResponse({ schema: "batlas-canonical-history-v1", changes });
      }
      if (route.startsWith("admin/canonical-history/") && route.endsWith("/revert") && request.method === "POST") {
        const changeId = decodeURIComponent(route.slice("admin/canonical-history/".length, -"/revert".length));
        return jsonResponse({ ok: true, ...(await revertCanonicalChange(env, changeId)) });
      }
      if (route === "admin/backup" && request.method === "GET") {
        const [snapshot, published, attachments] = await Promise.all([
          getSnapshot(env.BSCOUT_DB), getPublished(env.BSCOUT_DB), attachmentManifest(env)
        ]);
        return jsonResponse({
          schema: "batlas-backup-v1",
          baselineVersion: "7.06.2",
          exportedAt: new Date().toISOString(),
          snapshot,
          published,
          attachments: { count: attachments.length, manifest: attachments, blobsIncluded: false },
          recoveryNote: "GitHub preserves the versioned static baseline. This export preserves D1 community state and a KV attachment inventory; attachment binary recovery is tested separately in Phase 1N."
        });
      }
      if (route.startsWith("admin/attachments/") && request.method === "GET") return serveAttachment(env, decodeURIComponent(route.slice("admin/attachments/".length)), true);
    }
    return jsonResponse({ error: "API route not found" }, 404);
  } catch (error) {
    console.error("B-Atlas API error", error);
    const status = Number(error?.status);
    return jsonResponse({ error: error?.message || "Server error" }, Number.isInteger(status) && status >= 400 && status < 600 ? status : 500);
  }
}

const CORS_ORIGINS = new Set(["https://b-atlas.org", "https://www.b-atlas.org"]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  if (!CORS_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function withCors(request, response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      const headers = corsHeaders(request);
      if (!headers["Access-Control-Allow-Origin"]) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }
    const response = await onRequest({
      request,
      env,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException() {}
    });
    return withCors(request, response);
  }
};
