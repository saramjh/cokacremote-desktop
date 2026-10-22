# Upstream provenance and compatibility

## Original project

- Upstream: [kstost/cokacremote](https://github.com/kstost/cokacremote)
- Role: MCP server, MCP remote execution tools, Streamable HTTP transport and OAuth 2.1
- License: MIT (copyright 2026 cokacremote contributors)
- Independent desktop extension: [saramjh/cokacremote-desktop](https://github.com/saramjh/cokacremote-desktop)

This project is a separately maintained desktop UI and service-management extension, **not** the official upstream desktop release. It integrates with and may redistribute or adapt parts of cokacremote. Preserve the upstream license and copyright when redistributing portions of that project.

## Upstream compatibility policy

The extension and upstream have independent histories and release cycles. GitHub does not currently identify this repository as an upstream fork. A GitHub Fork relationship would imply a shared source ancestry and development workflow that this independently structured desktop project does not have.

For any upstream server update:

1. Record the upstream repository commit or release tag being integrated.
2. Review MCP endpoints, authorization flows, configuration variables, process scripts and dependency changes.
3. Verify Windows and macOS adapters independently.
4. Preserve existing healthy MCP and Quick Tunnel processes during normal setup; quarantine ownership or result uncertainty.
5. Rebuild native releases and verify that user credentials, OAuth state, log files and private keys are absent.
6. Update README and release notes with the tested upstream version.

**Current limitation:** Existing v0.2.x desktop releases do not declare a pinned upstream commit. They must not be described as compatible with every future upstream revision. A tested, immutable upstream-version manifest should be added before automated server upgrades.

## Licenses

The upstream [MIT LICENSE](https://github.com/kstost/cokacremote/blob/main/LICENSE) and its copyright notice are retained in this repository's [LICENSE](LICENSE) alongside the desktop extension's copyright notice. The MIT license permits modification and redistribution subject to its terms.

When reporting upstream bugs, direct core server issues to the upstream project. Report desktop installer, GUI, Windows/macOS supervisor or tunnel-recovery issues in this repository.
