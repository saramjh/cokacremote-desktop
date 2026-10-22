# Design direction — the signal room

**Reading:** a technical product showcase for developers and personal automation operators, styled as a compact industrial control room rather than a SaaS marketing template.

Design disciplines consulted: `frontend-design`, `design-taste-frontend`, `hyperframes-animation`, and `design-system` skill guidance on the connected Windows host. The requested **Mac-local design skills could not be accessed** while its MCP connection was unavailable; this is a documented fallback, not a claim they were used.

## Design tokens
- Deep maritime ink `#122832`: host/runtime; maps and structural surfaces.
- Soft mineral gray `#e8eeec`: reading areas.
- Oxidized teal `#26645f`: grounded operations.
- Signal mint `#65d4c4`: verified path, focus, activity.
- Restrained amber `#eea67c`: review / manual authorization.

Space Grotesk shapes product headlines; DM Mono labels machine/state data. Both are served from Google Fonts when available; system fallbacks keep a usable offline page. No stock illustrations, emoji iconography, decorative gradient cards or dark-purple AI treatment.

## Storyboard
- **Hero:** one restrained path animation carrying a single authenticated packet from local node to tunnel to ChatGPT. Approximately 6.6 seconds, auto-plays once when visible and offers Replay. No infinite flashing or fake "connected" claim.
- **Anatomy:** three physical components arranged as a shared sequence, without false success metrics.
- **Setup preview:** exactly three manually selectable frames showing inspect → approve → connect; scoped tab keyboard navigation and clear "illustration only" labeling.
- **Connection guide:** exact user actions and a visibly fake example endpoint; no user token input.
- **Trust boundary:** fail-closed behavior, incomplete public checks, Gatekeeper warnings.
- **Motion:** requestAnimationFrame moves an SVG marker along a deterministic path; reduced-motion users see a static completed state. No external animation dependencies.

The product avoids three equal feature cards and generic pricing grid. One moving signal is the hero; the rest is intentionally calm.
