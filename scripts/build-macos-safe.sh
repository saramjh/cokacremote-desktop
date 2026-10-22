#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd -P)"
ARCH="$1"
VERSION="$2"
TARGET="$ROOT/dist/macos-$ARCH-v$VERSION"
STAGE="$TARGET/stage"
APP="$TARGET/cokacremote Manager.app"
ZIP="$(find "$HOME/Library/Caches/electron" -name "electron-v44.9.1-darwin-$ARCH.zip" -type f | head -1)"
if [[ -e "$TARGET" || -e "$ROOT/release/cokacremote-manager-macos-$ARCH-v$VERSION.zip" ]]; then
  echo "Destination already exists; refuses overwrite" >&2
  exit 1
fi
[[ -s "$ZIP" ]] || { echo "Electron runtime cache unavailable" >&2; exit 1; }
mkdir -p "$STAGE/platform" "$ROOT/release"
cp -R desktop ui core assets "$STAGE/"
cp -R platform/mac "$STAGE/platform/mac"
cp package.json "$STAGE/"
ditto -x -k "$ZIP" "$TARGET"
mv "$TARGET/Electron.app" "$APP"
./node_modules/.bin/asar pack "$STAGE" "$APP/Contents/Resources/app.asar"
/usr/libexec/PlistBuddy -c "Set :CFBundleName cokacremote Manager" "$APP/Contents/Info.plist" >/dev/null
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName cokacremote Manager" "$APP/Contents/Info.plist" >/dev/null
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier io.github.cokacremote.desktop" "$APP/Contents/Info.plist" >/dev/null
cp assets/app-icon.icns "$APP/Contents/Resources/electron.icns"
codesign --force --deep --sign - "$APP" >/dev/null
ditto -c -k --keepParent "$APP" "$ROOT/release/cokacremote-manager-macos-$ARCH-v$VERSION.zip"
shasum -a 256 "$ROOT/release/cokacremote-manager-macos-$ARCH-v$VERSION.zip"
echo MAC_SAFE_BUILD_COMPLETE
