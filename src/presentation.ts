export function goalOperationLabel(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const request = input as {
    action?: unknown;
    metadata?: Record<string, unknown>;
    source?: { type?: unknown };
    resources?: unknown[];
  };
  if (request.action !== "goal" ||
      request.metadata?.["local.native-goal-tools"] !== true ||
      request.source?.type !== "tool" ||
      !Array.isArray(request.resources) || request.resources.length !== 1) return "";
  const operation = request.resources[0];
  return operation === "create" || operation === "replace" || operation === "resume"
    ? `Goal operation: ${operation}` : "";
}
