# cokacremote Desktop Manager

> A local-first operator console for [cokacremote](https://github.com/kstost/cokacremote), OAuth, and Cloudflare Quick Tunnel. The **manager** helps you maintain a visible, authenticated MCP connection; the actual tools run on your own computer.

**macOS Tauri v0.4.0-rc.1:** [build, Apple signing, notarization and test-release workflow](docs/TAURI_RELEASE.md). Until Developer ID and App Store Connect credentials are configured, GitHub builds are explicitly **UNNOTARIZED test packages**, not trusted distribution. The previous `v0.3.0` release is Electron-based.\n\n**Start here:** [Connect to ChatGPT](docs/CHATGPT_SETUP.md) · [Interactive showcase](showcase/index.html) · [Dependency preparation](docs/DEPENDENCIES.md) · [Indicator status contract](docs/STATUS_MODEL.md) · [macOS security and notarization](docs/MACOS_SECURITY.md)

### First-run workflow

1. **Inspect** Node.js, Git, cloudflared, and the upstream MCP server. Healthy existing components remain untouched.
2. **Approve** each missing dependency deliberately, after reviewing its vendor, destination and scope.
3. **Install and verify** only missing tools from Windows Package Manager or Homebrew; unknown existing installations are held for manual review rather than overwritten.
4. **Connect** by copying the manager's HTTPS MCP endpoint into ChatGPT's custom MCP server/plugin setup and completing OAuth approval in **your own account**.

The source tree includes read-only platform probes and permission-gated installers under `bootstrap/`. **These are implementation building blocks, not yet a complete Tauri first-run GUI wizard or a promise that v0.3.0 can provision every fresh PC.** Finish and test full clean-machine installation before presenting it as a production one-click installer.

The showcase is an animated explainer: its simulated statuses are **not measurements of a visitor's device**.

## Relationship to cokacremote

**Based on [kstost/cokacremote](https://github.com/kstost/cokacremote)** (upstream MCP server). This repository is an **independent desktop management and deployment extension**, not an official upstream release or an automatically synchronized GitHub fork.

- **Upstream:** MCP tools, Streamable HTTP, OAuth 2.1 and core server operation.
- **This project:** Windows/macOS GUI, service supervision, Cloudflare Quick Tunnel management, health/recovery policies and installation packages.
- **Maintenance:** Review upstream changes and verify compatibility before adopting them; do not assume this project tracks upstream automatically.
- **Attribution:** Both original and extension copyright notices are retained in [LICENSE](LICENSE). Additional integration guidance is in [UPSTREAM.md](UPSTREAM.md).

Desktop management console for an existing [cokacremote](https://github.com/kstost/cokacremote) MCP server. It provides a status-oriented interface for OAuth 2.1, Cloudflare Quick Tunnel, health/ownership checks, connection details, and deliberate recovery on Windows and macOS.

## Languages

The same Windows/macOS application supports **English, Korean (한국어), Japanese (日本語), Simplified Chinese (简体中文), Spanish (Español), French (Français), and German (Deutsch)**. Select a language in the header; changes apply instantly without restarting the MCP server or Quick Tunnel. On first launch the interface follows the operating system's UI language (English fallback); the user's selection is saved in a local per-user preferences file. Language settings never modify OAuth credentials, tunnels, or server state.

Localization packs live in `ui/locales/` and share a tested key/placeholder contract. Run `npm test` to verify all seven locales.

## Downloads

Download the **Windows ZIP** or **macOS Apple Silicon ZIP** from GitHub Releases. Both archives exclude existing user OAuth state and private credentials.

### Windows 10/11

Unzip `cokacremote-manager-windows-v0.3.0.zip` and run `INSTALL.cmd`. Installer checks Node.js/cloudflared prerequisites, installs the desktop runtime, reuses the existing Windows Task Scheduler supervisor, opens the manager, and creates a desktop shortcut. It preserves a healthy existing MCP server and Quick Tunnel. Microsoft Defender/SmartScreen may request a trust decision for an unsigned script installer.

### macOS Apple Silicon (M1/M2/M3/M4)

Unzip `cokacremote-manager-macos-arm64-v0.3.0.zip` and open **cokacremote Manager.app**. This ad-hoc-signed app is **not Apple-notarized**, so macOS may require opening it from Finder using Open Anyway. It reuses an already running local MCP/tunnel; initial setup requires Node.js, Git, cloudflared and npm available on PATH. If dependencies are absent, the manager reports a prerequisite error; it cannot silently install privileged system components.

### Connect to ChatGPT

The manager displays the MCP URL and provides a guarded copy control for the OAuth approval key. In ChatGPT, open the MCP / connector setup UI, enter the URL, and complete the OAuth approval **yourself**. The app cannot automatically register or approve a connector on behalf of a ChatGPT user. A Quick Tunnel hostname can change after a forced restart, requiring the ChatGPT connection to be updated.

## Architecture

| Component | Shared | Windows | macOS |
|---|---|---|---|
| State-machine policy | `core/reconcile.mjs` | yes | yes |
| Custom Electron UI | `ui/`, `desktop/` | yes | yes |
| MCP & OAuth service | existing upstream Node.js core | yes | yes |
| Runtime process discovery | per-platform adapter | CIM / PowerShell | ps / lsof |
| Supervision | separate platform implementation | Task Scheduler / PowerShell | launchd / Node |
| Tunnel & credential state | local to the machine | Windows user profile | `~/.cokacremote` |

**Important:** this is a local privileged development tool. Never publish OAuth approval keys, disable OAuth, or expose unprotected host actions. Public anonymous GET /mcp must return 401. Quick Tunnel URLs are temporary.

## State and recovery decisions

Normal: reuse existing verified server and tunnel without PID or URL changes.
Missing MCP: preserve the trusted tunnel and restart only the server with its verified issuer.
Missing tunnel: new tunnel URL changes OAuth issuer and may require ChatGPT reconnection.
Ambiguous process owner: block destructive actions.
Transient remote failure with running components: retain them and recheck rather than blindly rotate a working tunnel.

Pure reconciliation tests cover 11 scenarios, but a full reboot and destructive live-fault matrix must be performed separately on a controlled environment. The manager does not infer ChatGPT-side plugin status from local checks.

**Windows v0.3.0** includes a safe GUI upgrade path for existing installations. Both platform packages include the same seven-language interface.

## Build

Prerequisites: Node.js 24+, npm. Native platform package preparation requires the host operating system.

```sh
npm ci
node --test test/reconcile.test.mjs
# macOS ARM64:
bash scripts/build-macos-safe.sh arm64 0.3.0
```

The Windows release installer and Windows platform automation scripts originate from the existing `cokacremote` Windows deployment. Windows packaging is maintained separately to preserve Windows Task Scheduler behavior; `platform/windows` contains inspectable controller modules and contracts.

## Limitations

- Release `v0.3.0` is a usable local management package, **not** a guarantee of full clean-machine installation on every PC. Windows dependency installation and a fresh macOS system still require end-to-end testing.
- macOS currently supports Apple Silicon in the published binary; an Intel build requires its own runtime packaging and test.
- The published macOS app is ad-hoc signed, not notarized.
- Neither package can attest to an active ChatGPT connector without inspecting the user's ChatGPT interface.
- Do not restart a healthy tunnel to test the UI; its URL and OAuth redirect may change.
- The existing upstream server can perform unrestricted operations on the user's device; limit who can authorize and operate it.

See `docs/PRODUCT.md` and `docs/DESIGN.md`.
