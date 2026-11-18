# Reporting vulnerabilities

Do not include credentials, private session content, or complete user configurations in public issues.

If the repository's Security tab offers private vulnerability reporting, use it. This document does not assert that the feature has been enabled. Otherwise, request a private channel in an issue without publishing exploitation details or sensitive reproduction data.

A useful initial report includes the package version, OpenCode version, affected behavior, and sanitized reproduction steps. If a credential has been exposed, revoke or rotate it; removing the public text is not enough.

## Security boundaries

- Tools receive the session ID from OpenCode, never from model-supplied arguments
- Mutations check the host permission action `goal` with resource `create` or `replace`
- The built-in `plan` agent cannot create or replace a goal; custom planning agents with different IDs must deny `goal` in their permission rules
- The creation tool preserves existing goals; explicit replacement checks the expected ID before creating a new active goal
- Native OpenCode remains responsible for goal storage and lifecycle

OpenCode 2.3.0 does not expose an atomic conditional-write operation. Manual goal changes can race with an in-flight mutation; see [Configuration and behavior](docs/configuration.md).

The checked compatibility target is OpenCode 2.3.0. This policy does not promise support for other versions or a fixed response timeline

## Temporary development-dependency risk acceptance

Until **2026-12-17 00:00 UTC**, the audit gate accepts only
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf):
picomatch ReDoS through repeated extglobs. The 30-day window starts on
2026-11-17; this is risk acceptance, not a fix or a clean audit.

The affected installed picomatch version is 4.0.7. The development SDK tree
reaches `@npmcli/run-script -> node-gyp -> tinyglobby -> picomatch` (also via
`fdir`). Every affected node, including propagated findings, must be marked
exclusively `dev: true` in `package-lock.json`; shared runtime/optional nodes
are not exempt. Every cause must resolve exclusively to this exact advisory.
Unknown, mixed or cyclic causes, malformed reports, audit failures, and all
other moderate-or-higher findings block CI. Low/info findings retain the
original moderate threshold. The full public-registry audit report remains
visible in a separate CI step, followed by the policy gate and an explicit warning.

The package has no runtime dependencies, and SDK imports in `src/index.ts`
are type-only. CI installs the development tree with `--ignore-scripts`;
typecheck/build run TypeScript and unit tests run Node with fixed test paths.
The inspected `node-gyp/lib/build.js` calls tinyglobby with literal
`build/*.sln` and `build/*.mk` patterns, not user-supplied extglobs. No route
from untrusted pattern input to this chain was identified in those commands.
This is a bounded source inspection, not proof of non-exploitability:
developer commands, changed build scripts, dependency installation and the
separately installed smoke-test OpenCode host can execute third-party code.
The host's own dependency tree is not covered by this repository's lockfile
audit. Development/CI denial-of-service risk remains accepted.

Remove the exception as soon as a supported patched dependency tree is
available, rerun the full audit and package checks, and update this section
and the verification/release documentation together. Do not silently extend
the deadline or broaden the advisory scope. At expiry, any still-required
exception fails the gate. If the advisory disappears, a clean or low-only
report passes with a removal notice, even after expiry
