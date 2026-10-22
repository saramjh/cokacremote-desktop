# Tauri macOS release engineering — v0.4.0-rc.2 and Apple notarization

**Current release state:** [v0.4.0-rc.2](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) was **manually published as an UNNOTARIZED preview**, including ZIP/DMG and a source-install tar.gz asset. This is **not** a successful notarized CI publication. The GitHub Latest v0.3.0 release includes a separate Windows desktop package. End users should begin with [Getting started](GETTING_STARTED.md), not release-maintainer instructions.

This source contains the **macOS Apple Silicon Tauri desktop bundle**. The app uses system WebKit instead of bundling Electron Chromium, and does not bundle the upstream MCP server or your OAuth credentials.

## Build and verified release

[macOS GitHub Actions workflow](../.github/workflows/tauri-macos.yml) checks the shared seven-language UI, builds for `aarch64-apple-darwin`, creates a ZIP and DMG, validates the app signature and computes SHA-256 checksums.

- The current rc.2 preparation-branch workflow **fails closed** without required Apple signing and notarization secrets. Its automatic publication path is reserved for verified notarized artifacts. The separately labeled rc.2 **manual** preview distribution must not be interpreted as successful notarization.
- If the full Apple signing/notary configuration is available, Tauri signs with Developer ID Application, submits to Apple notarization, staples the ticket, and validates it before publishing. A failed validation blocks publishing.
- If only part of the signing/notary configuration is present, the build **fails closed** rather than publishing confusing unsigned assets.

## Prerequisites for public notarized distribution

Apple's notarization service requires an enrolled, active Apple Developer Program account, a valid **Developer ID Application** signing certificate with its private key, and App Store Connect notarization credentials. A free Apple development identity or ad-hoc signature cannot substitute for notarization. Do not buy a membership or share passwords without explicit account-owner approval.

Set these repository **GitHub Actions Secrets** under Settings → Secrets and variables → Actions:

| Secret name | Contents (do not paste into a chat) |
|---|---|
| `APPLE_CERTIFICATE` | Base64 encoding of the exported Developer ID Application PKCS#12 (.p12) |
| `APPLE_CERTIFICATE_PASSWORD` | Export password for that certificate |
| `APPLE_SIGNING_IDENTITY` | Exact Developer ID Application certificate common name |
| `KEYCHAIN_PASSWORD` | Random password for temporary CI keychain |
| `APPLE_API_ISSUER` | App Store Connect API Issuer ID |
| `APPLE_API_KEY` | App Store Connect API Key ID |
| `APPLE_API_PRIVATE_KEY` | The complete App Store Connect `AuthKey_....p8` private key, stored as a secret |

All seven are needed. GitHub Secrets are write-only after registration; the workflow only checks whether they are present and never emits values. Tauri supports using Developer ID credentials and an App Store Connect API key for notarization.

Reference: [Tauri macOS signing & notarization](https://v2.tauri.app/distribute/sign/macos/), [GitHub Actions certificate handling](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications).

## Operator procedure

1. In Actions, select **macOS Tauri build and release**, select main, and run once with `publish: false`.
2. Review compile/test/signature results. For a complete notarized build, confirm the workflow verifies both `xcrun stapler validate` and `spctl -a -t exec`.
3. Run with `publish: true` only after validation. The workflow refuses to replace existing release tags.
4. Download only from the official tagged GitHub Release. Confirm SHA-256 for each artifact.
5. Test a **freshly downloaded, quarantine-marked** copy on a separate macOS machine. Source-tree local launch alone does not demonstrate Gatekeeper acceptance.

The manager never disables Gatekeeper, removes quarantine attributes, uploads user credentials or silently replaces an existing healthy MCP server/tunnel.

## Known limits

The current default branch and macOS rc.2 release tag are **not identical** source revisions. Verify both the tag target and actual uploaded artifacts before generating release notes. Do not assume a macOS rc.2 package also updates Windows stable.


This macOS target relies on an already-installed Node.js for the MCP server probes/operations. The dependency panel can inspect the host without Node and asks user approval before a targeted Homebrew installation. Homebrew itself is not auto-installed.

Windows Tauri is a separate platform target; Windows v0.3.0 remains the tested packaged Windows installer. A macOS Tauri release is **not** a claim that the Windows Tauri installer has been built.
