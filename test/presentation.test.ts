import assert from "node:assert/strict";
import { test } from "node:test";
import { goalOperationLabel } from "../src/presentation.ts";

const request = (operation: string) => ({
  action: "goal", resources: [operation],
  metadata: { "local.native-goal-tools": true },
  source: { type: "tool" },
});

test("labels only the pending owned goal operation", () => {
  assert.equal(goalOperationLabel(request("create")), "Goal operation: create");
  assert.equal(goalOperationLabel(request("replace")), "Goal operation: replace");
  assert.equal(goalOperationLabel(request("resume")), "Goal operation: resume");
});

test("clears the label when no request is pending and ignores foreign requests", () => {
  for (const input of [
    undefined, null, {}, request("clear"),
    { ...request("create"), action: "shell" },
    { ...request("create"), metadata: {} },
    { ...request("create"), source: { type: "command" } },
    { ...request("create"), resources: ["create", "replace"] },
  ]) assert.equal(goalOperationLabel(input), "");
});
