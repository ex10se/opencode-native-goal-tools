# Native Goal adapter design

## Purpose

Expose OpenCode's existing session Goal to the model through `get_goal`, `create_goal`, and `replace_goal`. OpenCode owns the state, UI indicator, reviewer, and continuation loop. The adapter has no goal store, background scheduler, or replacement `/goal` command.

The implementation targets the latest stable OpenCode public plugin and session APIs. SDK versions are pinned in the lockfile and refreshed before release verification.

## Components

| Module | Responsibility |
| --- | --- |
| `src/index.ts` | Register tools, check permissions, validate RPC results, and connect to OpenCode |
| `src/goal.ts` | Validate objectives, serialize creation, protect existing goals, and verify results |
| `src/tui.tsx`, `src/presentation.ts` | Label the current session's pending Goal permission beside the native form without replying to it |
| `test/goal.test.ts` | Exercise policy and failure paths through a narrow native-state port |
| `test/plugin.test.mjs` | Exercise adapter permissions and state safeguards in Build and Plan |
| `test/smoke.mjs` | Exercise real tools and native lifecycle in a private OpenCode server |
| `test/package.mjs` | Verify the archive and run the lifecycle check through its public export |

SDK imports are type-only. The read RPC contract uses JSON Schema so the compiled package has no runtime SDK dependency. OpenCode supplies the plugin context.

## Creation flow

1. Use the tool context's session ID and agent ID
2. Assert the `goal` / `create` permission for the current agent, including `plan`
3. Serialize creation calls for the same session within this plugin instance
4. Normalize and validate the objective using the native command's quote and whitespace rules
5. Read `opencode.goal.get`; return a matching active goal, or reject any other existing goal
6. Execute `session.command` with `name: "goal"` and `delivery: "queue"`
7. Read native state again and verify that the objective matches and the goal is active

The original trimmed text is passed to the command, which removes one matching pair of outer quotes itself. The adapter uses the normalized text for validation and comparison, avoiding double normalization.

Creation does not wait for the session to finish. The native command persists the goal and queues its kickoff, allowing a tool invoked during an active execution to return.

## Explicit replacement

For explicit corrections, `replace_goal` follows the same mutation path but checks that the current ID matches `expected_goal_id` rather than requiring absence. Active, paused, and completed goals may be replaced. The returned state must have a new ID. This is native replacement, not an in-place objective update.

Creation and replacement share the same per-session serialization queue. Replacement checks permission resource `replace`. Both mutations are available in Plan subject to host permissions, without granting permission to implement project changes.

## Failure handling

An unavailable RPC fails before creation. If the command fails after a possible write, the adapter attempts to read the state and includes it in the error. It never retries automatically.

A mismatched or missing post-command state is a verification failure, not success. A paused goal is never resumed by `create_goal`; a completed goal is replaced only through explicit `replace_goal`.

Same-session serialization only coordinates this plugin instance's calls. The native API has no compare-and-set write operation, so another client or a manual command can change the goal between the initial read and write. Post-write checks do not eliminate that race.

Tool-name conflicts are rejected instead of overwriting another plugin's tools.

## Native contract sources

- [Goal implementation](https://github.com/anomalyco/opencode/blob/v2.3.0/packages/core/src/plugin/goal.ts)
- [Goal RPC schema](https://github.com/anomalyco/opencode/blob/v2.3.0/packages/schema/src/goal.ts)
- [Execution wake behavior](https://github.com/anomalyco/opencode/blob/v2.3.0/packages/core/src/session/run-coordinator.ts)
- [Server plugin API](https://opencode.ai/docs/build/plugins/server)

See [Verification](verification.md) for what is exercised against the real host
