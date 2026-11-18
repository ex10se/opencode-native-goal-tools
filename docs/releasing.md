# Package preparation and release

The initial version is 0.1.0. These instructions describe a manual release; the CI workflow does not publish packages or create releases.

## Prepare

1. Verify [the repository](https://github.com/ex10se/opencode-native-goal-tools) is public and the manifest's `repository`, `homepage`, and `bugs` URLs point to it
2. Update the version in the manifest, lockfile, and changelog together
3. Run the checks in [Verification](verification.md) on the release commit
4. Inspect both READMEs, the package file list, and the license
5. Verify hosted CI for the release commit before publishing

The release temporarily accepts only the development-only picomatch advisory
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
under the [Security policy](../SECURITY.md#temporary-development-dependency-risk-acceptance),
until **2026-12-17 00:00 UTC**. Run `npm run audit:policy` and inspect the full
report and warning; a passing gate does not mean zero vulnerabilities.
Other moderate-or-higher findings, runtime exposure, unknown/mixed causes
and audit failures block release. Remove the exception when a supported
patched tree is verified, updating Security, Verification and Releasing
together. A still-required exception blocks at expiry; a clean or low-only
report instead passes with a removal notice. Do not renew it automatically.
The separately installed OpenCode smoke host has its own dependency tree;
this package's audit does not establish that host's security

The repository already exists. Its visibility, pushed release commit, and npm publication must be verified separately; a dated changelog is not proof of publication. Installation instructions cover source checkouts and local archives, with registry installation conditional on publication.

## Build the archive

```sh
npm pack
```

For version 0.1.0 the archive is `opencode-native-goal-tools-0.1.0.tgz`. Inspect the actual command output and contents:

```sh
tar -tzf opencode-native-goal-tools-0.1.0.tgz
shasum -a 256 opencode-native-goal-tools-0.1.0.tgz
```

The archive should contain `dist`, the manifest, license, and public documentation. It must not contain source tests, local configuration, credentials, or temporary smoke data. `prepack` runs typecheck and build, not the complete test suite.

Install the exact archive in a separate empty directory:

```sh
npm install --ignore-scripts /absolute/path/to/opencode-native-goal-tools-0.1.0.tgz
```

In an isolated OpenCode configuration, point `plugins` to the installed directory ending in `node_modules/opencode-native-goal-tools`. Check tool availability, native state, Plan refusal, and lifecycle controls. Keep the tested archive unchanged for publication.

## Publish

After the repository, release commit, and package have been verified:

Confirm `npm whoami` reports the intended publisher. If authentication is required, log in interactively before publishing. Confirm version 0.1.0 is not already published; do not overwrite or blindly retry a publication.

```sh
npm publish /absolute/path/to/opencode-native-goal-tools-0.1.0.tgz --access public --tag latest
npm view opencode-native-goal-tools@0.1.0 version dist.integrity
```

Create a matching `v0.1.0` tag and GitHub release for that commit, attaching the tested archive and checksum. For another version, update all versioned names consistently.

Use the [0.1.0 release notes](releases/0.1.0.md) as the release description. Verify the public release page, tag target, attached archive checksum, and registry version/integrity after publication.

Verify a clean registry installation and repeat the real-host check. A published version cannot be replaced with different contents; fixes require a new version.

## Restore the previous installation

Restore the prior package directory or its configuration path. To disable only the tools, remove this adapter from `plugins`; keep the built-in `opencode.goal` enabled. Removing the adapter does not stop an existing native goal: use `/goal pause` or `/goal clear` separately if needed
