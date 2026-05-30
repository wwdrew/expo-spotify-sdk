#!/usr/bin/env bash
set -euo pipefail

JAVA_ROOT="example/android/app/src/main/java"
EXPECTED_PKG="expo.modules.spotifysdk.example"

if [[ ! -d "$JAVA_ROOT" ]]; then
  echo "verify-example-android-package: skip — $JAVA_ROOT not found"
  exit 0
fi

if [[ -d "$JAVA_ROOT/com" ]]; then
  echo "error: stale com/ package tree under $JAVA_ROOT (expected only $EXPECTED_PKG)"
  echo "       delete example/android/app/src/main/java/com and regenerate with npx expo prebuild if needed"
  exit 1
fi

while IFS= read -r -d '' file; do
  if ! head -1 "$file" | grep -q "package ${EXPECTED_PKG}$"; then
    echo "error: $file must declare 'package ${EXPECTED_PKG}'"
    exit 1
  fi
done < <(find "$JAVA_ROOT" -name '*.kt' -print0)

echo "verify-example-android-package: ok ($EXPECTED_PKG)"
