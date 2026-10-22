# Runtime dependency preparation

## Goal

The manager **must not bundle Node.js, git, cloudflared or the upstream MCP server**. It should detect what's already installed, reuse compatible working components and request **explicit user approval for each missing dependency** before invoking the operating system's package manager.

The desktop GUI is a control plane. It does not own ChatGPT sign-in, and a UI restart must not kill an otherwise healthy MCP server or tunnel.

## Required components

| Component | Windows discovery | macOS discovery | Installation source |
|---|---|---|---|
| Node.js LTS (+ npm) | `Get-Command node,npm.cmd` | `command -v node`, `command -v npm` | Official package via Windows Package Manager or Homebrew |
| cloudflared | `Get-Command cloudflared` | `command -v cloudflared` | Cloudflare package from winget/Homebrew |
| Git | `Get-Command git` | `command -v git` | Git official package |
| cokacremote | known repo path, package manifest and `dist/src/server.js` | known repo path and server | Clone `kstost/cokacremote`, `npm ci`, build only on approval |

Already installed does not necessarily mean **working**. The state probe should also verify the version, ownership, listener, local HTTP health, OAuth issuer and public endpoint. A mismatched installation is a **review state**, not a reason to delete and replace it.

## State machine

```text
INSPECT
 ├─ healthy installed components → REUSE / VERIFY
 ├─ unknown owner/version/path    → HOLD_FOR_REVIEW (no mutation)
 └─ missing component             → SHOW_SOURCE_AND_SCOPE
                                     ↓ explicit approval
                                INSTALL_ONE_COMPONENT
                                     ↓
                                VERIFY_VERSION_AND_HEALTH
                                     ├─ healthy → NEXT_COMPONENT
                                     └─ unknown → HOLD_FOR_REVIEW
```

Installer commands are allowlisted. A GUI consent dialog must name the package, purpose, vendor, destination, anticipated privilege escalation and package manager. If approval is denied, nothing is installed, and the application remains usable in diagnostic mode.

## Initial implementation

The package includes standalone `bootstrap/windows.ps1` and `bootstrap/macos.sh` probes and consent-driven installer entry points. These scripts deliberately do **not** install a package as a side effect of a `probe` call. On Windows, installers use `winget`; on macOS they use the existing `brew` executable. If the package manager itself is missing, report an instruction and official URL instead of executing an arbitrary downloaded bootstrap shell.

The desktop UI's unified per-dependency consent workflow is **not yet fully wired to the Tauri Rust command layer**. Do not claim the current published v0.3.0 binary implements automatic dependency installation or clean-machine provisioning.

**Security constraints:** Only allowlisted dependency identities, no passwords or tokens in logs, avoid overwriting non-owned instances, never suppress macOS Gatekeeper or Windows security prompts. Download / install only after explicit user choice.
