# cokacremote Desktop Manager

> A local-first operator console for [cokacremote](https://github.com/kstost/cokacremote), OAuth, and Cloudflare Quick Tunnel. The **manager** helps you maintain a visible, authenticated MCP connection; the actual tools run on your own computer.

**Choose your download:** [Windows v0.3.0 stable](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0) · [macOS Apple Silicon v0.4.0-rc.2 preview](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2). **macOS is currently NOT Apple notarized.** Downloaded DMG/ZIP builds may be rejected by Gatekeeper. The source-install alternative requires free developer tools; it is not a one-click installer.

**Start here:** **[Quick start / 설치 가이드](docs/GETTING_STARTED.md) · [한국어 시작하기](docs/GETTING_STARTED.ko.md)** · [Troubleshooting / 문제 해결](docs/TROUBLESHOOTING.md) · [Choose an installer below](#downloads-and-installation) · [Connect to ChatGPT](docs/CHATGPT_SETUP.md) · [Interactive showcase](showcase/index.html) · [Dependency preparation](docs/DEPENDENCIES.md) · [Status indicators](docs/STATUS_MODEL.md) · [macOS security](docs/MACOS_SECURITY.md)

### First-run workflow

1. **Inspect** Node.js, Git, cloudflared, and the upstream MCP server. Healthy existing components remain untouched.
2. **Approve** each missing dependency deliberately, after reviewing its vendor, destination and scope.
3. **Install and verify** only missing tools from Windows Package Manager or Homebrew; unknown existing installations are held for manual review rather than overwritten.
4. **Connect** by copying the manager's HTTPS MCP endpoint into ChatGPT's custom MCP server/plugin setup and completing OAuth approval in **your own account**.

The source tree includes read-only platform probes and consent-controlled installers. macOS v0.4.0-rc.2 has a dependency inspection UI, but full clean-machine onboarding is not yet verified. Do not present the macOS preview or the separate Windows v0.3.0 package as guaranteed one-click provisioning. See [the guide](docs/GETTING_STARTED.md) and [FAQ](docs/TROUBLESHOOTING.md).

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

## Downloads and installation

**New user?** Follow [step-by-step setup](docs/GETTING_STARTED.md) or [한국어 사용 설명서](docs/GETTING_STARTED.ko.md). These cover prerequisites, ChatGPT authorization and safe verification; see [Troubleshooting](docs/TROUBLESHOOTING.md) for common errors.

**Please read before downloading:** The newest macOS release is an **UNNOTARIZED preview**, not a production-ready no-warning installer. You should not have to guess which file is safe to run. The Windows and macOS release versions currently differ.

| Your computer | Which release | Installation level |
|---|---|---|
| Windows 10/11 | [v0.3.0 stable](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0) | Extract ZIP and run INSTALL.cmd; SmartScreen may warn about an unsigned installer |
| Mac with Apple Silicon (M1/M2/M3/M4) | [v0.4.0-rc.2 preview — SOURCE INSTALL](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) | **Technical users:** requires free Node.js/npm, Rust and Xcode Command Line Tools; compiles the app locally |
| Mac with Apple Silicon (downloaded app) | [v0.4.0-rc.2 preview — DMG/ZIP](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) | **UNNOTARIZED:** Gatekeeper may block first launch; verify the download and use Apple's individual-app approval only if you trust it |

### Windows 10/11

Download the Windows ZIP from the [v0.3.0 release](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0). Extract it and run INSTALL.cmd. This is a local management tool rather than a complete unattended fresh-machine bootstrap. It preserves healthy MCP servers and tunnels; Windows SmartScreen may still request a trust decision.

### macOS Apple Silicon — free, locally built app

1. Install the free prerequisites from their official providers: [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and Xcode Command Line Tools (run xcode-select --install). A Mac with these tools already installed can reuse them.
2. Download **cokacremote-manager-macos-arm64-v0.4.0-rc.2-SOURCE-INSTALL.tar.gz** from the [v0.4.0-rc.2 release assets](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2). This archive contains **source code**, not a notarized app. Optionally check SOURCE-INSTALL-SHA256.txt.
3. Open Terminal and run:

   ~~~bash
   cd ~/Downloads
   tar -xzf cokacremote-manager-macos-arm64-v0.4.0-rc.2-SOURCE-INSTALL.tar.gz
   bash cokacremote-manager-v0.4.0-rc.2/INSTALL-MAC.command
   ~~~

4. Review the prompt and explicitly enter y to build, test and install to ~/Applications. The installer refuses to overwrite an existing application. If cokacremote Manager is already installed, open the existing app rather than reinstalling.

**Security:** A locally compiled app is ad-hoc signed, **not Apple notarized**. Switching downloaded binaries from DMG to ZIP, PKG, or APP does not remove Gatekeeper checks. Do not disable Gatekeeper globally or strip quarantine metadata. For a downloaded compiled app you personally trust, see [Apple's individual-app approval instructions](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40617/mac).

**Mac 신규 사용자 안내:** 위 SOURCE-INSTALL.tar.gz는 일반 앱 설치 파일이 아닌 **소스 빌드 패키지**입니다. Node.js, Rust, Xcode 명령줄 도구가 필요하며, 현재 원클릭 설치 또는 공증 완료 제품을 제공하지 않습니다.

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
