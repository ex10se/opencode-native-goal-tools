import type { Plugin } from "@opencode/plugin";
import type { Session } from "@opencode/schema/session";
import { createGoalTools, type Goal } from "./goal.js";

// JSON Schema keeps the installed package free of runtime SDK dependencies.
// Contract: @opencode/schema/goal at OpenCode v2.3.0.
const nativeGoal = {
  id: "opencode.goal",
  methods: {
    get: {
      input: {
        type: "object" as const,
        properties: { sessionID: { type: "string" as const } },
        required: ["sessionID"],
        additionalProperties: false,
      },
      output: {},
    },
  },
  events: {},
};

function readGoal(value: unknown): Goal | null {
  if (value === null) return null;
  if (typeof value !== "object" || value === null ||
      !("id" in value) || typeof value.id !== "string" ||
      !("objective" in value) || typeof value.objective !== "string" ||
      !("status" in value) || !["active", "paused", "complete"].includes(String(value.status))) {
    throw new Error("Unsupported native Goal RPC response.");
  }
  return value as Goal;
}

export default {
  id: "local.native-goal-tools",
  async setup(ctx) {
    const rpc = ctx.rpc(nativeGoal);
    const tools = createGoalTools({
      async get(sessionID) { return readGoal(await rpc.get({ sessionID })); },
      async create(sessionID, objective) {
        await ctx.session.command({
          sessionID: sessionID as Session.ID,
          name: "goal",
          text: objective,
          delivery: "queue",
        });
      },
    });
    await ctx.tool.transform((editor) => {
      for (const name of ["get_goal", "create_goal", "replace_goal"]) {
        if (editor.get(name)) throw new Error(`Cannot register ${name}: another plugin already owns this tool.`);
      }
      editor.add({
        name: "get_goal",
        description: "Read this session's native OpenCode Goal. Returns null when none exists.",
        input: { type: "object", properties: {}, additionalProperties: false },
        options: { codemode: false },
        async execute(_input, context) {
          return { content: JSON.stringify(await tools.get(context.sessionID)) };
        },
      });
      editor.add({
        name: "create_goal",
        description: "Create this session's native OpenCode Goal only when the user explicitly requests it. Read get_goal first. Never replaces an existing goal or resumes a paused goal. Unavailable in Plan. Returns verified native state; do not retry errors automatically.",
        input: {
          type: "object",
          properties: { objective: { type: "string", minLength: 1, description: "Complete objective and acceptance criteria; native limit is 4000 UTF-16 units." } },
          required: ["objective"],
          additionalProperties: false,
        },
        options: { codemode: false },
        async execute(input, context) {
          if (context.agent.toLowerCase() === "plan") throw new Error("Goal creation is unavailable in Plan mode.");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "goal",
            resources: ["create"],
          });
          const { objective } = input as { objective: string };
          return { content: JSON.stringify(await tools.create(context.sessionID, context.agent, objective)) };
        },
      });
      editor.add({
        name: "replace_goal",
        description: "Replace this session's native OpenCode Goal only when the user explicitly asks to correct, change, or replace it. Read get_goal first and pass its exact id as expected_goal_id. Replaces active, paused, or completed goals with a new active goal and a new ID; this is not an in-place edit. Unavailable in Plan. Never retry automatically after an error.",
        input: {
          type: "object",
          properties: {
            objective: { type: "string", minLength: 1, description: "The complete corrected objective; native limit is 4000 UTF-16 units." },
            expected_goal_id: { type: "string", minLength: 1, description: "Exact id returned by the most recent get_goal call." },
          },
          required: ["objective", "expected_goal_id"],
          additionalProperties: false,
        },
        options: { codemode: false },
        async execute(input, context) {
          if (context.agent.toLowerCase() === "plan") throw new Error("Goal replacement is unavailable in Plan mode.");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "goal",
            resources: ["replace"],
          });
          const { objective, expected_goal_id } = input as { objective: string; expected_goal_id: string };
          return { content: JSON.stringify(await tools.replace(context.sessionID, context.agent, expected_goal_id, objective)) };
        },
      });
    });
  },
} satisfies Plugin.Plugin;
