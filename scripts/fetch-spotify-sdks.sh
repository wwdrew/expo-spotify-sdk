#!/usr/bin/env bash
# Convenience wrapper for local iOS development (Android uses Gradle download).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "${ROOT}/ios/fetch-spotify-ios-sdk.sh"
