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
