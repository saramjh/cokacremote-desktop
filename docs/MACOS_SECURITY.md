# macOS: Tauri, Gatekeeper and distribution

**Tauri is not an exemption from macOS security checks.** It uses the operating system's WebKit instead of packaging Chromium, which reduces app size, but macOS still checks the signature, downloaded app quarantine and notarization status.

## Signing levels

| Build | Can run on developer's own Mac? | Smooth download experience for other users? |
|---|---|---|
| Local development | Often yes | No |
| Ad-hoc signed | Often yes, after owner approval | No; Gatekeeper warnings are still possible |
| Developer ID signed and Apple-notarized | Yes | This is the recommended public distribution path |

The early Tauri proof-of-concept was **ad-hoc signed**, not notarized. Local execution testing does **not** demonstrate that an Internet-downloaded zip or DMG opens without warning on another Mac.

## User safety

Download only from the expected upstream GitHub project or verified releases. Confirm project ownership, signing status and checksum. If macOS blocks an app, review its publisher and origin in **System Settings → Privacy & Security** and use the operating system's documented trust controls only if you are confident it is legitimate.

**Do not disable Gatekeeper globally** or clear app quarantine as an automated installer step. If you have no trusted signature, disclose the limitation.

## Release engineering

For distribution without repeated Gatekeeper exceptions, configure the Tauri macOS build with a Developer ID Application certificate and submit it to Apple notarization. Keep the certificate private. The Apple Developer Program generally has a paid membership requirement; **do not spend money or enroll the owner without explicit approval**.

- [Tauri macOS code signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri distribution overview](https://v2.tauri.app/distribute/)

Until verified Developer ID + notarization is available, mark the macOS distribution as a development or manually approved test build. Signing success alone is not a public-installation guarantee.

## Zero-cost local Mac installation (Apple Silicon)

A paid Apple Developer Program membership is **not** needed to compile and use this app on your own Mac. A locally compiled app is different from an app downloaded from the Internet: it has not inherited the downloaded release's quarantine flag, and can launch without claiming Apple notarization. This does **not** provide notarized distribution or eliminate warnings for another person's downloaded `.dmg`.

From a trusted checkout of this repository, with the free Node.js, Rust toolchain and Xcode tools installed:

```bash
bash scripts/install-local-macos.sh
```

The script runs tests, compiles an Apple Silicon Tauri app with an ad-hoc signature, verifies the signature, and copies it to `~/Applications/cokacremote Manager.app` before launching. It refuses to overwrite an existing app, does not suppress macOS security, does not remove quarantine attributes, and does not modify an existing MCP server or Cloudflare Tunnel. On a checked local machine with a completed binary, `bash scripts/install-local-macos.sh --use-existing-build` performs only the guarded install and launch.

If another Mac downloads the prebuilt GitHub `.dmg`/`.zip`, Gatekeeper can still show a warning because that binary is **UNNOTARIZED**. Trusted public distribution requires valid Developer ID notarization. Do not advertise a local build as Apple approved.
