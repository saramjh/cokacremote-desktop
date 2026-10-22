#!/usr/bin/env bash
# Zero-extra-cost, local-source macOS installer. No Developer ID or Gatekeeper bypass.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/cokacremote Manager.app"
DEST="$HOME/Applications/cokacremote Manager.app"
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "macOS is required"
[[ "$(uname -m)" == "arm64" ]] || die "This installer targets Apple Silicon"
[[ ! -e "$DEST" ]] || die "Destination already exists; won't replace a user's app: $DEST"

if [[ "${1:-}" != "--use-existing-build" ]]; then
  command -v node >/dev/null || die "Install the free Node.js build tool first"
  command -v npm >/dev/null || die "Install the free npm build tool first"
  command -v cargo >/dev/null || die "Install the free Rust build tool first"
  cd "$ROOT"
  npm ci --no-audit --no-fund
  npm test
  mkdir -p src-tauri/icons
  cp assets/app-icon.icns src-tauri/icons/icon.icns
  sips -z 32 32 assets/app-icon.png --out src-tauri/icons/32x32.png >/dev/null
  APPLE_SIGNING_IDENTITY=- npm run build:tauri -- --target aarch64-apple-darwin --bundles app
fi

[[ -d "$APP" ]] || die "Local build missing: $APP"
codesign --verify --deep --strict "$APP" || die "Local code-signature verification failed"
if xattr -p com.apple.quarantine "$APP" >/dev/null 2>&1; then
  die "Built app unexpectedly has an Internet quarantine flag; refusing to change security attributes."
fi
mkdir -p "$HOME/Applications"
ditto "$APP" "$DEST"
codesign --verify --deep --strict "$DEST" || die "Installed app signature verification failed"
printf 'Installed locally compiled (AD-HOC, UNNOTARIZED) app: %s\n' "$DEST"
printf 'No Gatekeeper settings or quarantine attributes were changed.\n'
open "$DEST"
printf 'Launch requested. Publicly downloaded releases still require Apple notarization or per-app Apple security approval.\n'

