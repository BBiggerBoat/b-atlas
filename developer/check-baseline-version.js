#!/usr/bin/env node

const fs = require("fs");

function fail(message) {
  console.error("B-Atlas deployment guard FAILED: " + message);
  process.exitCode = 1;
}

function readJson(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch (error) { fail(`${path} could not be read as JSON (${error.message})`); return null; }
}

const pkg = readJson("package.json");
const baseline = readJson("baseline-version.json");
if (!pkg || !baseline) process.exit(1);

const expected = String(pkg.version || "").trim();
const actual = String(baseline.baselineVersion || "").trim();

if (!/^\d+\.\d+\.\d+$/.test(expected)) fail(`package.json version "${expected}" is not a three-part version`);
if (actual !== expected) fail(`baseline-version.json says ${actual || "(missing)"} but package.json says ${expected}`);

const filesToCheck = ["index.html"];
for (const path of filesToCheck) {
  const text = fs.readFileSync(path, "utf8");
  if (!text.includes(`v${expected}`)) fail(`${path} does not expose v${expected}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`B-Atlas deployment guard OK — baseline v${expected}`);
