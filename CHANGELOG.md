# Changelog

## 0.1.0 - 2026-11-20

- Added `get_goal` and `create_goal` tools for OpenCode's native session Goal
- Added an English operation label beside native TUI permission prompts, without changing their decisions or buttons
- Added `replace_goal` for explicit corrections of active, paused, or completed goals, guarded by the expected native goal ID
- Kept the built-in goal indicator, reviewer, continuation, and lifecycle commands
- Added objective validation, idempotent creation for a matching active goal, and refusal of implicit replacement through `create_goal`
- Added host permission checks for creation and replacement in every mode, including Plan
- Added verification of native state after creation and diagnostics for partial command failures
- Added unit tests, native lifecycle checks, package verification, and GitHub CI

This entry describes the initial package; it does not indicate that a release has been published
