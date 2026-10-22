# cokacremote Desktop Manager

## Relationship to cokacremote

**Based on [kstost/cokacremote](https://github.com/kstost/cokacremote)** (upstream MCP server). This repository is an **independent desktop management and deployment extension**, not an official upstream release or an automatically synchronized GitHub fork.

- **Upstream:** MCP tools, Streamable HTTP, OAuth 2.1 and core server operation.
- **This project:** Windows/macOS GUI, service supervision, Cloudflare Quick Tunnel management, health/recovery policies and installation packages.
- **Maintenance:** Review upstream changes and verify compatibility before adopting them; do not assume this project tracks upstream automatically.
- **Attribution:** Both original and extension copyright notices are retained in [LICENSE](LICENSE). Additional integration guidance is in [UPSTREAM.md](UPSTREAM.md).

Desktop management console for an existing [cokacremote](https://github.com/kstost/cokacremote) MCP server. It provides a status-oriented interface for OAuth 2.1, Cloudflare Quick Tunnel, health/ownership checks, connection details, and deliberate recovery on Windows and macOS.

## Downloads

Download the **Windows ZIP** or **macOS Apple Silicon ZIP** from GitHub Releases. Both archives exclude existing user OAuth state and private credentials.

### Windows 10/11

Unzip `cokacremote-manager-windows-v0.2.1.zip` and run `INSTALL.cmd`. Installer checks Node.js/cloudflared prerequisites, installs the desktop runtime, reuses the existing Windows Task Scheduler supervisor, opens the manager, and creates a desktop shortcut. It preserves a healthy existing MCP server and Quick Tunnel. Microsoft Defender/SmartScreen may request a trust decision for an unsigned script installer.

### macOS Apple Silicon (M1/M2/M3/M4)

Unzip `cokacremote-manager-macos-arm64-v0.2.1.zip` and open **cokacremote Manager.app**. This ad-hoc-signed app is **not Apple-notarized**, so macOS may require opening it from Finder using Open Anyway. It reuses an already running local MCP/tunnel; initial setup requires Node.js, Git, cloudflared and npm available on PATH. If dependencies are absent, the manager reports a prerequisite error; it cannot silently install privileged system components.

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

**Windows v0.2.1** uses the already verified Windows v0.2.0 runtime unchanged. The macOS v0.2.1 build includes platform-aware labels and Finder PATH handling.

## Build

Prerequisites: Node.js 24+, npm. Native platform package preparation requires the host operating system.

```sh
npm ci
node --test test/reconcile.test.mjs
# macOS ARM64:
bash scripts/build-macos.sh arm64
```

The Windows release installer and Windows platform automation scripts originate from the existing `cokacremote` Windows deployment. Windows packaging is maintained separately to preserve Windows Task Scheduler behavior; `platform/windows` contains inspectable controller modules and contracts.

## Limitations

- Release `v0.2.0` is a usable local management package, **not** a guarantee of full clean-machine installation on every PC. Windows dependency installation and a fresh macOS system still require end-to-end testing.
- macOS currently supports Apple Silicon in the published binary; an Intel build requires its own runtime packaging and test.
- The published macOS app is ad-hoc signed, not notarized.
- Neither package can attest to an active ChatGPT connector without inspecting the user's ChatGPT interface.
- Do not restart a healthy tunnel to test the UI; its URL and OAuth redirect may change.
- The existing upstream server can perform unrestricted operations on the user's device; limit who can authorize and operate it.

See `docs/PRODUCT.md` and `docs/DESIGN.md`.
