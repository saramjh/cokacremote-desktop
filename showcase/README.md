# The connection room — public showcase

Live URL: https://saramjh.github.io/cokacremote-desktop/

This static site is a visual walkthrough of cokacremote's local MCP execution model, authenticated Cloudflare route, and ChatGPT plugin registration workflow.

- No build tooling or trackers. Open `index.html` directly or serve `showcase/` via any static hosting provider.
- `motion.js` contains a finite, deterministic SVG path animation with replay controls and a 3-frame interactive setup storyboard. It is paused when hidden and respects reduced-motion preferences.
- Release chooser explicitly separates Windows v0.3.0 stable from unnotarized Mac v0.4.0-rc.2 preview and links to English and Korean setup guides.
- All status values are **demonstrations**; the page never reads device state, OAuth keys, personal files or installed apps.
- Colors, typography, motion and editorial structure are documented in `DESIGN.md`.
- Links to the official ChatGPT MCP help page and the repository remain external. No approval key is collected.

To preview from the source repository on Windows with Python:

```sh
cd showcase
python -m http.server 8765
# http://127.0.0.1:8765/
```

or open `showcase/index.html` in a browser. For production GitHub Pages, use the source-only artifact from the Pages workflow; configure the repository Pages source to **GitHub Actions**.

The repository currently serves GitHub Pages from its gh-pages branch (legacy mode), despite having a workflow for GitHub Actions mode. Always verify published live HTML after deploying; merging the source branch alone is not proof of publishing.
