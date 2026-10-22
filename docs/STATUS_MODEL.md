# Component status indicators — shared contract

[Getting started](GETTING_STARTED.md) · [한국어](GETTING_STARTED.ko.md) · [FAQ](TROUBLESHOOTING.md)

Windows and macOS must render the same evidence with **one presentation policy**, `ui/indicator-policy.mjs`, rather than using OS-specific color shortcuts or the Windows Task Scheduler / macOS LaunchAgent state to paint OAuth green or yellow.

| State | Visual | Required evidence | Meaning |
|---|---|---|---|
| Verified | Green | Exact health / owner / OAuth checks passed | This **specific component** was verified |
| Pending verification | Neutral gray | Check skipped, timed out, or evidence incomplete | Not a proven fault; recheck without restarting |
| Needs attention | Amber | Public check failed while tunnel runs; genuine issuer/resource/auth mismatch | Operator should investigate |
| Offline | Red | Component actually absent and unavailable | Service not running |
| Ownership blocked | Red | Running process could not be attributed to this manager | No destructive recovery allowed |

Server green requires a healthy local server **and verified owner**. Tunnel green requires healthy public endpoint, verified owner and validated HTTPS MCP URL. OAuth green requires matching public OAuth authorization-server **issuer**, matching protected resource `.../mcp` **and** anonymous request rejected with HTTP 401. A healthy server is not itself OAuth proof.

**Task status is independent.** A Windows task in `Ready` (rather than `Running`) or a missing Mac launchctl label must not turn three verified component indicators yellow. Auto-start state belongs in its own diagnostic panel.

The macOS probe previously collapsed OAuth network errors and issuer mismatches into `NOT_CHECKED`. It now distinguishes `HEALTHY`, `MISMATCH` and `NOT_CHECKED` for public OAuth metadata; and `AUTH_REQUIRED`, unexpected HTTP result and `NOT_CHECKED` for anonymous authorization. For issuer comparison it matches Windows by ignoring only a terminal slash; it does **not** accept a different hostname or scheme.

Security: A failed test must never silently count as successful. The UI shows neutral pending rather than amber for inconclusive observations and provides specific text for misconfiguration. Inconsistent ChatGPT plugin registration is not inferable from these three local status checks.

Testing:
- `test/indicator-policy.test.mjs`: identical Mac/Windows outputs for identical evidence, task independence, non-owned processes blocked.
- `test/mac-oauth-probe.test.mjs`: Mac metadata issuer normalization, timeout, real mismatch and anonymous 200.
- `test/i18n.test.mjs`: seven-language strings parity.
- macOS v0.4.0-rc.2 has undergone on-device packaged-status sensor checks (local MCP, tunnel and OAuth) and a real GUI window drag test. These checks do **not** establish successful clean-machine installation or ChatGPT registration in every workspace. Repeat clean-machine and signed-distribution tests before calling the release production-ready.
