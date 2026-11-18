import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const approvedURL = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const expires = "2026-12-17T00:00:00Z";
const levels = ["info", "low", "moderate", "high", "critical"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const requireValid = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function evaluateAudit(report, lock, status, now = new Date()) {
  requireValid(object(report) && !Object.hasOwn(report, "error") &&
    report.auditReportVersion === 2 && object(report.vulnerabilities), "Invalid npm audit report");
  requireValid(object(lock) && lock.lockfileVersion === 3 && object(lock.packages) &&
    object(lock.packages[""]), "Invalid lockfile");
  const counts = report.metadata?.vulnerabilities;
  requireValid(object(counts), "Missing audit totals");
  const actual = Object.fromEntries(levels.map(level => [level, 0]));
  const entries = Object.entries(report.vulnerabilities);
  for (const [name, entry] of entries) {
    requireValid(object(entry) && entry.name === name && levels.includes(entry.severity) &&
      Array.isArray(entry.via) && entry.via.length > 0 &&
      Array.isArray(entry.nodes) && entry.nodes.length > 0, `Invalid audit entry: ${name}`);
    actual[entry.severity]++;
    for (const node of entry.nodes) {
      requireValid(typeof node === "string" && node.startsWith("node_modules/") &&
        Object.hasOwn(lock.packages, node) && object(lock.packages[node]), `Missing lock node: ${node}`);
    }
  }
  requireValid(levels.every(level => Number.isSafeInteger(counts[level]) && counts[level] === actual[level]) &&
    counts.total === entries.length, "Inconsistent audit totals");
  const blocking = entries.filter(([, entry]) => levels.indexOf(entry.severity) >= 2);
  requireValid(status === (blocking.length ? 1 : 0), `Unexpected npm audit exit: ${status}`);

  // Traverse every cause, including low findings: unknown references and cycles
  // are schema failures, not evidence that a propagated finding is approved.
  const resolved = new Map();
  function causes(name, visiting = new Set()) {
    requireValid(Object.hasOwn(report.vulnerabilities, name), `Unknown audit cause: ${name}`);
    requireValid(!visiting.has(name), `Cyclic audit cause: ${name}`);
    if (resolved.has(name)) return resolved.get(name);
    const entry = report.vulnerabilities[name];
    const next = new Set([...visiting, name]);
    let approved = true;
    for (const cause of entry.via) {
      if (typeof cause === "string") {
        const childApproved = causes(cause, next);
        approved = childApproved && approved;
      } else {
        requireValid(object(cause) && Number.isSafeInteger(cause.source) && cause.source > 0 &&
          typeof cause.name === "string" && typeof cause.dependency === "string" &&
          typeof cause.url === "string" && levels.includes(cause.severity) &&
          typeof cause.range === "string", `Invalid advisory: ${name}`);
        approved = (cause.url === approvedURL && cause.name === "picomatch" &&
          cause.dependency === "picomatch") && approved;
      }
    }
    const devOnly = entry.nodes.every(node => lock.packages[node].dev === true &&
      lock.packages[node].devOptional !== true && lock.packages[node].link !== true);
    resolved.set(name, approved && devOnly);
    return resolved.get(name);
  }
  for (const [name] of entries) causes(name);
  const unapproved = blocking.filter(([name]) => !resolved.get(name));
  requireValid(!unapproved.length, `Unapproved moderate-or-higher findings: ${unapproved.map(([name]) => name).join(", ")}`);
  if (!blocking.length) return ["Audit exception not needed; remove it when the patched dependency tree is verified."];
  requireValid(now instanceof Date && Number.isFinite(now.getTime()) && now < new Date(expires),
    `Audit exception expired at ${expires}; update dependencies and remove the exception`);
  return [`ACCEPTED RISK: ${approvedURL}; dev-only lockfile nodes: ${
    blocking.flatMap(([, entry]) => entry.nodes).join(", ")
  }; expires ${expires}. Full audit findings remain visible; development/CI ReDoS risk is not eliminated.`];
}

function capture() {
  const result = spawnSync("npm", [
    "audit", "--json", "--audit-level=moderate", "--registry=https://registry.npmjs.org",
  ], { encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  // Always show the unfiltered report, including malformed/error responses.
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  requireValid(!result.error && !result.signal && [0, 1].includes(result.status),
    `npm audit subprocess failed: ${result.error?.message ?? result.signal ?? result.status}`);
  const report = JSON.parse(result.stdout);
  requireValid(object(report) && !Object.hasOwn(report, "error") &&
    report.auditReportVersion === 2 && object(report.vulnerabilities), "Invalid npm audit response");
  return { report, status: result.status };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [mode, file, ...extra] = process.argv.slice(2);
    requireValid(!extra.length && (
      (!mode && !file) || (["capture", "check"].includes(mode) && file)
    ), "Usage: node scripts/audit.mjs [capture|check report-file]");
    const result = mode === "check" ? JSON.parse(readFileSync(file, "utf8")) : capture();
    if (mode === "capture") {
      writeFileSync(file, JSON.stringify(result));
    } else {
      const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
      for (const message of evaluateAudit(result.report, lock, result.status)) console.log(message);
    }
  } catch (error) {
    console.error(`Audit policy FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
