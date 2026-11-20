# Package preparation and release

Version 0.1.0 is published on [npm](https://www.npmjs.com/package/opencode-native-goal-tools) with a known installed-layout TUI defect. Version 0.1.1 corrects the package build. These instructions describe its manual release; CI does not publish packages or create releases.

## Prepare

Use the latest stable OpenCode release for every release check. Refresh the
OpenCode SDK development dependencies with the following command, and commit
the resulting manifest and lockfile after verification. The smoke test checks
its executable against the current public registry version.

```sh
npm install --save-dev --save-exact --ignore-scripts @opencode/plugin@latest @opencode/schema@latest
```

1. Verify [the repository](https://github.com/ex10se/opencode-native-goal-tools) is public and the manifest's `repository`, `homepage`, and `bugs` URLs point to it
2. Update the version in the manifest, lockfile, and changelog together
3. Run the checks in [Verification](verification.md) on the release commit
4. Inspect both READMEs, the package file list, and the license
5. Verify hosted CI for the release commit before publishing

Run `npm run audit:policy`: this is the full public-registry audit with no
exceptions. Moderate-or-higher findings and audit errors block release.
The separately installed OpenCode smoke host has its own dependency tree;
this package's audit does not establish that host's security.

The repository already exists. Its visibility, pushed release commit, and each version's npm publication must be verified separately; a dated changelog is not proof of publication.

## Build the archive

```sh
npm pack
```

For version 0.1.1 the archive is `opencode-native-goal-tools-0.1.1.tgz`. Inspect the actual command output and contents:

```sh
tar -tzf opencode-native-goal-tools-0.1.1.tgz
shasum -a 256 opencode-native-goal-tools-0.1.1.tgz
```

The archive should contain `dist`, the manifest, license, and public documentation. It must not contain source tests, local configuration, credentials, or temporary smoke data. `prepack` runs typecheck and build, not the complete test suite.

Install the exact archive in a separate empty directory:

```sh
npm install --ignore-scripts /absolute/path/to/opencode-native-goal-tools-0.1.1.tgz
```

In an isolated OpenCode configuration, point `plugins` to the installed directory ending in `node_modules/opencode-native-goal-tools`. Check tool availability, native state, Plan creation/readback/replacement, host permissions, and lifecycle controls. Do not assume Plan completes goals like Build. Keep the tested archive unchanged for publication.

`npm run test:package -- /absolute/path/to/opencode` performs this physical installation before every smoke mode and prints the tested archive path and SHA-256. It also checks real TUI labels at 120 and 60 columns, including removal after rejection. An extracted directory outside `node_modules` is not equivalent: it missed the 0.1.0 loader defect. Ensure `dist/tui.js` is exported, with no JSX artifact or bundled runtime.

## Publish

After the repository, release commit, and package have been verified:

Confirm `npm whoami` reports the intended publisher. If authentication is required, log in interactively before publishing. Confirm version 0.1.1 is not already published; do not overwrite or blindly retry a publication.

```sh
npm publish /absolute/path/to/opencode-native-goal-tools-0.1.1.tgz --access public --tag latest
npm view opencode-native-goal-tools@0.1.1 version dist.integrity
```

Create a matching `v0.1.1` tag and GitHub release for that commit, attaching the tested archive and checksum. For another version, update all versioned names consistently.

Use the [0.1.1 release notes](releases/0.1.1.md) as the release description. Finalize all packaged documentation before building the verified archive; publish and attach that exact archive without editing or repacking it. Verify the public release page, tag target, attached archive checksum, and registry version/integrity after publication.

Verify a clean registry installation and repeat the real-host check. A published version cannot be replaced with different contents; fixes require a new version.

## Restore the previous installation

Restore the prior package directory or its configuration path. To disable only the tools, remove this adapter from `plugins`; keep the built-in `opencode.goal` enabled. Removing the adapter does not stop an existing native goal: use `/goal pause` or `/goal clear` separately if needed
