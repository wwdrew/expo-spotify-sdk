#!/usr/bin/env bash
# Spotify native binaries must NOT be in the npm tarball (fetched at app build time).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT

npm pack --dry-run 2>&1 | tee "$LIST"

FAIL=0

if grep -q 'SpotifyiOS.xcframework/ios-arm64/SpotifyiOS.framework/SpotifyiOS' "$LIST"; then
  echo "error: npm pack must not include SpotifyiOS.xcframework"
  FAIL=1
fi

if ! grep -q 'spotify-ios/SpotifyiOS.podspec' "$LIST"; then
  echo "error: npm pack is missing spotify-ios/SpotifyiOS.podspec"
  FAIL=1
fi

if grep -qE 'android/build/' "$LIST"; then
  echo "error: npm pack includes android/build artifacts"
  grep -E 'android/build/' "$LIST" | head -5
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi

echo "verify-npm-pack: ok (no Spotify binaries bundled)"
