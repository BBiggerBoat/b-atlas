import {
  jsonResponse, cleanFilename, getSnapshot, saveSnapshot, getPublished, savePublished,
  constantTimeTokenMatches, rateAllowed, decodeBase64, correctionTarget,
  normalizeCorrectionValue, uniqueCode
} from "../_lib/bscout-store.js";

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

async function publicOverlays(env) {
  const published = await getPublished(env.BSCOUT_DB);
  return jsonResponse(published, 200, { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" });
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
    modelPatches[row.ModelID] = { ...(modelPatches[row.ModelID] || {}), [target]: value, LastUpdated: now.slice(0, 10), ReviewedBy: "B-Atlas Community Moderation" };
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
    resourceAdditions
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

export async function onRequest(context) {
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
      if (route === "admin/backup" && request.method === "GET") {
        return jsonResponse({ exportedAt: new Date().toISOString(), snapshot: await getSnapshot(env.BSCOUT_DB), published: await getPublished(env.BSCOUT_DB) });
      }
      if (route.startsWith("admin/attachments/") && request.method === "GET") return serveAttachment(env, decodeURIComponent(route.slice("admin/attachments/".length)), true);
    }
    return jsonResponse({ error: "API route not found" }, 404);
  } catch (error) {
    console.error("B-Atlas API error", error);
    return jsonResponse({ error: error?.message || "Server error" }, 500);
  }
}
