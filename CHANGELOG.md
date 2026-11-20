# Changelog

## 0.1.1

- Precompiled the Solid TUI entry to ESM so it loads from npm's `node_modules` layout in OpenCode 2.3.2
- Kept runtime dependencies external and removed the obsolete JSX artifact from the package
- Added physical archive installation checks and real TUI label appearance/removal checks at both terminal widths

## 0.1.0 - 2026-11-20

- Added `get_goal` and `create_goal` tools for OpenCode's native session Goal
- Added an English operation label beside native TUI permission prompts, without changing their decisions or buttons
- Added `replace_goal` for explicit corrections of active, paused, or completed goals, guarded by the expected native goal ID
- Kept the built-in goal indicator, reviewer, continuation, and lifecycle commands
- Added objective validation, idempotent creation for a matching active goal, and refusal of implicit replacement through `create_goal`
- Added host permission checks for creation and replacement in every mode, including Plan
- Added verification of native state after creation and diagnostics for partial command failures
- Added unit tests, native lifecycle checks, package verification, and GitHub CI

Published to [npm](https://www.npmjs.com/package/opencode-native-goal-tools/v/0.1.0). Known defect: the TUI entry retains JSX and fails to load from `node_modules` in OpenCode 2.3.2; the source-directory checks did not cover this installation layout. Version 0.1.1 corrects the build without changing native Goal behavior
