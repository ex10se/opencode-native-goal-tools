import assert from "node:assert/strict";

export function activeResult(messages, callID, expected) {
  assert(callID, "Expected generated tool call ID");
  const states = messages.filter(message => message.tool_call_id === callID).flatMap(message => {
    try {
      const raw = typeof message.content === "string" ? message.content : message.content.map(p => p.text ?? "").join("");
      return [JSON.parse(raw)];
    } catch { return []; }
  });
  const state = states.find(value => value.id === expected.id && value.status === "active");
  assert(state, "Expected successful active tool result");
  assert.equal(state.objective, expected.objective);
  return state;
}
