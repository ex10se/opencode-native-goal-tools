import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

// Compile only the adapter in memory; do not update an installed dist directory.
const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("./goal.js", new URL("../src/goal.ts", import.meta.url).href);
const { default: plugin } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

async function fixture(agent, initial = null, denied = false) {
  let state = initial;
  let writes = 0;
  let reads = 0;
  const permissions = [];
  const tools = new Map();
  let evaluate;
  await plugin.setup({
    rpc: () => ({ get: async () => { reads++; return state; } }),
    session: { command: async ({ text }) => {
      writes++;
      state = text === "resume"
        ? { ...state, status: "active" }
        : { id: `new-${writes}`, objective: text, status: "active" };
    } },
    permission: { hook: async (name, callback) => {
      assert.equal(name, "evaluate");
      evaluate = callback;
    }, assert: async (request) => {
      permissions.push(request);
      if (denied) throw new Error("Host permission denied");
    } },
    tool: { transform: async (callback) => callback({
      get: (name) => tools.get(name),
      add: (tool) => tools.set(tool.name, tool),
    }) },
  });
  return {
    state: () => state, writes: () => writes, reads: () => reads, permissions,
    evaluate: async (event) => { if (evaluate) await evaluate(event); },
    call: async (name, args) => JSON.parse((await tools.get(name).execute(args, {
      sessionID: "session", agent, messageID: "message", id: "call",
    })).content),
  };
}

for (const agent of ["build", "plan", "Plan"]) {
  test(`${agent}: adapter creates and reads verified state with host permission`, async () => {
    const f = await fixture(agent);
    const created = await f.call("create_goal", { objective: "Ship" });
    assert.deepEqual(created, { id: "new-1", objective: "Ship", status: "active" });
    assert.deepEqual(await f.call("get_goal", {}), created);
    assert.deepEqual(f.permissions[0], {
      sessionID: "session", agent, source: { type: "tool", messageID: "message", id: "call" },
      action: "goal", resources: ["create"],
      metadata: { "local.native-goal-tools": true },
    });
    await assert.rejects(f.call("create_goal", { objective: "Other" }), /existing goal/);
    assert.equal(f.writes(), 1);
  });
  for (const status of ["active", "paused", "complete"]) {
    test(`${agent}: adapter replaces ${status} with expected ID and host permission`, async () => {
      const f = await fixture(agent, { id: "old", objective: "Old", status });
      const result = await f.call("replace_goal", { objective: "New", expected_goal_id: "old" });
      assert.deepEqual(result, { id: "new-1", objective: "New", status: "active" });
      assert.equal(f.permissions[0].agent, agent);
      assert.equal(f.permissions[0].action, "goal");
      assert.deepEqual(f.permissions[0].resources, ["replace"]);
      await assert.rejects(f.call("replace_goal", { objective: "Stale", expected_goal_id: "old" }), /changed/);
      assert.equal(f.writes(), 1);
      assert.deepEqual(f.state(), result);
    });
  }
  test(`${agent}: resume preserves identity, is idempotent and refuses stale IDs`, async () => {
    const f = await fixture(agent, { id: "old", objective: "Keep", status: "paused" });
    const result = await f.call("resume_goal", { expected_goal_id: "old" });
    assert.deepEqual(result, { id: "old", objective: "Keep", status: "active" });
    assert.deepEqual(await f.call("resume_goal", { expected_goal_id: "old" }), result);
    assert.equal(f.writes(), 1);
    assert.equal(f.permissions[0].agent, agent);
    assert.deepEqual(f.permissions[0].resources, ["resume"]);
    await assert.rejects(f.call("resume_goal", { expected_goal_id: "stale" }), /changed/);
    assert.equal(f.writes(), 1);
    assert.deepEqual(f.state(), result);
  });
  for (const name of ["create_goal", "replace_goal", "resume_goal"]) {
    test(`${agent}: host denial blocks ${name} before native access`, async () => {
      const f = await fixture(agent, null, true);
      await assert.rejects(f.call(name, { objective: "New", expected_goal_id: "old" }), /Host permission denied/);
      assert.equal(f.reads(), 0);
      assert.equal(f.writes(), 0);
      assert.equal(f.state(), null);
    });
  }
}

for (const operation of ["create", "replace", "resume"]) {
  test(`${operation}: owned ask preserves reason and adds operation once`, async () => {
    const f = await fixture("build", operation === "create" ? null : { id: "old", objective: "Old", status: "paused" });
    await f.call(`${operation}_goal`, { objective: "New", expected_goal_id: "old" });
    const event = { ...f.permissions[0], effect: "ask", message: "Manual approval required" };
    const before = structuredClone(event);
    await f.evaluate(event);
    await f.evaluate(event);
    assert.deepEqual(event, { ...before, message: `Manual approval required\nOperation: ${operation}` });
    const empty = { ...before, message: undefined };
    await f.evaluate(empty);
    assert.equal(empty.message, `Operation: ${operation}`);
  });
}

test("foreign and malformed evaluations remain unchanged", async () => {
  const f = await fixture("build");
  const owned = { action: "goal", resources: ["create"], source: { type: "tool", messageID: "message", id: "call" }, metadata: { "local.native-goal-tools": true }, effect: "ask" };
  for (const change of [
    { metadata: undefined }, { metadata: {} }, { metadata: { "local.native-goal-tools": "true" } },
    { source: undefined }, { source: { type: "other" } }, { action: "shell" },
    { resources: [] }, { resources: ["create", "replace"] }, { resources: ["unknown"] },
    { effect: "allow" }, { effect: "deny" },
  ]) {
    const event = { ...owned, ...change, message: "Existing reason" };
    const before = structuredClone(event);
    await f.evaluate(event);
    assert.deepEqual(event, before);
  }
});

test("presentation after auto-review handles allow-to-ask escalation", async () => {
  const f = await fixture("build");
  await f.call("create_goal", { objective: "New" });
  const event = { ...f.permissions[0], effect: "allow" };
  await f.evaluate(event);
  assert.equal(event.message, undefined);
  event.effect = "ask";
  event.message = "Auto-review escalation";
  await f.evaluate(event);
  assert.equal(event.message, "Auto-review escalation\nOperation: create");
});

test("installed on-ask ordering preserves labels for escalation and denial", async () => {
  const f = await fixture("build");
  await f.call("create_goal", { objective: "New" });
  // 0.13.3 reviewForApproval returns only allow; on-ask otherwise returns early.
  for (const verdict of ["escalate", "deny", "allow", undefined]) {
    const event = { ...f.permissions[0], effect: "ask" };
    await f.evaluate(event);
    const decision = verdict === "allow" ? { reason: "Approved" } : undefined;
    if (decision !== undefined) {
      event.effect = "allow";
      event.message = decision.reason;
    }
    assert.equal(event.effect, verdict === "allow" ? "allow" : "ask");
    assert.equal(event.message, verdict === "allow" ? "Approved" : "Operation: create");
  }
});
