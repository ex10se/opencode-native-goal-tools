# Verification

## Commands

Use Node.js >=22.18.0, npm, and OpenCode 2.3.0. Native and package tests require a POSIX environment with `tar` and permission to start loopback servers.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run test:smoke -- /absolute/path/to/opencode
npm run test:package -- /absolute/path/to/opencode
npm run audit:policy
npm pack --dry-run
```

`test:package` includes the native smoke test against the extracted archive, so running both smoke commands is unnecessary when only release-package coverage is needed.

## Coverage

| Check | Evidence |
| --- | --- |
| Unit tests | State reading, quote/whitespace normalization, duplicate creation, existing-state refusal, explicit replacement of all statuses, stale-ID refusal, concurrent replacement, invalid input, Plan refusal, command failures, unavailable RPC, and post-write verification |
| Typecheck and build | SDK 2.3.0 compatibility at compile time and generated ESM/declaration files |
| Native smoke | Model calls `create_goal` during an active execution; `get_goal` returns native state; duplicate creation retains the ID; implicit replacement is rejected; explicit replacement of a completed goal gets a new ID; stale replacement and Plan mutations are rejected |
| Native lifecycle | The native reviewer pauses a goal, `/goal resume` preserves its ID, the reviewer completes it, and `/goal clear` removes it |
| Package check | Required files are present, development directories are excluded, and the extracted public export loads without installed SDK dependencies |
| Audit | Full public-registry JSON report, then a moderate-threshold gate with the exact, dev-only [temporary exception](../SECURITY.md#temporary-development-dependency-risk-acceptance) |
| Audit policy tests | Exact advisory and propagated causes, runtime exposure, mixed/unrelated advisories, schema/errors/cycles, subprocess failure, expiry and clean/low-only reports |

The model fixture is deterministic. It validates the host/tool boundary and lifecycle wiring, not a real model's judgment of task completion.

## Isolation

The smoke test creates a temporary home, configuration, database, and project, starts a private OpenCode server and a loopback model, and supplies a fresh test-only server password. It does not reuse the user's provider credentials or shared service. Its output identifies the diagnostic directory, which contains the private server log.

## Recorded verification

On 2026-11-17, the initial local checks passed on macOS with Node.js 26.13.1 and OpenCode 2.3.0:

- 26 unit tests
- Typecheck and build
- Extracted-package loading and native lifecycle smoke
- Tools loaded in a running OpenCode instance, with a successful `get_goal` call

On 2026-11-17, the subsequent local checks passed: all 64 tests (38 audit-policy
and 26 runtime unit tests), typecheck, and package dry-run. A fresh
`npm run audit:policy` passed with five high findings caused exclusively by
the accepted development-only advisory GHSA-fc5q-39xc-vjpf; this is not a clean
audit. The full report and accepted-risk warning remained visible.
`npm run test:package` also passed against OpenCode 2.3.0, verifying the
extracted archive and native Goal lifecycle. The archive contained 16 files,
no runtime dependencies, and no policy script or tests.

GitHub CI is configured for Linux with Node.js 22.19.0 and 24 and an OpenCode 2.3.0 smoke host. These configured jobs are not evidence of a successful hosted CI run; inspect the workflow result for the commit being released.

`npm run audit:policy` prints the unfiltered JSON report and checks it against
`package-lock.json`. CI separates capture/display from enforcement; a normal
audit exit of 1 is captured for inspection, not blindly ignored. Report,
network, subprocess and policy failures remain blocking. Only the exact
development-only advisory is accepted until **2026-12-17 00:00 UTC**.
If it disappears, the gate passes with a removal notice; a still-needed
exception fails at expiry. Remove the exception after verifying a supported
patched tree, and update Security, Verification and Releasing together.
An offline `node scripts/audit.mjs check <report-file>` checks a previously
captured `{ "report": ..., "status": ... }` envelope; it is not a fresh audit.

## Limits

No test establishes atomicity against simultaneous manual goal changes; the native API does not provide it. Other OpenCode versions, Windows smoke execution, custom planning-agent restrictions, and all third-party plugin combinations are not covered by the recorded checks
