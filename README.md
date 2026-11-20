# opencode-native-goal-tools

[Русский](README.ru.md)

Three agent tools for OpenCode's built-in Goal: `get_goal`, `create_goal`, and `replace_goal`.
Goals remain native: the standard indicator, reviewer, continuation loop and `/goal` controls keep working.

## Requirements

- The latest stable OpenCode release
- The built-in `opencode.goal` plugin enabled
- Node.js **22.18.0+** and npm to build from source

The package is available on [npm](https://www.npmjs.com/package/opencode-native-goal-tools).
Published version 0.1.0 has a TUI loading defect when installed under `node_modules` in OpenCode 2.3.2.
Version 0.1.1 fixes the package build. Install from source or a built archive as described below.

## Install from source

Clone [the repository](https://github.com/ex10se/opencode-native-goal-tools) or extract a source archive, then run these commands in its directory:

```sh
npm ci --ignore-scripts
npm run build
```

Add the package directory to your OpenCode configuration:

```jsonc
{
  "plugins": ["/absolute/path/to/opencode-native-goal-tools"]
}
```

Keep existing plugin entries. OpenCode reloads watched configuration changes; use `/reload` if necessary. The bundled `./tui` entry loads automatically with the server plugin.

While a Goal permission request is pending, the TUI shows `Goal operation: create` or `Goal operation: replace` beside the native confirmation form. The native buttons and permission rules are unchanged. The generic form in OpenCode 2.3.2 still says `Tool: goal`; the adjacent label identifies the operation.

## Install from a package archive

Build `opencode-native-goal-tools-0.1.1.tgz` from the current source with `npm pack`. In a separate installation directory, run:

```sh
npm install --ignore-scripts /path/to/opencode-native-goal-tools-0.1.1.tgz
```

Set `plugins` to the absolute installed directory ending in `node_modules/opencode-native-goal-tools`. A GitHub source archive is not a built npm package; use the source instructions for it.

For registry installation, check that the requested version is available, then install it:

```sh
npm view opencode-native-goal-tools@0.1.1 version
npm install --ignore-scripts opencode-native-goal-tools@0.1.1
```

Use the same installed-directory configuration. See [Releasing](docs/releasing.md) for archive verification.

## Use

Ask the agent to create a goal with the full objective and acceptance criteria.
The agent should read `get_goal` first, then call `create_goal` only when you explicitly request creation.

| Tool | Arguments | Result |
| --- | --- | --- |
| `get_goal` | `{}` | Native goal state, or `null` |
| `create_goal` | `{ "objective": "..." }` | Verified native goal state |
| `replace_goal` | `{ "objective": "...", "expected_goal_id": "..." }` | Verified replacement with a new native ID |

All tools are bound to the calling session. Another session cannot be selected through their arguments.

- A matching active goal is returned unchanged
- Any other existing goal is a conflict, including paused and completed goals
- For an explicit correction request, read `get_goal` and pass its ID to `replace_goal`; it replaces active, paused, or completed goals with a new active goal
- Replacement rejects a stale expected ID; it is not an in-place edit or an automatic continuation of a paused goal
- Use native `/goal pause`, `/goal resume` and `/goal clear` for lifecycle control
- Plan can read, create, and explicitly replace goals, subject to host permissions; this does not authorize project implementation
- Mutations check the host permission action `goal`, resource `create` or `replace`
- Owned approval requests add `Operation: create` or `Operation: replace` to the native permission message, retaining any existing reason. This presentation hook does not grant permission. Load this plugin after permission-policy plugins that rewrite messages or escalate to `ask`; later hooks can otherwise overwrite or omit the operation label.
- The native reviewer determines completion; the plugin cannot mark goals complete

## Limits and failure handling

The objective must contain 1-4000 UTF-16 code units after native whitespace/quote normalization. Bare control words (`pause`, `resume`, `clear`) are rejected, including quoted forms.

The plugin serializes its own mutation calls per session. OpenCode 2.3.0 has no atomic conditional-write API: a simultaneous manual `/goal` command can race with either tool's check. Avoid changing goals manually while a mutation tool is running.

A failed command can leave a persisted goal if kickoff fails after storage. Errors report the observed state. Read `get_goal` before deciding what to do; do not automatically retry.

The plugin registers no storage, continuation hooks or replacement `/goal` command. It refuses tool-name collisions instead of overwriting another plugin's goal tools.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run test:smoke -- /path/to/opencode
npm run test:package -- /path/to/opencode
npm pack --dry-run
```

The smoke test checks that its OpenCode executable matches the latest stable release in the public npm registry. It starts a private server and a deterministic loopback model with isolated configuration, home and database. It checks tool calls during active execution, idempotency, implicit replacement refusal, explicit replacement of a completed goal, stale-ID refusal, Plan creation/readback/replacement and native completion in Build. Plan lifecycle state is observed rather than assumed to match Build. It uses no real provider credentials. The test prints its actual host version and diagnostic directory and terminates its private server.

`test:package` installs the exact archive into an empty consumer's physical `node_modules` with scripts disabled and no plugin development dependencies, then runs lifecycle and real TUI checks at 120 and 60 columns. The build precompiles Solid JSX to ESM; OpenCode supplies the external Solid/OpenTUI runtime.

## More

- [Configuration and behavior](docs/configuration.md)
- [Design](docs/design.md)
- [Verification](docs/verification.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Releasing](docs/releasing.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE), copyright 2026 Mikhail Belyakov
