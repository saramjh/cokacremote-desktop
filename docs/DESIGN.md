# Visual system — Connection workbench

## Intent
A purposeful *infrastructure control instrument* rather than generic SaaS administration cards. The first task is understanding the path PC → MCP server → Cloudflare Quick Tunnel → OAuth gate. Actions appear only after the live topology and recommended recovery state.

## Palette
- graphite-petrol #10282D: topology/host foundation
- deep-teal #1D776F: actionable verified operations
- mineral-paper #F4F5F0: legible workspace
- graphite-ink #183034: informational content
- signal-amber #AE7534: attention needed, but not failure
- muted terracotta #A64F3C: blocked or destructive path

Semantic, not ornamental. Green indicates a **verified** healthy service, amber indicates incomplete verification. The color is always reinforced in text.

## Typography
Workbench/Bahnschrift (DIN-like instrument notation, on Windows install), Noto Sans KR for Korean content. Do not use OS-default UI widget chrome, emoji, generic icon glyphs or external font CDN. This works offline on the target Windows image.

## Layout
An operator's machine topology in a fixed dark rail; a separate pale analysis surface contains decision, component health and secure connection coordinates. No repeated KPI card grid; rows are intentionally distinct systems and the banner is the single strong focal element. Custom line SVG icons, custom controls, semantic button states. Reduced-motion preference respected.

## Interaction
- Periodic complete validation every 45 seconds and explicit recheck on request.
- The "repair" control does not act when everything is healthy.
- Existing PID/URL are displayed and preserved whenever possible.
- An unknown process owner is a hard block.
- Transient external check failure waits without rotating a tunnel.
- Sensitive approval key is hidden by default, revealed for 15 seconds only on click, copied locally only on click.
- Explicit confirmation before force restart (URL rotation) and stop.
- Closing the manager leaves the owned Windows scheduled task running.
- ChatGPT registration is human action; status does not imply plugin connected.

## Testing
Source under ui/, desktop Electron main + isolated preload. Screenshot reviewed on target Windows at 1160×785, skill-derived contrast feedback incorporated. No remote imagery/assets or external fonts are bundled.
