import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { evaluateAudit } from "../scripts/audit.mjs";

const url = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const now = new Date("2026-11-17T00:00:00Z");
function fixture() {
  const advisory = { source: 1247710, name: "picomatch", dependency: "picomatch",
    url, severity: "high", range: "<=4.0.7" };
  const vulnerabilities = {
    picomatch: { name: "picomatch", severity: "high", via: [advisory], nodes: ["node_modules/picomatch"] },
    fdir: { name: "fdir", severity: "high", via: ["picomatch"], nodes: ["node_modules/fdir"] },
    tinyglobby: { name: "tinyglobby", severity: "high", via: ["picomatch", "fdir"], nodes: ["node_modules/tinyglobby"] },
  };
  const packages = { "": { devDependencies: { tinyglobby: "1.0.0" } } };
  for (const name of Object.keys(vulnerabilities)) packages[`node_modules/${name}`] = { version: "1.0.0", dev: true };
  return {
    report: { auditReportVersion: 2, vulnerabilities,
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 3, critical: 0, total: 3 } } },
    lock: { lockfileVersion: 3, packages },
  };
}
const check = (f, status = 1, date = now) => evaluateAudit(f.report, f.lock, status, date);

test("waives the exact dev-only advisory and every exclusively propagated cause", () => {
  const messages = check(fixture());
  assert.match(messages.join("\n"), /ACCEPTED RISK.*GHSA-fc5q-39xc-vjpf/);
  assert.match(messages.join("\n"), /node_modules\/tinyglobby/);
});

for (const severity of ["moderate", "high", "critical"]) {
  test(`blocks mixed ${severity} advisory causes`, () => {
    const f = fixture();
    f.report.vulnerabilities.picomatch.via.push({
      source: 999, name: "picomatch", dependency: "picomatch",
      url: "https://github.com/advisories/GHSA-other", severity, range: "*",
    });
    assert.throws(() => check(f), /Unapproved/);
  });
  test(`blocks unrelated ${severity} dependency`, () => {
    const f = fixture();
    f.report.vulnerabilities.other = { name: "other", severity, via: [{
      source: 999, name: "other", dependency: "other",
      url: "https://github.com/advisories/GHSA-other", severity, range: "*",
    }], nodes: ["node_modules/other"] };
    f.lock.packages["node_modules/other"] = { dev: true, version: "1" };
    f.report.metadata.vulnerabilities[severity]++;
    f.report.metadata.vulnerabilities.total++;
    assert.throws(() => check(f), /Unapproved/);
  });
}

for (const [name, mutate] of [
  ["runtime node", f => { delete f.lock.packages["node_modules/picomatch"].dev; }],
  ["runtime propagated node", f => { f.lock.packages["node_modules/fdir"].dev = false; }],
  ["shared optional runtime node", f => { f.lock.packages["node_modules/picomatch"].devOptional = true; }],
  ["missing lock node", f => { delete f.lock.packages["node_modules/picomatch"]; }],
  ["missing cause", f => { f.report.vulnerabilities.fdir.via = ["unknown"]; }],
  ["cycle", f => { f.report.vulnerabilities.picomatch.via = ["tinyglobby"]; }],
  ["mixed cyclic causes", f => { f.report.vulnerabilities.fdir.via.push("tinyglobby"); }],
  ["empty causes", f => { f.report.vulnerabilities.picomatch.via = []; }],
  ["empty nodes", f => { f.report.vulnerabilities.picomatch.nodes = []; }],
  ["error response", f => { f.report.error = { code: "ENETUNREACH" }; }],
  ["missing metadata", f => { delete f.report.metadata; }],
  ["inconsistent totals", f => { f.report.metadata.vulnerabilities.total = 0; }],
  ["unsupported schema", f => { f.report.auditReportVersion = 1; }],
  ["invalid severity", f => { f.report.vulnerabilities.picomatch.severity = "unknown"; }],
  ["wrong identity", f => { f.report.vulnerabilities.picomatch.via[0].url += "/other"; }],
  ["malformed advisory", f => { delete f.report.vulnerabilities.picomatch.via[0].source; }],
  ["malformed lock", f => { f.lock.packages = null; }],
]) {
  test(`fails closed: ${name}`, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => check(f));
  });
}

for (const status of [null, 2, -1, 127, 0]) {
  test(`rejects unexpected audit exit ${status}`, () => assert.throws(() => check(fixture(), status)));
}
test("expires at the UTC deadline, not earlier", () => {
  assert.doesNotThrow(() => check(fixture(), 1, new Date("2026-12-16T23:59:59Z")));
  assert.throws(() => check(fixture(), 1, new Date("2026-12-17T00:00:00Z")), /expired/);
});
test("clean report passes after expiry with removal notice", () => {
  const f = fixture();
  f.report.vulnerabilities = {};
  f.report.metadata.vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  assert.match(check(f, 0, new Date("2027-01-01")).join("\n"), /not needed.*remove/i);
});
test("unrelated low-only findings preserve the moderate threshold", () => {
  const f = fixture();
  f.report.vulnerabilities = {
    low: { name: "low", severity: "low", nodes: ["node_modules/low"], via: [{
      source: 123, name: "low", dependency: "low", url: "https://github.com/advisories/low", severity: "low", range: "*",
    }] },
  };
  f.lock.packages["node_modules/low"] = { version: "1" };
  f.report.metadata.vulnerabilities = { info: 0, low: 1, moderate: 0, high: 0, critical: 0, total: 1 };
  assert.doesNotThrow(() => check(f, 0));
});

// The npm double is executable only in a private PATH: these tests never
// contact a registry. Exercise the real capture/check CLI and JSON parser.
for (const [name, output, status, expected] of [
  ["valid findings", JSON.stringify(fixture().report), 1, 0],
  ["malformed JSON", "{broken", 1, 1],
  ["network error", JSON.stringify({ error: { code: "ENETUNREACH" } }), 1, 1],
  ["unsupported report", JSON.stringify({ auditReportVersion: 1 }), 0, 1],
  ["unexpected subprocess exit", JSON.stringify(fixture().report), 2, 1],
]) {
  test(`capture CLI: ${name}`, () => {
    const root = mkdtempSync(join(tmpdir(), "audit-policy-"));
    try {
      writeFileSync(join(root, "npm"), `#!${process.execPath}
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["audit","--json","--audit-level=moderate","--registry=https://registry.npmjs.org"])) process.exit(99);
process.stdout.write(${JSON.stringify(output)});
process.exit(${status});
`, { mode: 0o700 });
      const file = join(root, "report.json");
      const result = spawnSync(process.execPath, [resolve("scripts/audit.mjs"), "capture", file],
        { encoding: "utf8", cwd: root, env: { PATH: root } });
      assert.equal(result.status, expected, result.stderr);
      assert.equal(result.stdout, output, "The full original report must remain visible");
      assert.equal(existsSync(file), expected === 0);
      if (expected === 0) assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { report: fixture().report, status });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
test("check CLI rejects malformed JSON offline", () => {
  const root = mkdtempSync(join(tmpdir(), "audit-policy-"));
  try {
    const file = join(root, "report.json");
    writeFileSync(file, "{broken");
    const result = spawnSync(process.execPath, [resolve("scripts/audit.mjs"), "check", file],
      { encoding: "utf8", cwd: root, env: { PATH: root } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Audit policy FAILED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
