# Product context — Windows MCP Connection Manager

Audience: Windows users who want to give a trusted ChatGPT MCP client remote access to their own PC, without juggling manual PowerShell consoles.

The job: make the state of the existing cokacremote OAuth MCP service, its Cloudflare Quick Tunnel, and the Windows Scheduled Task observable; preserve healthy processes and URLs, offer deliberate repair, protect the approval key, and explain when human ChatGPT registration is necessary.

Core constraints:
- This UI is NOT a replacement MCP server.
- All operations reuse existing deploy/windows scripts, Node server, Cloudflare tunnel and Task Scheduler.
- Current hardware is sensitive: an unintended tunnel restart invalidates an existing ChatGPT plugin URL.
- OAuth approval key is a privileged secret. Never log, persist in browser storage, or leak it in an error message. Reveal only on explicit interaction.
- Process ownership and real OAuth metadata checks are required, not port-open alone.
- ChatGPT plugin registration is performed in the ChatGPT UI by the owner.
- Prefer minimal repair; no blind restarts or orphan kills.
