# Windows MCP Manager — desktop v0.2

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
