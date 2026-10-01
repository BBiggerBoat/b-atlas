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

export function adminOriginAllowed(request) {
  const origin = String(request.headers.get("Origin") || "");
  return origin === "https://b-atlas.org" || origin === "https://www.b-atlas.org";
}

export async function recordAdminAuthFailure(db, request, secret, limit = 8, windowMs = 10 * 60 * 1000) {
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

export function normalizeCorrectionValue(target, raw, sourceField = "", proposedUnit = "") {
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

export function uniqueCode(name, existing) {
  let base = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X");
  let code = base, n = 1;
  while (existing.has(code)) { code = base.slice(0, 3) + String(n % 10); n++; }
  return code;
}
