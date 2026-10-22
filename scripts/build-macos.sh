#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd -P)"
OUT="$ROOT/dist"
APP="$OUT/cokacremote Manager.app"
STAGE="$OUT/stage"
ARCH="$1"
ZIP="$(find "$HOME/Library/Caches/electron" -name "electron-v44.9.1-darwin-$ARCH.zip" -type f | head -1)"
[[ -s "$ZIP" ]] || { echo "Electron runtime not cached; run npm install first" >&2; exit 1; }
mkdir -p "$OUT" "$STAGE"
rm -rf "$APP" "$STAGE"
mkdir -p "$STAGE"
cp -R desktop ui core assets "$STAGE/"
mkdir -p "$STAGE/platform"
cp -R platform/mac "$STAGE/platform/mac"
cp package.json "$STAGE/"
/usr/bin/ditto -x -k "$ZIP" "$OUT"
mv "$OUT/Electron.app" "$APP"
rm -f "$APP/Contents/Resources/default_app.asar"
./node_modules/.bin/asar pack "$STAGE" "$APP/Contents/Resources/app.asar"
/usr/libexec/PlistBuddy -c "Set :CFBundleName cokacremote Manager" "$APP/Contents/Info.plist" >/dev/null
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName cokacremote Manager" "$APP/Contents/Info.plist" >/dev/null
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier io.github.cokacremote.desktop" "$APP/Contents/Info.plist" >/dev/null
cp assets/app-icon.icns "$APP/Contents/Resources/electron.icns"
codesign --force --deep --sign - "$APP" >/dev/null
rm -rf "$STAGE"
mkdir -p "$ROOT/release"
ditto -c -k --keepParent "$APP" "$ROOT/release/cokacremote-manager-macos-arm64-v0.2.0.zip"
shasum -a 256 "$ROOT/release/cokacremote-manager-macos-arm64-v0.2.0.zip"
echo BUILT_MAC_APP
