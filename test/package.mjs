import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, mkdir, lstat, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = await mkdtemp(join(tmpdir(), "native-goal-package-"));
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", root], { encoding: "utf8" }));
const files = packed[0].files.map(f => f.path);
assert(files.includes("dist/index.js"));
assert(files.includes("dist/index.d.ts"));
assert(files.includes("dist/goal.js"));
assert(files.includes("dist/tui.js"), "TUI must be precompiled JavaScript");
assert(!files.some(f => f.endsWith(".jsx")), "Uncompiled JSX must not ship");
assert(files.includes("dist/presentation.js"));
assert(!files.some(f => /^(src|test|node_modules|\.smoke)\//.test(f)), "Unexpected development files");
const archive = join(root, packed[0].filename);
const consumer = join(root, "consumer");
await mkdir(consumer);
execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", archive], { cwd: consumer, stdio: "inherit" });
const directory = join(consumer, "node_modules", "opencode-native-goal-tools");
assert(!(await lstat(directory)).isSymbolicLink(), "Test a physical npm installation");
assert.deepEqual((await readdir(join(consumer, "node_modules"))).filter(f => !f.startsWith(".")), ["opencode-native-goal-tools"]);
const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
assert.equal(manifest.name, "opencode-native-goal-tools");
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
assert.equal(Object.keys(manifest.optionalDependencies ?? {}).length, 0);
assert.equal(manifest.exports["./tui"].import, "./dist/tui.js");
const tui = await readFile(join(directory, manifest.exports["./tui"].import), "utf8");
assert.doesNotMatch(tui, /<\/?[A-Za-z]|react\/jsx|from ["']react["']/);
execFileSync(process.execPath, ["--check", join(directory, manifest.exports["./tui"].import)]);
const plugin = (await import(pathToFileURL(join(directory, manifest.exports["."].import)))).default;
assert.equal(plugin.id, "local.native-goal-tools");
assert.equal(typeof plugin.setup, "function");
for (const mode of [[], ["--render-permissions"], ["--render-permissions", "--narrow"]]) {
const result = spawnSync(process.execPath, [resolve("test/smoke.mjs"), process.argv[2] ?? "opencode", directory, ...mode], {
  stdio: "inherit", timeout: 120000,
});
if (result.error) throw result.error;
assert.equal(result.status, 0, "Packed package lifecycle smoke failed");
}
console.log(JSON.stringify({ package: archive, sha256: createHash("sha256").update(await readFile(archive)).digest("hex"), directory, files: files.length, runtimeDependencies: 0, result: "PASS" }));
