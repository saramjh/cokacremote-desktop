# Troubleshooting & FAQ / 문제 해결

[English setup](GETTING_STARTED.md) · [한국어 시작하기](GETTING_STARTED.ko.md) · [Status definitions](STATUS_MODEL.md)

## Install and launch

| Symptom / 증상 | Cause / 원인 | Safe next action / 대응 |
|---|---|---|
| macOS says developer cannot be verified, or app is damaged | Downloaded macOS v0.4.0-rc.2 is **UNNOTARIZED**, not Developer ID signed. Wording varies by macOS version. | Confirm you used the official release, review SHA-256. If you choose to trust it, retry once and use **System Settings → Privacy & Security → Open Anyway** for this app. [Apple support](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40617/mac). Do not disable Gatekeeper globally. |
| Mac DMG vs ZIP vs PKG | Package extension does not change code-signing/notarization status. | Use the per-app Apple approval for a trusted binary, or the source-build archive if you have developer tools. |
| Mac source installer fails: `node`, `cargo`, `xcrun` missing | Free toolchain not installed. | Install Node.js, Rust and Xcode Command Line Tools from official sources; rerun after checking tools are available on PATH. |
| Mac source installer refuses to overwrite an app | Intentional safety guard. | Run the already installed app, back up/review before any manual upgrade. Installer does not delete your app or credentials. |
| Windows SmartScreen flags installer | Unsigned Windows package or command file. | Verify downloaded source and file before making an individual trust decision. Do not turn off Defender/SmartScreen globally. |
| Mac app window cannot be moved | Old Tauri rc.1 build had a frameless titlebar drag defect. | Use **v0.4.0-rc.2**; drag logo or top title text. Window drag regression tests and an on-device drag test passed for rc.2. |
| Latest release seems older on GitHub | Windows stable v0.3.0 and Mac v0.4.0-rc.2 **pre-release** differ. | Open the platform-specific tag from the [README](../README.md#downloads-and-installation), not just GitHub's Latest button. |

## First-run and connection

| Symptom / 증상 | What it means and what to check |
|---|---|
| Check dependencies reports missing Homebrew | Mac consent installer uses an **already installed** Homebrew; it cannot install Homebrew for you. Install/review Homebrew separately if you want package-manager installation. |
| MCP server or tunnel is red | The component may be stopped, missing or not recognized as manager-owned. Check diagnostics before any restart; never kill an unknown process. |
| OAuth indicator is gray | Verification pending, timed out or evidence missing; gray is **not** a confirmed authentication failure. Use **Verify all**. |
| OAuth indicator is amber | Potential issuer/resource/authorization mismatch supported by evidence. Inspect the current public URL and OAuth metadata; do not rotate a healthy tunnel as your first step. |
| Public MCP URL is unavailable | Local server/tunnel may be stopped or the public address has not been verified. Do not copy an example or stale URL. |
| Can't find custom MCP connection option in ChatGPT | Feature/permissions vary by account and workspace. Check the current ChatGPT settings and [OpenAI guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt). The manager cannot activate it for you. |
| Manager says healthy but ChatGPT has no tools | The manager's local health is **not** proof of ChatGPT-side plugin registration or account OAuth approval. Check both in ChatGPT, then try one harmless read-only tool action. |
| Previously connected plugin stops after tunnel restart | Cloudflare Quick Tunnel URL can change. Update the endpoint in ChatGPT and authorize again if necessary. |
| Remote access stops when computer sleeps | The MCP server and tunnel run on your own machine. The machine must be awake and online. |

## Security and privacy

- The upstream MCP tools may read/write files or execute local commands. Enable only for people and accounts you explicitly trust.
- **Never post your OAuth approval key**, access tokens, private files, or full URLs containing secrets to GitHub issues, chats or screenshots.
- A release archive checksum proves it matches what the publisher uploaded, **not** that Apple has notarized or audited the app.
- If you are unsure about a security warning, **do not override it**. You can inspect the source or choose not to install.

## Reporting a problem

Use the [GitHub issue tracker](https://github.com/saramjh/cokacremote-desktop/issues) with OS and CPU architecture, app version/release asset filename, whether this is a clean install or upgrade, the *redacted* error text and steps to reproduce. Do not share passwords, approval keys, device identifiers, internal file paths or sensitive logs. For anything involving a privileged operation, request help with a **read-only diagnostic** first.
