# Configuration and behavior

## Load the server plugin

Build a source checkout:

```sh
npm ci --ignore-scripts
npm run build
```

Add the directory to the existing `plugins` array in `opencode.json` or `opencode.jsonc`:

```json
{
  "plugins": ["/absolute/path/to/opencode-native-goal-tools"]
}
```

Use a directory, not `dist/index.js`. Preserve other entries and keep the built-in `opencode.goal` enabled. The bundled `./tui` entry loads automatically; no separate `cli.json` entry is required.

The TUI adds `Goal operation: create` or `Goal operation: replace` beside the pending native permission form. It reads only the current session's first pending request and labels only this plugin's Goal requests. It never replies to requests or changes their permission decision. The server also preserves existing permission messages and appends `Operation: create` or `Operation: replace` for clients that display the message.

The plugin has no custom configuration options. Watched configuration changes reload automatically; `/reload` can force a configuration reload.

## Tool contract

| Tool | Input | Output |
| --- | --- | --- |
| `get_goal` | `{}` | Native Goal state or `null` |
| `create_goal` | `{ "objective": "..." }` | Native state verified after creation, or the matching existing active goal |
| `replace_goal` | `{ "objective": "...", "expected_goal_id": "..." }` | Verified replacement state with a new native ID |

The output is JSON text in the tool result. All tools are bound to the caller's session. The model cannot supply a different session ID.

The creation tool is intended for an explicit user request. Read the existing goal first. The tool also performs its own existence check.

### Objective validation

- A nonempty string after trimming whitespace and removing one matching pair of outer quotes
- At most 4000 UTF-16 code units after normalization
- Not a bare control word: `pause`, `resume`, or `clear`, case-insensitively, including quoted forms

Objectives are never truncated.

### Existing goals

| Current state | Creation behavior |
| --- | --- |
| No goal | Create and verify |
| Active, same normalized objective | Return the existing state |
| Active, different objective | Reject |
| Paused or complete | Reject, even if the objective matches |

Use the native `/goal pause`, `/goal resume`, and `/goal clear` commands to manage an existing goal. The native reviewer determines completion.

### Explicit corrections

When the user explicitly asks to correct, change, or replace a goal, read `get_goal` and call `replace_goal` with that exact ID as `expected_goal_id` and the full corrected objective. The goal may be active, paused, or complete.

Replacement creates a new active native goal with a new ID. It does not edit the old record in place. An absent goal or a changed ID is an error; inspect the current state rather than retry automatically. `create_goal` retains its no-replacement behavior.

### Permissions and Plan

Mutations check action `goal`, resource `create` or `replace`, using the current agent's permissions. To prohibit both explicitly:

```json
{
  "permissions": [
    { "action": "goal", "resource": "*", "effect": "deny" }
  ]
}
```

Merge the rule into existing permissions rather than replacing unrelated rules.

The plugin does not reject mutations based on an agent's name. Plan and other agents use the same permission checks and explicit-request safeguards. To disallow goal mutations for a planning agent, deny `goal` in its host permission rules. Goal management does not authorize project implementation or override host restrictions. Reading does not activate a goal.

### Errors and concurrency

Mutation calls are serialized per session within the plugin instance. This does not make them atomic against other clients or manual `/goal` commands. Avoid changing a goal manually while a mutation call is in flight.

The native command can persist a goal before a kickoff failure. On error, inspect the reported state and call `get_goal`; do not automatically repeat creation.

## Disable

Remove only this package's entry from `plugins` and reload configuration. The native Goal and its state remain owned by OpenCode; disabling this adapter does not clear or pause an existing goal
