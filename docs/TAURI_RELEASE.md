# Tauri macOS v0.4.0-rc.2: build, distribution and Apple notarization

This source contains the **macOS Apple Silicon Tauri desktop bundle**. The app uses system WebKit instead of bundling Electron Chromium, and does not bundle the upstream MCP server or your OAuth credentials.

## Build and verified release

[macOS GitHub Actions workflow](../.github/workflows/tauri-macos.yml) checks the shared seven-language UI, builds for `aarch64-apple-darwin`, creates a ZIP and DMG, validates the app signature and computes SHA-256 checksums.

- If repository Apple signing/notary credentials are **completely absent**, the workflow can upload an **UNNOTARIZED test artifact only with publishing disabled**. The ZIP/DMG filenames explicitly say UNNOTARIZED; macOS Gatekeeper may reject them. A public GitHub Release requires Apple notarization.
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

This macOS target relies on an already-installed Node.js for the MCP server probes/operations. The dependency panel can inspect the host without Node and asks user approval before a targeted Homebrew installation. Homebrew itself is not auto-installed.

Windows Tauri is a separate platform target; Windows v0.3.0 remains the tested packaged Windows installer. A macOS Tauri release is **not** a claim that the Windows Tauri installer has been built.

## Apple Developer Program owner setup (once)

The owner must authenticate in Apple's UI; do not share the Apple Account password, a private key or a PKCS#12 password in chat.

1. On the Mac, sign in with the enrolled Apple Developer account in **Xcode → Settings → Accounts**, then create/install **Developer ID Application** under **Manage Certificates** (Account Holder role), and export its certificate + private key as a password-protected `.p12` from Keychain Access.
2. Under **App Store Connect → Users and Access → Integrations**, create an **App Store Connect API key** with sufficient Developer access, download the `.p8` key once, and note the Key ID and Issuer ID.
3. With the `.p12` and `.p8` on that Mac, run `bash scripts/configure-apple-notarization.sh` in a local interactive Terminal. It validates the available identity and files, asks for explicit confirmation, and submits seven secrets through `gh` on standard input without printing their contents. No secrets go into Git or ChatGPT.
4. Once all seven are present, run the GitHub Actions workflow with `publish: false`, require actual Developer ID signature, hardened runtime, secure timestamp, Apple notarization and stapler verification; only then run `publish: true` on the release branch merged into main.

`v0.4.0-rc.1` remains an immutable UNNOTARIZED developer preview. A trusted build must get a distinct version and release tag.
