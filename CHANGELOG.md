# Changelog

## 0.1.0 - 2026-11-17

- Added `get_goal` and `create_goal` tools for OpenCode 2.3.0's native session Goal
- Added `replace_goal` for explicit corrections of active, paused, or completed goals, guarded by the expected native goal ID
- Kept the built-in goal indicator, reviewer, continuation, and lifecycle commands
- Added objective validation, idempotent creation for a matching active goal, and refusal of implicit replacement through `create_goal`
- Added Plan refusal and host permission checks for creation and replacement
- Added verification of native state after creation and diagnostics for partial command failures
- Added unit tests, native lifecycle checks, package verification, and GitHub CI

This entry describes the initial package; it does not indicate that a release has been published
