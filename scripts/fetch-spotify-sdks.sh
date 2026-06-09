#!/usr/bin/env bash
# Fetch Spotify iOS xcframework into ios/SpotifySDK/ for npm packaging.
# Run before native iOS dev builds and automatically during prepublishOnly.
#
# Android App Remote is downloaded at Gradle build time (android/spotify-native-sdk.gradle).
#
# Prerequisites: curl, tar, node, and one of openssl | sha256sum | shasum (for SHA-256).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSIONS_JSON="${ROOT}/ios/spotify-native-sdk-versions.json"

read_ios_pins() {
  local node_script="
    const v = require('${VERSIONS_JSON}').ios;
    if (!v?.version || !v?.tarballSha256 || !v?.binarySha256) {
      console.error('ios/spotify-native-sdk-versions.json missing ios.version, tarballSha256, or binarySha256');
      process.exit(1);
    }
    console.log([v.version, v.tarballSha256, v.binarySha256].join('\t'));
  "
  local line
  line="$(node -e "${node_script}")"
  IFS=$'\t' read -r SPOTIFY_IOS_SDK_VERSION SPOTIFY_IOS_SDK_TARBALL_SHA256 SPOTIFY_IOS_SDK_SHA256 <<< "${line}"
}

# Version-bump checklist:
#   - [ ] Update ios.version, tarballSha256, binarySha256 in spotify-native-sdk-versions.json
#   - [ ] Run yarn fetch-native-sdks && bash scripts/verify-npm-pack.sh
#   - [ ] Update docs if versions changed

sha256_file() {
  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 -hex "$1" | awk '{print $2}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "error: sha256_file requires openssl, sha256sum, or shasum" >&2
    exit 1
  fi
}

fetch_ios() {
  read_ios_pins

  local sdk_dir="${ROOT}/ios/SpotifySDK"
  local version_file="${sdk_dir}/.version"
  local xcframework="${sdk_dir}/SpotifyiOS.xcframework"
  local ios_binary="${xcframework}/ios-arm64/SpotifyiOS.framework/SpotifyiOS"

  if [[ -f "${version_file}" ]] \
    && [[ "$(cat "${version_file}")" == "${SPOTIFY_IOS_SDK_VERSION}" ]] \
    && [[ -d "${xcframework}" ]] \
    && [[ -f "${ios_binary}" ]]; then
    local actual
    actual="$(sha256_file "${ios_binary}")"
    if [[ "${actual}" == "${SPOTIFY_IOS_SDK_SHA256}" ]]; then
      echo "fetch-spotify-sdks: iOS ${SPOTIFY_IOS_SDK_VERSION} already present"
      return 0
    fi
  fi

  echo "fetch-spotify-sdks: downloading iOS SDK ${SPOTIFY_IOS_SDK_VERSION}"
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "${tmpdir}"' RETURN

  local archive="${tmpdir}/spotify-ios-sdk.tar.gz"
  curl -fsSL \
    "https://github.com/spotify/ios-sdk/archive/refs/tags/v${SPOTIFY_IOS_SDK_VERSION}.tar.gz" \
    -o "${archive}"

  local actual
  actual="$(sha256_file "${archive}")"
  if [[ "${actual}" != "${SPOTIFY_IOS_SDK_TARBALL_SHA256}" ]]; then
    echo "error: iOS SDK tarball checksum mismatch" >&2
    echo "  expected ${SPOTIFY_IOS_SDK_TARBALL_SHA256}" >&2
    echo "  actual   ${actual}" >&2
    exit 1
  fi

  tar -xzf "${archive}" -C "${tmpdir}"
  mkdir -p "${sdk_dir}"
  rm -rf "${xcframework}" "${sdk_dir}/Licenses"
  mv "${tmpdir}/ios-sdk-${SPOTIFY_IOS_SDK_VERSION}/SpotifyiOS.xcframework" "${sdk_dir}/"
  mv "${tmpdir}/ios-sdk-${SPOTIFY_IOS_SDK_VERSION}/Licenses" "${sdk_dir}/"
  echo "${SPOTIFY_IOS_SDK_VERSION}" > "${version_file}"

  actual="$(sha256_file "${ios_binary}")"
  if [[ "${actual}" != "${SPOTIFY_IOS_SDK_SHA256}" ]]; then
    echo "error: iOS SDK binary checksum mismatch" >&2
    echo "  expected ${SPOTIFY_IOS_SDK_SHA256}" >&2
    echo "  actual   ${actual}" >&2
    exit 1
  fi
}

fetch_ios
echo "fetch-spotify-sdks: done"
