# Getting started — cokacremote Desktop Manager

[한국어 가이드](GETTING_STARTED.ko.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Security / Gatekeeper](MACOS_SECURITY.md)

**What it does:** A local control panel for the [kstost/cokacremote](https://github.com/kstost/cokacremote) MCP server, Cloudflare Quick Tunnel and OAuth protection. ChatGPT uses the remote MCP URL to reach **your own computer**. This is a powerful remote-execution service: only authorize accounts and tools you trust.

**What it does not do:** It does not include the upstream MCP server, silently install dependencies, enroll in ChatGPT for you, or make a downloaded unnotarized Mac app trusted by Apple. Your computer and its tunnel must be on and connected for remote access.

## 1. Choose the release for your operating system

| Platform | Current available release | Which asset | Practical expectation |
|---|---|---|---|
| Windows 10/11 | [v0.3.0](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.3.0) | `cokacremote-manager-windows-v0.3.0.zip` | Extract and run the top-level `INSTALL.cmd`. Unsigned script warnings may appear. |
| macOS Apple Silicon (M1–M4), prebuilt | [v0.4.0-rc.2 preview](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) | `...-UNNOTARIZED.dmg` or `...-UNNOTARIZED.zip` | **Apple has not notarized this app.** A download may be blocked until you explicitly approve that individual app. |
| macOS Apple Silicon, local build | [v0.4.0-rc.2 preview](https://github.com/saramjh/cokacremote-desktop/releases/tag/v0.4.0-rc.2) | `...-SOURCE-INSTALL.tar.gz` | Builds from source on the Mac. Requires free Node.js/npm, Rust/cargo and Xcode Command Line Tools. Not a one-click installer. |
| Intel Mac | — | — | No tested native Intel package is published. |

Do not assume the GitHub **Latest** badge means the newest Mac build; stable Windows and Mac preview release channels are different.

## 2. Install

### Windows

1. Download the Windows ZIP linked above and extract **all** contents to a normal folder.
2. Run the **top-level `INSTALL.cmd`** from the extracted folder. Review any Windows security dialogs before granting permission; do not disable Defender or SmartScreen.
3. Let the installer report missing prerequisites, and approve only changes you understand. On a fresh machine, additional setup or manual intervention may be required.
4. Open the manager desktop shortcut, if created. It monitors the upstream service; it is not a replacement for it.

### macOS — binary preview

Download the DMG or ZIP from the Mac **v0.4.0-rc.2** pre-release only after reading [macOS security](MACOS_SECURITY.md). Check `SHA256SUMS.txt` when practical. A downloaded unnotarized app may be stopped by Gatekeeper even though the archive integrity passes. If you trust the downloaded application and macOS blocks it, Apple's **System Settings → Privacy & Security → Open Anyway** is an app-specific approval; follow the Apple instructions linked in [Troubleshooting](TROUBLESHOOTING.md). Do **not** globally turn off Gatekeeper.

### macOS — source-build preview (zero Apple membership fee)

Install the free [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/) and Xcode Command Line Tools (`xcode-select --install`) first. Download `cokacremote-manager-macos-arm64-v0.4.0-rc.2-SOURCE-INSTALL.tar.gz` and optionally verify it against `SOURCE-INSTALL-SHA256.txt`. In Terminal:

```bash
cd ~/Downloads
tar -xzf cokacremote-manager-macos-arm64-v0.4.0-rc.2-SOURCE-INSTALL.tar.gz
bash cokacremote-manager-v0.4.0-rc.2/INSTALL-MAC.command
```

Read the on-screen summary and type `y` only if you approve a local build. The script tests, compiles and locally signs the app, verifies it, then installs to `~/Applications`. It **refuses to overwrite** an existing app. It does not disable Gatekeeper or remove download quarantine. A local build is **not** an Apple-notarized public distribution method. If a copy is already installed, run `open "$HOME/Applications/cokacremote Manager.app"` instead.

## 3. Prepare the environment inside the manager

1. Select your preferred UI language in the top bar (English, Korean, Japanese, Chinese, Spanish, French or German).
2. Click **Check dependencies**. The app checks for Node.js/npm, Git, cloudflared and an existing cokacremote server. A missing component requires your **explicit approval** before an allowed install operation.
3. The macOS dependency installer uses an **existing Homebrew** installation; it does not install Homebrew for you. Do not assume every fresh machine can be provisioned with one click.
4. Click **Verify all** to inspect the local server, public tunnel and OAuth protection. A **gray** indicator can mean *not yet verified*, not a failure. Yellow requires investigation; red indicates unavailable or ownership blocked. [Indicator definitions](STATUS_MODEL.md).
5. If a component needs repair, use **Reuse / Repair** to request the smallest safe recovery action. Do not use **Force restart** just to update the screen: it can rotate the Quick Tunnel URL and break the ChatGPT connection.

## 4. Connect your own ChatGPT account

1. In the manager, find **Public MCP address**, then use **Copy**. It must be the current HTTPS endpoint and end with `/mcp`.
2. In ChatGPT, open your account's **Plugins / custom MCP** connection setup if available. Account and workspace access can vary. [ChatGPT integration guide](CHATGPT_SETUP.md).
3. Name the server, paste your URL, review tool scopes and complete the browser's OAuth approval. The **OAuth approval key** belongs **only** in the legitimate approval screen. Never paste it into a chat message or a public issue.
4. Confirm the connection in ChatGPT. First request a *read-only* action. A green manager status does **not** prove ChatGPT has registered or authorized the plugin.

## 5. What success looks like

- The manager shows local MCP server, public tunnel and OAuth as verified, or explains which evidence is missing.
- ChatGPT shows your custom MCP connection as enabled and can complete a harmless read-only call.
- The endpoint continues to work without restarting existing healthy processes. If your Mac/PC sleeps, shuts down, or loses connectivity, remote access stops.

**Need help?** See the [symptom-based troubleshooting guide](TROUBLESHOOTING.md). When reporting an issue, include your OS, app version, selected release asset, error *text* and steps taken. **Never send OAuth keys, approval URLs containing tokens, private paths, or privileged logs.**
