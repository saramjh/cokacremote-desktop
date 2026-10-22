# Localization architecture

## Supported languages

| Code | Language |
|---|---|
| en | English |
| ko | 한국어 |
| ja | 日本語 |
| zh | 简体中文 |
| es | Español |
| fr | Français |
| de | Deutsch |

The locale menu is integrated into the shared Electron window. Windows and macOS use **the exact same translation resources**; no separate application or MCP service is created by language switching.

## Lifecycle

1. The Electron main process reads `app.getLocale()` for the operating system UI language.
2. A previously selected language is loaded from `ui-preferences.json` in Electron's **per-user data directory**.
3. The pure `resolveLocale(saved,system)` normalizes region codes such as `ko-KR`, `ja-JP`, `es-MX`, `fr-CA`, `de-DE` and `zh-CN`.
4. The renderer translates static `data-i18n` nodes and live recovery/status messages using keys in `ui/locales/*.mjs`.
5. When a user switches language, the renderer updates text immediately and uses the allowlisted `language:set` IPC channel to persist the selection atomically. **No server, browser session, token or tunnel is restarted.**
6. If no supported language is configured, English is the fallback.

## Contribution contract

Every locale exports exactly the same set of keys and interpolation parameters, with explicit `{placeholder}` names. Add a key to **all seven** files and run `npm test` before shipping. The diagnostic state machine returns language-neutral codes; translate only at the presentation boundary. Technical IDs (PID, HTTP status, MCP address and OAuth codes) must remain unchanged.

The language selector is keyboard accessible and uses native select semantics under a custom visual design. Hidden OAuth approval keys stay hidden during normal translation updates; revealing or copying them still requires explicit user interaction.

## Verification

`test/i18n.test.mjs` checks every locale, placeholders, region fallback, static GUI key references and all recovery decision paths. Desktop QA uses the Electron `--qa-language=<code>` flag **only in screenshot mode**, which does not modify user preferences or external services.
