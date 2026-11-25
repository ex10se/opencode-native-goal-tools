import assert from "node:assert/strict";
import { test } from "node:test";
import { activeResult } from "./smoke-results.mjs";

const active = { id: "native-id", objective: "Keep objective", status: "active" };
const message = (id, content) => ({ role: "tool", tool_call_id: id, content });
test("historical active create cannot hide the actual resume error", () => {
  assert.throws(() => activeResult([
    message("create", JSON.stringify(active)),
    message("resume", "Error: resume failed"),
  ], "resume", active), /successful active tool result/);
});
test("only the expected call can supply a successful active state", () => {
  assert.deepEqual(activeResult([
    message("old", JSON.stringify({ ...active, objective: "Old" })),
    message("resume", [{ type: "text", text: JSON.stringify(active) }]),
  ], "resume", active), active);
});
