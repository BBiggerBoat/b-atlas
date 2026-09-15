const STATE_KEYS = ["pending", "reviewed", "knowledgeItems", "knowledgeEvidence", "resourceReview", "published"];

export function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function cleanFilename(value) {
  return String(value || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export function emptyPublished() {
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

export async function getJsonRow(db, key, fallback) {
  const row = await db.prepare("SELECT json FROM bscout_state WHERE key = ?1").bind(key).first();
  if (!row?.json) return fallback;
  try { return JSON.parse(row.json); } catch { return fallback; }
}

export async function putJsonRow(db, key, value) {
  const updatedAt = new Date().toISOString();
  await db.prepare(`
    INSERT INTO bscout_state (key, json, updated_at)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
  `).bind(key, JSON.stringify(value), updatedAt).run();
  return updatedAt;
}

export async function getSnapshot(db) {
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

export async function saveSnapshot(db, snapshot) {
  const now = new Date().toISOString();
  const statements = STATE_KEYS.slice(0, 5).map(key => db.prepare(`
    INSERT INTO bscout_state (key, json, updated_at)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
  `).bind(key, JSON.stringify(Array.isArray(snapshot[key]) ? snapshot[key] : []), now));
  await db.batch(statements);
  return now;
}

export async function getPublished(db) {
  const value = await getJsonRow(db, "published", emptyPublished());
  return { ...emptyPublished(), ...(value && typeof value === "object" ? value : {}) };
}

export async function savePublished(db, value) {
  value.updatedAt = new Date().toISOString();
  await putJsonRow(db, "published", value);
  return value;
}

export async function constantTimeTokenMatches(request, expected) {
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

export async function anonymousIpHash(request, secret) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bytes = new TextEncoder().encode(`${secret || "bscout"}|${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function rateAllowed(db, request, secret) {
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

export function decodeBase64(base64) {
  const binary = atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function correctionTarget(field) {
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

export function normalizeCorrectionValue(target, raw, sourceField = "", proposedUnit = "") {
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

export function uniqueCode(name, existing) {
  let base = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X");
  let code = base, n = 1;
  while (existing.has(code)) { code = base.slice(0, 3) + String(n % 10); n++; }
  return code;
}
