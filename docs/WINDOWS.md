# Windows MCP Manager — published desktop v0.3.0

[Windows installation guide](GETTING_STARTED.md) · [한국어 설치](GETTING_STARTED.ko.md) · [FAQ](TROUBLESHOOTING.md)

The [published v0.3.0 ZIP](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0) has a **top-level INSTALL.cmd** (verified in the release archive). Extract the entire ZIP before running it. Windows SmartScreen can warn for unsigned scripts; review before granting trust and do not disable Defender globally.

This project **wraps existing cokacremote Windows scripts**. It does not replace them. Run via the desktop shortcut "cokacremote MCP Manager" or `deploy/windows/OPEN-MCP-MANAGER.cmd`.

Electron UI controls:
- Live status: MCP / Quick Tunnel / OAuth, process IDs, observed ownership, public address and recovery recommendation
- Copy active MCP URL / copy approval key / reveal approval key temporarily
- Reuse healthy service without PID/URL change
- Repair from a verified existing service/task; stop/restart only on explicit action
- Open ChatGPT for manual connection registration
- Periodic public verification, descriptive outages, unknown-process block

The Windows Scheduled Task `cokacremote-windows` remains the sole supervisor. Its existing PowerShell controller is the execution mechanism. Closing Electron does not stop MCP.

## Architecture
See ARCHITECTURE.md, DESIGN.md, PRODUCT.md. Root package uses existing Node/Cloudflare Quick Tunnel. This desktop module needs Electron 44.9.1 installed locally through `npm ci` and `node node_modules/electron/install.js`. Its node_modules and secrets must not be shipped in source-only ZIP. New-user bootstrap installs the runtime.

## Known limits
Cloudflare Quick Tunnel hostname can rotate; the owner must update/reauthorize the ChatGPT plugin in that case. The app cannot read the ChatGPT website's actual installed-plugin list. Actual ChatGPT authorization must be manually performed. No security limits/CAPTCHA bypass or guarantee under network/device power-off.

## QA
`node --test test/reconcile.test.mjs`, Electron screenshot mode with `--qa-screenshot=FILE`, and PowerShell parser checks. No production component is intentionally killed during automatic tests.
