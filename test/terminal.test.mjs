import assert from "node:assert/strict";
import { test } from "node:test";
import { createScreen } from "./terminal.mjs";

for (const columns of [60, 120]) {
  test(`reconstructs partial operation redraws at ${columns} columns`, async () => {
    const screen = createScreen(columns);
    try {
      await screen.write("\x1b[2J\x1b[1;1HGoal operation: create");
      assert(screen.text().includes("Goal operation: create"));
      await screen.write("\x1b[1;17Hreplace");
      assert(screen.text().includes("Goal operation: replace"));
      assert(!screen.text().includes("Goal operation: create"));
      await screen.write("\x1b[2J\x1b[1;1H");
      assert(!screen.text().includes("Goal operation:"));
    } finally { screen.dispose(); }
  });
}
