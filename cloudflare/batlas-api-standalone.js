// B-Atlas standalone Cloudflare Worker bundle.
// Generated from functions/_lib/bscout-store.js and functions/api/[[path]].js.
// Phase 1G recovery deployment.

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
  const url = new URL(request.url);
  const bearer = String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const supplied = bearer || url.searchParams.get("token") || "";
  const a = new TextEncoder().encode(String(supplied));
  const b = new TextEncoder().encode(String(expected));
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

async function anonymousIpHash(request, secret) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${secret || "bscout"}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function rateAllowed(db, request, secret) {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const hash = await anonymousIpHash(request, secret);
  const row = await db.prepare("SELECT COUNT(*) AS n FROM bscout_rate_events WHERE ip_hash = ?1 AND created_at >= ?2")
    .bind(hash, windowStart).first();
  if (Number(row?.n || 0) >= 12) return false;
  await db.batch([
    db.prepare("INSERT INTO bscout_rate_events (ip_hash, created_at) VALUES (?1, ?2)").bind(hash, now),
    db.prepare("DELETE FROM bscout_rate_events WHERE created_at < ?1").bind(now - 24 * 60 * 60 * 1000)
  ]);
  return true;
}

function decodeBase64(base64) {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function correctionTarget(field) {
  return ({
    YearStart: "FirstYear", YearEnd: "LastYear", LengthFt: "LOA", BeamFt: "Beam",
    DraftFt: "Draft", DisplacementLb: "Displacement", FuelCapacityGal: "FuelCapacity",
    WaterCapacityGal: "WaterCapacity", NormalizedHullType: "NormalizedHullType",
    NormalizedFuel: "NormalizedFuel", NormalizedPropulsion: "NormalizedPropulsion",
    BoatFamily: "BoatFamily", ModelCharacter: "ModelCharacter",
    DisplacementCruiseSpeed: "DisplacementCruiseSpeed", DisplacementCruiseFuelBurn: "DisplacementCruiseFuelBurn",
    PlaningCruiseSpeed: "PlaningCruiseSpeed", PlaningCruiseFuelBurn: "PlaningCruiseFuelBurn"
  })[field] || null;
}

function normalizeCorrectionValue(target, raw, sourceField = "", proposedUnit = "") {
  if (["FirstYear", "LastYear"].includes(target)) {
    const n = parseInt(raw, 10); return Number.isFinite(n) ? n : undefined;
  }
  if (["LOA", "Beam", "Draft", "Displacement", "FuelCapacity", "WaterCapacity", "DisplacementCruiseSpeed", "DisplacementCruiseFuelBurn", "PlaningCruiseSpeed", "PlaningCruiseFuelBurn"].includes(target)) {
    const n = Number(String(raw ?? "").replace(/[^0-9.+-]/g, ""));
    if (!Number.isFinite(n)) return undefined;
    if (["LengthFt", "BeamFt", "DraftFt"].includes(sourceField)) return n * 0.3048;
    if (sourceField === "DisplacementLb") return n * 0.45359237;
    if (["DisplacementCruiseFuelBurn", "PlaningCruiseFuelBurn"].includes(target)) {
      if (proposedUnit === "us_gal_h") return n * 3.785411784;
      if (proposedUnit === "imp_gal_h") return n * 4.54609;
    }
    return n;
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
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function requireBindings(env) {
  if (!env.BSCOUT_DB) throw new Error("BSCOUT_DB D1 binding is not configured");
  if (!env.BSCOUT_FILES) throw new Error("BSCOUT_FILES KV binding is not configured");
}

async function readBody(request, limit = 60 * 1024 * 1024) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length && length > limit) throw new Error("Request too large");
  return request.json();
}

function attachmentKey(id) { return `attachment:${cleanFilename(id)}`; }

async function storeAttachments(env, contributionId, attachments) {
  for (const a of attachments || []) {
    if (!a?.attachmentRef || !a?.dataBase64) continue;
    const bytes = decodeBase64(a.dataBase64);
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("Attachment too large");
    await env.BSCOUT_FILES.put(attachmentKey(a.attachmentRef), bytes, {
      metadata: {
        filename: cleanFilename(a.filename || a.attachmentRef),
        contentType: String(a.type || "application/octet-stream").slice(0, 120),
        contributionId: String(contributionId || "").slice(0, 160)
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
    "Content-Disposition": `inline; filename="${String(meta.filename || id).replace(/\"/g, "")}"`,
    "Cache-Control": admin ? "no-store" : "public, max-age=300"
  };
  return new Response(result.value, { status: 200, headers });
}

async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, "");
  try {
    requireBindings(env);

    if (route === "health" && request.method === "GET") {
      return jsonResponse({ shared: true, version: "2.0-cloudflare", adminConfigured: !!env.BSCOUT_ADMIN_TOKEN, persistence: "D1+KV" });
    }
    if (route === "public/overlays" && request.method === "GET") return publicOverlays(env);
    if (route.startsWith("public/attachments/") && request.method === "GET") {
      return serveAttachment(env, decodeURIComponent(route.slice("public/attachments/".length)), false);
    }
    if (route === "contributions" && request.method === "POST") {
      if (!(await rateAllowed(env.BSCOUT_DB, request, env.BSCOUT_ADMIN_TOKEN))) return jsonResponse({ error: "Too many submissions. Try again later." }, 429);
      const payload = await readBody(request);
      const record = payload?.record;
      if (!record?.ContributionID || !record?.ContributionType) return jsonResponse({ error: "Invalid contribution record" }, 400);
      const snapshot = await getSnapshot(env.BSCOUT_DB);
      if ([...snapshot.pending, ...snapshot.reviewed].some(x => x.ContributionID === record.ContributionID)) return jsonResponse({ ok: true, id: record.ContributionID, duplicate: true });
      await storeAttachments(env, record.ContributionID, payload.attachments || []);
      snapshot.pending.push({ ...record, ModerationStatus: "pending", SharedReceivedAt: new Date().toISOString() });
      await saveSnapshot(env.BSCOUT_DB, snapshot);
      return jsonResponse({ ok: true, id: record.ContributionID, pending: snapshot.pending.length }, 201);
    }

    if (route.startsWith("admin/")) {
      if (!(await constantTimeTokenMatches(request, env.BSCOUT_ADMIN_TOKEN))) return jsonResponse({ error: "Moderator authentication required" }, 401);
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
    return jsonResponse({ error: error?.message || "Server error" }, 500);
  }
}


export default {
  async fetch(request, env, ctx) {
    return onRequest({
      request,
      env,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException() {}
    });
  }
};
