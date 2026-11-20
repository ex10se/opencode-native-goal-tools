export type Goal = {
  id: string;
  objective: string;
  status: "active" | "paused" | "complete";
  reason?: string;
};

export interface GoalPort {
  get(sessionID: string): Promise<Goal | null>;
  create(sessionID: string, objective: string): Promise<void>;
}

export function createGoalTools(port: GoalPort) {
  const pending = new Map<string, Promise<unknown>>();

  async function write(sessionID: string, input: string, expectedID?: string): Promise<Goal> {
    if (expectedID !== undefined && !expectedID.trim()) throw new Error("A nonempty expected goal ID is required.");
    const objective = normalize(input);
    const previous = await port.get(sessionID);
    if (expectedID !== undefined) {
      if (!previous) throw new Error("No existing goal to replace. Read get_goal and use create_goal instead.");
      if (previous.id !== expectedID) throw new Error("The existing goal changed. Read get_goal again before requesting replacement.");
    } else if (previous) {
      if (previous.status === "active" && previous.objective === objective) return previous;
      throw new Error(`An existing goal (${previous.id}, ${previous.status}) must be managed with /goal first.`);
    }
    try {
      // Pass the original trimmed text: the native command removes one pair of quotes itself.
      await port.create(sessionID, input.trim());
    } catch (error) {
      let observed: unknown;
      try { observed = await port.get(sessionID); }
      catch { observed = "unavailable"; }
      throw new Error(`Native goal command failed: ${String(error)}. Observed state: ${JSON.stringify(observed)}. Do not retry automatically.`);
    }
    const saved = await port.get(sessionID);
    if (!saved || saved.objective !== objective || saved.status !== "active" ||
        (expectedID !== undefined && saved.id === expectedID)) {
      throw new Error(`Could not verify the created native goal. Observed state: ${JSON.stringify(saved)}.`);
    }
    return saved;
  }

  async function serialized(sessionID: string, action: () => Promise<Goal>): Promise<Goal> {
      const previous = pending.get(sessionID) ?? Promise.resolve();
      const current = previous.catch(() => {}).then(action);
      pending.set(sessionID, current);
      try { return await current; }
      finally { if (pending.get(sessionID) === current) pending.delete(sessionID); }
  }

  return {
    get: (sessionID: string) => port.get(sessionID),
    create: (sessionID: string, _agent: string, objective: string) =>
      serialized(sessionID, () => write(sessionID, objective)),
    replace: (sessionID: string, _agent: string, expectedID: string, objective: string) =>
      serialized(sessionID, () => write(sessionID, objective, expectedID)),
  };
}

function normalize(input: string): string {
  if (typeof input !== "string") throw new Error("The objective must be a string.");
  let text = input.trim();
  const quoted = /^(["'“‘])([\s\S]*)(["'”’])$/.exec(text);
  const pairs: Record<string, string> = { '"': '"', "'": "'", "“": "”", "‘": "’" };
  if (quoted && pairs[quoted[1]!] === quoted[3]) text = quoted[2]!.trim();
  if (!text || text.length > 4000 || /^(pause|resume|clear)$/i.test(text)) {
    throw new Error("The objective must contain 1-4000 UTF-16 units and must not be a /goal control word.");
  }
  return text;
}
