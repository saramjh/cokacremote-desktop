# Connect cokacremote to ChatGPT

This is a user guide for an **owner-operated** remote MCP server. The desktop manager does not log into ChatGPT or register a plugin automatically. The account owner makes that decision inside ChatGPT.

## What runs where

```text
Your computer                       Internet                 ChatGPT web
┌─────────────────────┐              ┌──────────┐              ┌────────────┐
│ cokacremote server │─ OAuth/HTTPS→│cloudflared│─────────────→│ MCP plugin │
│ Desktop Manager    │              │Quick Tunnel│             │ Your account│
└─────────────────────┘              └──────────┘              └────────────┘
```

Your local computer runs the tools. `cloudflared` provides a temporary public HTTPS route. OAuth authorizes access to the server. ChatGPT uses the MCP endpoint after you create and approve the connection.

## Before connecting

1. Install the desktop manager from [Releases](https://github.com/saramjh/cokacremote-desktop/releases). For macOS, read [macOS Gatekeeper guidance](./MACOS_SECURITY.md).
2. In the manager, confirm **local MCP**, **Quick Tunnel**, and **OAuth** status. The public endpoint generally looks like `https://EXAMPLE.trycloudflare.com/mcp`. Copy the **actual** address from your own manager; example addresses cannot connect.
3. Make sure this is your own machine, and review the capabilities exposed by the upstream [kstost/cokacremote](https://github.com/kstost/cokacremote) server. MCP tools can be powerful enough to execute code and change files.
4. Keep the OAuth approval key secret. It is intended for the **OAuth approval page**, not for ChatGPT chat messages, bug reports, or screenshots.

## Register the MCP server in ChatGPT

Current ChatGPT interfaces and account/workspace permissions can change. Consult [OpenAI's current custom MCP server guide](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt) for account-specific availability.

1. Open [ChatGPT on the web](https://chatgpt.com/) and open **Plugins**.
2. In the Plugins interface, choose the option to **add a custom MCP server**. Availability is governed by your plan/workspace and permissions; if the option is absent, you cannot force it from the manager.
3. Name the connection `cokacremote`. Enter the **HTTPS MCP endpoint** copied from the manager, including `/mcp`.
4. Choose the supported authentication flow for your server. **Review the requested permissions and tools** before continuing.
5. Complete OAuth authorization through the browser flow. Supply the approval key **only if the legitimate cokacremote OAuth screen requests it**.
6. Confirm the connector is enabled in ChatGPT and the tool scan/authorization completes.
7. In a new conversation, select the connected plugin if required by your UI. Start with a **read-only** test like “Check which MCP tools are available” or “Read a harmless status file” before requesting any write or shell action.

**Important:** A healthy MCP server and HTTP 401 for an anonymous request prove that the local endpoint is alive and protected. They **do not** prove that ChatGPT has installed, approved, or activated the connector. Check that in ChatGPT.

## If the URL changes

Cloudflare Quick Tunnel hostnames are temporary. Recreating a tunnel often generates a new hostname, which may invalidate a ChatGPT registration or OAuth issuer. **Do not restart a healthy tunnel just to refresh the UI.** If the hostname actually changes, update the ChatGPT plugin's endpoint and authorize again as required.

## Troubleshooting

| Symptom | What to verify |
|---|---|
| Plugin creation option not visible | Account/workspace eligibility, permissions and current Plugins UI |
| Tool scan fails | Public HTTPS endpoint reachable, path ends in `/mcp`, supported protocol and OAuth metadata |
| OAuth mismatch | Discovery issuer equals the current public tunnel origin; old Quick Tunnel URL not cached |
| Manager says “healthy”, ChatGPT cannot call | ChatGPT-side plugin enablement, authorization and tool permissions |
| Network goes offline | Both your machine and `cloudflared` must remain running; laptop sleep stops access |
| Security prompt on macOS | Check signature/notarization and publisher; see [macOS security](./MACOS_SECURITY.md) |

## Privacy and operational safety

Do not expose an unauthenticated local execution server to the public Internet. Avoid sharing an approval key in screenshots or support logs. Only install dependencies after explicitly reviewing the publisher and required privileges. The manager does not bypass CAPTCHA, ChatGPT account permissions, or operating system security checks.

See the [interactive product showcase](../showcase/index.html) and [dependency preparation design](./DEPENDENCIES.md).
