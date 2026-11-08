# Windows Control Desk: reproducible NSIS release

This is the **Windows Control Desk shown by the local Windows manager-v2 UI**, not the separate macOS Tauri build. The old Windows ZIP scripts remain historical artifacts. This release path packages a real Windows x64 installer via Electron Builder and NSIS.

## Build inputs

- Desktop source and PowerShell service adapters: tracked under `platform/windows/control-desk/`.
- Electron `44.9.1` and Electron Builder `26.18.0`: pinned through `platform/windows/control-desk/package-lock.json`.
- MCP backend: `kstost/cokacremote` revision `d7ceca39a0308d4a91238d35e5599ece30e69a19` (never floating `main`). The strict, reviewed Windows PowerShell command patch is in `patch-upstream-win32.mjs`.
- Bundled Node.js `v24.22.1` and cloudflared `2026.10.1` (Windows x64). Cloudflared official binary SHA-256: `4D2490E74082C5D48DBFEDAF92576FA5BD1702379AB88EB7FAA0CFBE8DC891B6`.
- The build downloads third-party licenses and stages only the server's production dependencies; no developer profile, OAuth state or credentials are bundled.

## Automated CI / Release

The workflow `.github/workflows/windows-control-desk.yml` runs on PRs affecting the Windows release implementation and can be launched with workflow dispatch. It builds on a fresh Windows GitHub runner, runs source tests, rebuilds the pinned MCP server, stages the self-contained binaries, creates the NSIS setup EXE and uploads artifacts with SHA-256.

After the Windows workflow passes on the merged `main`, a maintainer can publish a prerelease by creating the tag matching the app version, currently:

```sh
git tag control-desk-v0.6.0
git push origin control-desk-v0.6.0
```

The tag build must pass first. A separate least-privilege release job then publishes the setup EXE and `SHA256SUMS.txt` to GitHub Releases. Do **not** tag an unmerged branch or reuse an existing tag. Do **not** publish an installable artifact from an unverified local development tree.

## End-user installation

Download the `cokacremote-control-desk-windows-0.6.0-setup.exe` release asset. Run it normally. It installs the GUI and bundled Node, cloudflared, compiled MCP server and production dependencies; neither Git nor npm nor a developer workspace is needed on the destination PC. Start Menu and Desktop entries and an uninstaller are created by NSIS. Service startup and public Quick Tunnel exposure require an explicit action in Control Desk. ChatGPT OAuth approval remains a separate user action.

The installer is currently **unsigned**. Microsoft SmartScreen may display a warning. Do not claim Microsoft code-signing, automatic updates or universal Windows compatibility until those have been implemented and tested.

The Control Desk state is separate from legacy developer installations at `%LOCALAPPDATA%\cokacremote\control-desk-state`. Do not import or overwrite legacy `%USERPROFILE%\.cokacremote` credentials. Uninstaller should not delete this state automatically. Runtime maintenance is bound to executable paths to avoid stopping another installation's server or tunnel.

## Developer build on Windows

```powershell
# In a clean checkout of this repository, with Node.js 24.22.1 available:
cd platform\windows\control-desk
npm ci --ignore-scripts --no-audit --no-fund
npm test

# In a separate checkout of the pinned upstream MCP revision:
node patch-upstream-win32.mjs C:\path\to\upstream
cd C:\path\to\upstream
npm ci
npm run build

# Back in this repo:
cd C:\path\to\cokacremote-desktop\platform\windows\control-desk
.\prepare.ps1 -UpstreamRoot 'C:\path\to\upstream' -NodeExecutable 'C:\path\to\node.exe' -CloudflaredExecutable 'C:\path\to\cloudflared.exe'
npm run dist:win
```

For ordinary builds, use the GitHub Actions workflow instead of copying local service state, installed node_modules or Electron binaries. Do not start the public tunnel during packaging tests.

## Verified scope and remaining work

Locally validated on Windows with a detached pinned upstream checkout, fresh npm dependency graph, packaging with Electron Builder, hidden Electron screenshot smoke test, and silent NSIS install/uninstall in an isolated temporary installation path. Port 3000's owner remained unchanged. A separate clean VM and a friend-device install/OAuth connection are still required to validate distinct user permissions, network access and SmartScreen behavior. Authenticated public MCP was not automatically activated during packaging tests.
