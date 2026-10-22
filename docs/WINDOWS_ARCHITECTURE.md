# State-oriented Windows MCP manager architecture

## Physical ownership
The MCP service and Quick Tunnel are owned by the **existing** Windows Scheduled Task `cokacremote-windows`. The GUI neither clones the MCP server nor adopts credentials. The task uses `deploy/windows/start-cokacremote.ps1`. Its API and OAuth keys remain in the original per-user .cokacremote directory.

## Layers
1. Sensor — existing `gui/status.ps1` returns structured, non-secret local/public/oauth and process-owner metadata. Public checks validate discovery issuer, resource URL and anonymous 401. Only known current-account processes are reusable.
2. Pure policy — `policy/reconcile.mjs` produces REUSE_BOTH, ADOPT_EXISTING, START_BOTH, RECOVER_SERVER_ONLY, RECOVER_TUNNEL_REBIND_SERVER, WAIT_AND_RECHECK or BLOCK_UNVERIFIED_OWNER without side effects.
3. Executor — `deploy/windows/cokacremote.ps1` invokes only the existing setup/restart/stop workflows and task. New `component-recovery.ps1` allows the supervisor to adopt owned Node/cloudflared processes and preserve the Quick Tunnel when the server needs recovery. The GUI does not invoke unbounded shell commands.
4. Presentation — Electron with isolated preload, browser sandbox, strict CSP and a single-instance lock. No file/network APIs are exposed to the renderer; all mutating commands use an IPC allowlist. Secrets are copied/revealed only on explicit user actions.

## Invariants
- If server, tunnel, OAuth metadata and HTTP 401 are healthy: never stop either process or alter the existing public URL.
- A trusted tunnel and missing server: keep tunnel and issue server startup using its verified URL as OAuth issuer.
- A trusted server and absent tunnel: generate a new tunnel; only then replace owned server if OAuth issuer changed. ChatGPT-side reconnect may be required.
- An ambiguous/unowned process: block automatically, do not kill.
- Temporary public errors with live trusted processes: wait and retry bounded checks; don't rotate a working hostname.
- A restart explicitly requested by the operator can rotate the Quick Tunnel, with confirmation.
- The UI must not claim that it has validated the actual ChatGPT-side MCP plugin registration.

## Verification status
- Pure reconciliation tests: 11/11 passing.
- Healthy live reuse: Windows PID of MCP server, cloudflared PID and public MCP URL SHA-256 unchanged after existing controller setup command.
- Process ownership inspection: correct current-account PIDs and live OAuth issuer alignment, direct public GET/metadata/401 validated.
- GUI screenshot and renderer QA on real Windows Electron.
- NOT yet tested: deliberately killing either live production component, full laptop reboot, OS network partitions and ChatGPT-side plugin reauthorization after Quick Tunnel rotation. These need a separate controlled trial; don't claim 100% restoration.
- New supervisor recovery logic exists on disk and applies when that supervisor script next starts, not retroactively to an already-running PowerShell process.
