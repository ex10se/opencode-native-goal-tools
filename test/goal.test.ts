import assert from "node:assert/strict";
import { test } from "node:test";
import { createGoalTools, type Goal, type GoalPort } from "../src/goal.ts";

function fixture(initial: Goal | null = null) {
  let state = initial;
  let writes = 0;
  const port: GoalPort = {
    async get() { return state; },
    async create(_id, objective) {
      writes++;
      // Model the native command boundary for this fixture's ASCII-quoted input.
      if (objective.startsWith('"') && objective.endsWith('"')) objective = objective.slice(1, -1).trim();
      state = { id: `goal-${writes}`, objective, status: "active" };
    },
  };
  return { port, tools: createGoalTools(port), state: () => state, writes: () => writes };
}

test("reads native state without writing", async () => {
  const f = fixture({ id: "existing", objective: "Ship", status: "paused" });
  assert.deepEqual(await f.tools.get("session"), f.state());
  assert.equal(f.writes(), 0);
});

test("creates and verifies a native goal, normalizing whitespace and quotes", async () => {
  const f = fixture();
  const goal = await f.tools.create("session", "build", '  "Ship tests"  ');
  assert.deepEqual(goal, { id: "goal-1", objective: "Ship tests", status: "active" });
  assert.equal(f.writes(), 1);
});

test("concurrent duplicate requests create only one goal", async () => {
  const f = fixture();
  const [a, b] = await Promise.all([
    f.tools.create("session", "build", "Ship"),
    f.tools.create("session", "build", "Ship"),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(f.writes(), 1);
});

for (const status of ["active", "paused", "complete"] as const) {
  test(`preserves an existing ${status} goal`, async () => {
    const initial = { id: "existing", objective: "Old", status };
    const f = fixture(initial);
    await assert.rejects(f.tools.create("session", "build", "New"), /existing goal/i);
    assert.deepEqual(f.state(), initial);
    assert.equal(f.writes(), 0);
  });
}

test("does not resume a matching paused goal", async () => {
  const f = fixture({ id: "existing", objective: "Ship", status: "paused" });
  await assert.rejects(f.tools.create("session", "build", "Ship"), /existing goal/i);
  assert.equal(f.writes(), 0);
});

for (const objective of ["", "   ", "pause", '"resume"', "‘clear’", "x".repeat(4001)]) {
  test(`rejects invalid objective ${objective.slice(0, 16)}`, async () => {
    const f = fixture();
    await assert.rejects(f.tools.create("session", "build", objective), /objective/i);
    assert.equal(f.writes(), 0);
  });
}

test("rejects Plan before accessing the native API", async () => {
  const tools = createGoalTools({
    async get() { assert.fail("Plan must not read during create"); },
    async create() { assert.fail("Plan must not write"); },
  });
  await assert.rejects(tools.create("session", "Plan", "Ship"), /plan/i);
});

test("reports a partial command failure with persisted state and does not retry", async () => {
  const f = fixture();
  const write = f.port.create;
  f.port.create = async (...args) => { await write(...args); throw new Error("kickoff failed"); };
  await assert.rejects(f.tools.create("session", "build", "Ship"), /kickoff failed.*goal-1/s);
  assert.equal(f.writes(), 1);
});

test("detects a different state after the native command", async () => {
  const f = fixture();
  f.port.create = async () => {};
  await assert.rejects(f.tools.create("session", "build", "Ship"), /verify/i);
});

test("does not write when native RPC is unavailable", async () => {
  const f = fixture();
  f.port.get = async () => { throw new Error("RPC unavailable"); };
  await assert.rejects(f.tools.create("session", "build", "Ship"), /RPC unavailable/);
  assert.equal(f.writes(), 0);
});

for (const status of ["active", "paused", "complete"] as const) {
  test(`explicitly replaces the expected ${status} goal with a new objective`, async () => {
    const f = fixture({ id: "old-id", objective: "Old", status });
    const result = await f.tools.replace("session", "build", "old-id", "New");
    assert.deepEqual(result, { id: "goal-1", objective: "New", status: "active" });
    assert.equal(f.writes(), 1);
  });
}

test("replacement refuses a stale expected ID without touching the current goal", async () => {
  const initial = { id: "newer-id", objective: "User changed it", status: "active" as const };
  const f = fixture(initial);
  await assert.rejects(f.tools.replace("session", "build", "old-id", "New"), /changed|expected/i);
  assert.deepEqual(f.state(), initial);
  assert.equal(f.writes(), 0);
});

test("replacement requires an existing goal and an explicit expected ID", async () => {
  const f = fixture();
  await assert.rejects(f.tools.replace("session", "build", "missing", "New"), /existing goal/i);
  await assert.rejects(f.tools.replace("session", "build", "", "New"), /expected.*id/i);
  assert.equal(f.writes(), 0);
});

test("replacement refuses Plan without accessing the native API", async () => {
  const tools = createGoalTools({
    async get() { assert.fail("Plan replacement must not read"); },
    async create() { assert.fail("Plan replacement must not write"); },
  });
  await assert.rejects(tools.replace("session", "Plan", "old", "New"), /plan/i);
});

test("two concurrent replacements with the same old ID cannot replace each other", async () => {
  const f = fixture({ id: "old", objective: "Old", status: "complete" });
  const results = await Promise.allSettled([
    f.tools.replace("session", "build", "old", "First"),
    f.tools.replace("session", "build", "old", "Second"),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(f.writes(), 1);
  assert.equal(f.state()?.objective, "First");
});

test("replacement rejects a control word and preserves the goal", async () => {
  const f = fixture({ id: "old", objective: "Old", status: "active" });
  await assert.rejects(f.tools.replace("session", "build", "old", '"clear"'), /objective/i);
  assert.equal(f.writes(), 0);
});

test("replacement reports a saved new state after a kickoff failure, without retry", async () => {
  const f = fixture({ id: "old", objective: "Old", status: "complete" });
  const write = f.port.create;
  f.port.create = async (...args) => { await write(...args); throw new Error("kickoff failed"); };
  await assert.rejects(f.tools.replace("session", "build", "old", "New"), /kickoff failed.*goal-1/s);
  assert.equal(f.writes(), 1);
});
