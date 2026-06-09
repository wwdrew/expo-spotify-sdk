#!/usr/bin/env bash
# Spotify iOS xcframework must be present in the npm tarball (fetched before pack).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT

npm pack --dry-run 2>&1 | tee "$LIST"

FAIL=0

if ! grep -q 'SpotifyiOS.xcframework/ios-arm64/SpotifyiOS.framework/SpotifyiOS' "$LIST"; then
  echo "error: npm pack is missing the iOS SpotifyiOS.xcframework binary"
  echo "       run: yarn fetch-native-sdks"
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

echo "verify-npm-pack: ok (Spotify iOS xcframework included)"
