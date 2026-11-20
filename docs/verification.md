# Verification

## Commands

Use Node.js >=22.18.0, npm, the latest stable OpenCode executable, and a POSIX
environment with `tar` and Python 3. Tests start isolated loopback servers.
The smoke harness checks the executable against the current public npm registry.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run audit:policy
npm run test:package -- /absolute/path/to/opencode
git diff --check
```

`test:package` builds and extracts one archive, then checks its native lifecycle
and its actual TUI at 120 and 60 columns. Python 3 provides a pseudo-terminal;
it is not a plugin runtime dependency. Every test server is isolated from the
shared service, user configuration, and provider credentials. The harness
prints the actual host version and diagnostic directory.

## Coverage

- Core: objective validation, existing-state protection, serialized creation
  and replacement, expected IDs, partial failures, and post-write verification
- Adapter: Build and Plan permissions, host denial before native state access,
  operation messages, preservation of existing reasons, and foreign requests
- TUI: English operation labels beside the native confirmation form, both
  actions and both terminal widths; rejecting the requests leaves Goal absent
- Native lifecycle: pause, resume, completion, clear, duplicate creation,
  explicit replacement, stale-ID rejection, and Plan create/read/replace/read
- Package: both entrypoints, declaration files, no installed runtime dependencies,
  and no development source/tests or temporary fixtures
- Audit: full public-registry audit including development dependencies; no
  exceptions, moderate-or-higher findings and audit errors block CI

## Recorded results

On 2026-11-20, OpenCode 2.3.2 passed the native lifecycle and real TUI checks,
including both operations at 120 and 60 columns. The tested archive contained
20 files and no installed runtime dependencies. Typecheck and unit tests passed.

The current full audit reports zero vulnerabilities. The earlier temporary
exception for GHSA-fc5q-39xc-vjpf was removed after its upstream withdrawal
(`withdrawn_at: 2026-11-18T15:38:56Z`), not after a patched picomatch release.

GitHub CI runs on Linux with Node.js 22.19.0 and 24 and installs
`@opencode/cli@latest`. Inspect the workflow for the released commit: configured
jobs and local results do not establish a successful hosted run.

## Limits

The native API does not provide atomic conditional writes against simultaneous
manual Goal changes. The TUI label is adjacent to the native form; the generic
form in OpenCode 2.3.2 still says `Tool: goal`. Windows smoke execution and all
third-party plugin combinations are not covered.
