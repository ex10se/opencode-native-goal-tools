import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = await mkdtemp(join(tmpdir(), "native-goal-package-"));
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", root], { encoding: "utf8" }));
const files = packed[0].files.map(f => f.path);
assert(files.includes("dist/index.js"));
assert(files.includes("dist/index.d.ts"));
assert(files.includes("dist/goal.js"));
assert(files.includes("dist/tui.jsx"));
assert(files.includes("dist/presentation.js"));
assert(!files.some(f => /^(src|test|node_modules|\.smoke)\//.test(f)), "Unexpected development files");
execFileSync("tar", ["-xzf", join(root, packed[0].filename), "-C", root]);
const directory = join(root, "package");
const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
assert.equal(manifest.name, "opencode-native-goal-tools");
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
assert.equal(Object.keys(manifest.optionalDependencies ?? {}).length, 0);
assert.equal(manifest.exports["./tui"].import, "./dist/tui.jsx");
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
console.log(JSON.stringify({ package: packed[0].filename, files: files.length, runtimeDependencies: 0, result: "PASS" }));
