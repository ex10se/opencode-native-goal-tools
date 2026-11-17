# Contributing

Use Node.js >=22.18.0 and npm. Install development dependencies with `npm ci --ignore-scripts`. Native lifecycle checks also require an OpenCode 2.3.0 executable and a POSIX environment with `tar`.

## Before submitting changes

```sh
npm run typecheck
npm test
npm run build
npm run test:package -- /absolute/path/to/opencode
npm audit --audit-level=moderate
npm pack --dry-run
```

The package check builds an archive, loads its public export without installed SDK dependencies, and runs the native lifecycle smoke against the extracted package. See [Verification](docs/verification.md) for coverage and limitations.

Edit `src`, not generated `dist` files. Preserve the default ESM server export, tool names, and session-bound arguments. Changes must continue to use the native Goal state and lifecycle rather than introduce a separate goal store or continuation loop.

Add regression coverage when changing behavior. Permission checks, Plan refusal, existing-goal protection, expected-ID checks for explicit replacement, and verification after command execution are part of the public contract.

## Documentation and reports

Public documentation is in English except `README.ru.md`, the Russian counterpart. Keep both READMEs aligned with the configuration reference and changelog.

Describe the problem, changed behavior, and checks actually performed. Do not include private conversations, credentials, personal filesystem paths, or corporate endpoints in examples, fixtures, logs, or screenshots
