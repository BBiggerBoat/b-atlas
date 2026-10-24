const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const filePath = path.join(root, "data", "image-candidates.json");
const writeChanges = process.argv.includes("--write");
const strict = process.argv.includes("--strict");
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const models = Array.isArray(data.models) ? data.models : [];
const now = new Date().toISOString().slice(0, 10);

async function checkUrl(url) {
  if (!url) return { ok: false, status: 0 };
  const signal = AbortSignal.timeout(15000);
  let response;
  try {
    response = await fetch(url, {
      signal,
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "B-Atlas-Image-Health/1.0" }
    });
    if (response.status === 405 || response.status === 403 || response.status === 400) {
      await response.body?.cancel();
      response = await fetch(url, {
        signal,
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "B-Atlas-Image-Health/1.0",
          "Range": "bytes=0-1023"
        }
      });
    }
    const type = response.headers.get("content-type") || "";
    return { ok: response.ok && type.toLowerCase().startsWith("image/"), status: response.status, contentType: type, finalURL: response.url };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  } finally {
    await response?.body?.cancel().catch(() => {});
  }
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  const results = new Array(items.length);
  async function next() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, next));
  return results;
}

const flat = [];
for (const model of models) {
  (model.candidates || []).forEach((candidate, candidateIndex) => {
    flat.push({ model, candidate, candidateIndex });
  });
}

runPool(flat, 8, async ({ model, candidate, candidateIndex }) => {
  const result = await checkUrl(candidate.externalThumbnailURL);
  const previous = candidate.health || {};
  candidate.health = {
    status: result.ok ? "healthy" : "failed",
    lastChecked: now,
    lastSuccessful: result.ok ? now : (previous.lastSuccessful || null),
    failureCount: result.ok ? 0 : Number(previous.failureCount || 0) + 1,
    httpStatus: result.status || null
  };
  return {
    boatModelId: model.boatModelId,
    candidateIndex,
    ok: result.ok,
    status: result.status,
    contentType: result.contentType || null,
    finalURL: result.finalURL || null,
    error: result.error || null,
    domain: candidate.sourceDomain || ""
  };
}).then(results => {
  const healthy = results.filter(item => item.ok).length;
  const failed = results.length - healthy;
  const failedModels = results.filter(item => !item.ok).map(item => `${item.boatModelId} [${item.candidateIndex}] ${item.domain} HTTP ${item.status || "error"}`);
  console.log(`Checked ${results.length} image candidates: ${healthy} healthy, ${failed} failed.`);
  const reportIndex = process.argv.indexOf("--report");
  if (reportIndex !== -1) {
    const reportPath = process.argv[reportIndex + 1];
    if (!reportPath || reportPath.startsWith("--")) throw new Error("--report requires an output path");
    fs.writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), healthy, failed, results }, null, 2) + "\n");
  }
  if (failedModels.length) console.log(failedModels.join("\n"));

  if (writeChanges) {
    data.lastHealthCheck = now;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log("Updated data/image-candidates.json health metadata.");
  }

  if (strict && failed) process.exitCode = 1;
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
