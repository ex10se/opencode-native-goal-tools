import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = await mkdtemp(join(tmpdir(), "native-goal-smoke-"));
const project = join(root, "project");
await mkdir(project);
await mkdir(join(root, "config/opencode"), { recursive: true });
let calls = 0;
let toolResults = [];
let requestedTools = [];
let finishGoal = false;
const objective = "Verify native Goal tools inside an active execution";
let actions = [
  { name: "create_goal", args: { objective } },
  { name: "get_goal", args: {} },
  { name: "create_goal", args: { objective } },
];
const model = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls++;
    const messages = body.messages ?? [];
    const isJudge = messages.some(m => JSON.stringify(m.content).includes("You are now the reviewer for the session"));
    const results = messages.filter(m => m.role === "tool");
    toolResults.push(...results);
    const available = (body.tools ?? []).map(t => t.function.name);
    const marker = messages.some(m => JSON.stringify(m.content).includes("SMOKE_CREATE"));
    const action = !isJudge && marker ? actions.shift() : undefined;
    const tool = action?.name;
    if (tool) {
      assert(available.includes(tool), `Missing ${tool}; available=${available}`);
      requestedTools.push(tool);
    }
    const message = tool
      ? { role: "assistant", tool_calls: [{ index: 0, id: `call_${calls}`, type: "function", function: { name: tool, arguments: JSON.stringify(action.args) } }] }
      : { role: "assistant", content: isJudge
          ? JSON.stringify({ verdict: finishGoal ? "done" : "paused", reason: "Deterministic fixture observed the tool result." })
          : "Fixture verified the native Goal tool response." };
    const finish = tool ? "tool_calls" : "stop";
    const base = { id: `chatcmpl_${calls}`, created: Math.floor(Date.now() / 1000), model: "fixture" };
    const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
    if (body.stream) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const item of [
        { ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: message, finish_reason: null }] },
        { ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: finish }], usage },
      ]) res.write(`data: ${JSON.stringify(item)}\n\n`);
      res.end("data: [DONE]\n\n");
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ...base, object: "chat.completion", choices: [{ index: 0, message, finish_reason: finish }], usage }));
    }
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});
await new Promise(resolve => model.listen(0, "127.0.0.1", resolve));
const password = randomUUID();
const env = {
  PATH: process.env.PATH,
  HOME: join(root, "home"),
  XDG_CONFIG_HOME: join(root, "config"),
  XDG_DATA_HOME: join(root, "data"),
  XDG_STATE_HOME: join(root, "state"),
  XDG_CACHE_HOME: join(root, "cache"),
  OPENCODE_DB: join(root, "opencode.db"),
  OPENCODE_CONFIG: join(root, "config/opencode/opencode.json"),
  OPENCODE_CONFIG_DIR: join(root, "config/opencode"),
  OPENCODE_PASSWORD: password,
};
await writeFile(join(root, "config/opencode/opencode.json"), JSON.stringify({
  plugins: [resolve(process.argv[3] ?? ".")],
  model: "fixture/fixture",
  snapshots: false,
  permissions: [{ action: "*", resource: "*", effect: "allow" }],
  providers: {
    fixture: {
      package: "@opencode/ai/providers/openai-compatible",
      settings: { baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: "local-fixture" },
      models: { fixture: { name: "Local fixture", limit: { context: 100000, output: 1000 } } },
    },
  },
}));
const binary = process.argv[2] ?? "opencode";
const child = spawn(binary, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
  cwd: project, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32",
});
let output = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
let spawnError;
child.on("error", error => { spawnError = error; });
async function until(check, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}; model calls=${calls}; logs=${root}`);
}
try {
  await until(() => /http:\/\/127\.0\.0\.1:\d+/.test(output), "server ready");
  const base = output.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  async function api(path, data) {
    const response = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    assert(response.ok, `${path}: ${response.status}: ${text}`);
    return text ? JSON.parse(text) : undefined;
  }
  const info = await api("/api/info");
  assert.equal(info.version, "2.3.0");
  const location = `?location%5Bdirectory%5D=${encodeURIComponent(project)}`;
  await api("/api/command" + location);
  await until(async () => {
    const plugins = await api("/api/plugin" + location);
    const plugin = plugins.data.find(p => p.id === "local.native-goal-tools");
    if (plugin?.state.status === "error") throw new Error(JSON.stringify(plugin));
    return plugin?.state.status === "active";
  }, "plugin active");
  const created = await api("/api/session", {
    location: { directory: project }, title: "Native Goal smoke",
    model: { providerID: "fixture", id: "fixture" }, agent: "build",
  });
  const id = created.data.id;
  const goal = async (sessionID = id) => {
    const result = await api("/api/rpc/opencode.goal/get" + location, { input: { sessionID } });
    return result.output;
  };
  assert.equal(await goal(), null);
  await api(`/api/session/${id}/prompt`, { text: "SMOKE_CREATE: explicitly create the fixture objective, then read it." });
  let saved;
  await until(async () => {
    saved = await goal();
    return saved?.status === "paused";
  }, "tools returned and native reviewer paused");
  assert.equal(saved.objective, objective);
  assert(requestedTools.includes("create_goal"));
  assert(requestedTools.includes("get_goal"));
  assert(toolResults.some(m => JSON.stringify(m.content).includes(saved.id)), "No native goal state in tool output");
  const ids = toolResults.flatMap(m => {
    try {
      const raw = typeof m.content === "string" ? m.content : m.content.map(p => p.text ?? "").join("");
      const value = JSON.parse(raw);
      return value.id ? [value.id] : [];
    } catch { return []; }
  });
  assert(ids.length >= 3, "Expected create, get and idempotent create results");
  assert.deepEqual([...new Set(ids)], [saved.id], "Duplicate create replaced the goal");
  finishGoal = true;
  await api(`/api/session/${id}/command`, { name: "goal", text: "resume" });
  await until(async () => (await goal())?.status === "complete", "native completion");
  assert.equal((await goal()).id, saved.id);
  actions = [{ name: "create_goal", args: { objective: "Different objective" } }];
  toolResults = [];
  await api(`/api/session/${id}/prompt`, { text: "SMOKE_CREATE: attempt replacement to verify refusal." });
  await until(() => toolResults.some(m => JSON.stringify(m.content).includes("existing goal")), "replacement rejected");
  assert.equal((await goal()).id, saved.id);
  const correctedObjective = "Finish the remaining work after the completed goal";
  actions = [{ name: "replace_goal", args: { objective: correctedObjective, expected_goal_id: saved.id } }];
  toolResults = [];
  await api(`/api/session/${id}/prompt`, { text: "SMOKE_CREATE: explicitly replace the completed goal with the corrected objective." });
  let corrected;
  await until(async () => {
    corrected = await goal();
    return corrected?.objective === correctedObjective && corrected.status === "complete";
  }, "completed goal explicitly replaced and completed");
  assert.notEqual(corrected.id, saved.id);
  assert(toolResults.some(m => JSON.stringify(m.content).includes(corrected.id)), "Replacement did not return the new native state");
  actions = [{ name: "replace_goal", args: { objective: "Stale correction", expected_goal_id: saved.id } }];
  toolResults = [];
  await api(`/api/session/${id}/prompt`, { text: "SMOKE_CREATE: verify stale replacement refusal." });
  await until(() => toolResults.some(m => JSON.stringify(m.content).includes("goal changed")), "stale replacement rejected");
  assert.equal((await goal()).id, corrected.id);
  const plan = await api("/api/session", {
    location: { directory: project }, title: "Plan refusal smoke",
    model: { providerID: "fixture", id: "fixture" }, agent: "plan",
  });
  actions = [
    { name: "create_goal", args: { objective } },
    { name: "replace_goal", args: { objective, expected_goal_id: corrected.id } },
  ];
  toolResults = [];
  await api(`/api/session/${plan.data.id}/prompt`, { text: "SMOKE_CREATE: verify Plan refusal." });
  await until(() => toolResults.some(m => JSON.stringify(m.content).includes("Plan mode")), "Plan rejected");
  await until(() => toolResults.some(m => JSON.stringify(m.content).includes("Goal replacement is unavailable in Plan mode")), "Plan replacement rejected");
  assert.equal(await goal(plan.data.id), null);
  await api(`/api/session/${id}/command`, { name: "goal", text: "clear" });
  assert.equal(await goal(), null);
  console.log(JSON.stringify({ result: "PASS", version: info.version, tools: requestedTools, nativeLifecycle: ["paused", "complete", "cleared"], duplicate: "same id", implicitReplacement: "rejected", explicitReplacement: "new native id", staleReplacement: "rejected", plan: "create and replace rejected", calls, artifacts: root }));
} finally {
  await writeFile(join(root, "server.log"), output);
  if (child.pid) {
    try { process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM"); }
    catch (error) { if (error.code !== "ESRCH") throw error; }
  }
  model.closeAllConnections();
  await new Promise(resolve => model.close(resolve));
}
