# Reporting vulnerabilities

Do not include credentials, private session content, or complete user configurations in public issues.

If the repository's Security tab offers private vulnerability reporting, use it. This document does not assert that the feature has been enabled. Otherwise, request a private channel in an issue without publishing exploitation details or sensitive reproduction data.

A useful initial report includes the package version, OpenCode version, affected behavior, and sanitized reproduction steps. If a credential has been exposed, revoke or rotate it; removing the public text is not enough.

## Security boundaries

- Tools receive the session ID from OpenCode, never from model-supplied arguments
- Mutations check the host permission action `goal` with resource `create` or `replace`
- Plan and other agents use the same host permission checks; goal management does not grant permission to implement project changes or bypass host restrictions
- The creation tool preserves existing goals; explicit replacement checks the expected ID before creating a new active goal
- Native OpenCode remains responsible for goal storage and lifecycle

OpenCode 2.3.0 does not expose an atomic conditional-write operation. Manual goal changes can race with an in-flight mutation; see [Configuration and behavior](docs/configuration.md).

Compatibility checks target the latest stable OpenCode release. Recorded results identify the exact version tested; this policy does not promise compatibility with future releases or a fixed response timeline

## Dependency audit

CI runs the unfiltered public-registry audit, including development dependencies,
with moderate-or-higher findings and audit errors blocking the build.
There are no advisory exceptions.

The temporary exception for
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
was removed after the advisory was withdrawn. This was a database withdrawal,
not a claim that picomatch 4.0.7 had been patched.

The package has no installed runtime dependencies. The TUI uses the rendering
runtime supplied by OpenCode. Development tooling and the separately installed
smoke host execute third-party code; the package's lockfile audit does not
establish the security of the host's own dependency tree.
