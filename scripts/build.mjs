import { execFileSync } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { transformAsync } from "@babel/core";
import solid from "babel-preset-solid";

execFileSync("tsc", [], { stdio: "inherit" });
const { code } = await transformAsync(await readFile("dist/tui.jsx", "utf8"), {
  filename: "dist/tui.jsx",
  configFile: false,
  babelrc: false,
  presets: [[solid, { generate: "universal", moduleName: "@opentui/solid" }]],
});
await writeFile("dist/tui.js", code + "\n");
await rm("dist/tui.jsx");
