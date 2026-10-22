# macOS: Tauri, Gatekeeper and distribution

**Tauri is not an exemption from macOS security checks.** It uses the operating system's WebKit instead of packaging Chromium, which reduces app size, but macOS still checks the signature, downloaded app quarantine and notarization status.

## Signing levels

| Build | Can run on developer's own Mac? | Smooth download experience for other users? |
|---|---|---|
| Local development | Often yes | No |
| Ad-hoc signed | Often yes, after owner approval | No; Gatekeeper warnings are still possible |
| Developer ID signed and Apple-notarized | Yes | This is the recommended public distribution path |

The early Tauri proof-of-concept was **ad-hoc signed**, not notarized. Local execution testing does **not** demonstrate that an Internet-downloaded zip or DMG opens without warning on another Mac.

## What are the actual macOS downloads?

The latest macOS preview is [v0.4.0-rc.2](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) for Apple Silicon:

- **UNNOTARIZED.dmg:** precompiled preview. Downloaded apps can be blocked.
- **UNNOTARIZED.zip:** the same code-signing and notarization situation in a different container. Renaming/changing the container **does not** remove Gatekeeper.
- **SOURCE-INSTALL.tar.gz:** app source and an interactive installer. Requires free Node.js/npm, Rust and Xcode Command Line Tools. Builds a locally signed app; it is **not** a notarized public installer.

See [Getting started](GETTING_STARTED.md) or [한국어 안내](GETTING_STARTED.ko.md) for verified commands.

### If macOS blocks a downloaded precompiled app

1. Confirm the release origin and, where possible, the SHA-256 checksum.
2. Try launching the app once, then read the macOS security warning. **Do not automatically trust it.**
3. **Only if you independently trust it**, go to **System Settings → Privacy & Security → Open Anyway** for that particular app. macOS may show this only for a limited period after the attempt. Follow the native user approval flow. This is **not notarization**.
4. If you cannot verify the download or the security warning is unclear, stop instead of forcing execution.

[Apple's unidentified developer guidance](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40617/mac) · [Troubleshooting](TROUBLESHOOTING.md)

## User safety

Download only from the expected upstream GitHub project or verified releases. Confirm project ownership, signing status and checksum. If macOS blocks an app, review its publisher and origin in **System Settings → Privacy & Security** and use the operating system's documented trust controls only if you are confident it is legitimate.

**Do not disable Gatekeeper globally** or clear app quarantine as an automated installer step. If you have no trusted signature, disclose the limitation.

## Release engineering

For distribution without repeated Gatekeeper exceptions, configure the Tauri macOS build with a Developer ID Application certificate and submit it to Apple notarization. Keep the certificate private. The Apple Developer Program generally has a paid membership requirement; **do not spend money or enroll the owner without explicit approval**.

- [Tauri macOS code signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri distribution overview](https://v2.tauri.app/distribute/)

Until verified Developer ID + notarization is available, mark the macOS distribution as a development or manually approved test build. Signing success alone is not a public-installation guarantee.
