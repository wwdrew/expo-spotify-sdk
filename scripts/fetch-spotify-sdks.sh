#!/usr/bin/env bash
# Fetch Spotify native SDK binaries into ios/SpotifySDK/ and android/libs/.
# Run before native dev builds and automatically during prepublishOnly.
#
# Prerequisites: curl, tar, and one of openssl | sha256sum | shasum (for SHA-256).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SPOTIFY_IOS_SDK_VERSION="5.0.1"
SPOTIFY_IOS_SDK_TARBALL_SHA256="acafc07d35ce3f0bce93cac0031cd1cca1ba7ba6647a3e07e123f2e954ec298b"
SPOTIFY_IOS_SDK_SHA256="988704167a3839136c7a4fd83742fca1422dfad48de41354ed07aa8e47611e32"

SPOTIFY_APP_REMOTE_VERSION="0.8.0"
SPOTIFY_APP_REMOTE_TAG="v0.8.0-appremote_v2.1.0-auth"
SPOTIFY_APP_REMOTE_SHA256="b5a6dd880eaf01f63a871cba9ef7af77c341f8a94ffc8fdf2e9021f9a9d4c198"

# Version-bump checklist (also printed when sync_native_refs updates package.json / build.gradle):
#   - [ ] Update SPOTIFY_APP_REMOTE_TAG and SPOTIFY_APP_REMOTE_SHA256 above
#   - [ ] Update SPOTIFY_IOS_SDK_TARBALL_SHA256 and SPOTIFY_IOS_SDK_SHA256 when bumping iOS SDK
#   - [ ] Run yarn fetch-native-sdks && bash scripts/verify-npm-pack.sh
#   - [ ] Update docs (native-sdk-distribution.md, CONTRIBUTING.md) if versions changed

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

inplace_sed() {
  local expr="$1"
  local file="$2"
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i -E -e "${expr}" "${file}"
  else
    sed -i '' -E -e "${expr}" "${file}"
  fi
}

sync_native_refs() {
  local aar_filename="spotify-app-remote-release-${SPOTIFY_APP_REMOTE_VERSION}.aar"
  local aar_path="android/libs/${aar_filename}"
  local pkg_json="${ROOT}/package.json"
  local build_gradle="${ROOT}/android/build.gradle"
  local changed=0

  if ! grep -q "\"${aar_path}\"" "${pkg_json}"; then
    inplace_sed "s|\"android/libs/spotify-app-remote-release-[^\"]+\\.aar\"|\"${aar_path}\"|" "${pkg_json}"
    changed=1
  fi

  if ! grep -q "libs/${aar_filename}" "${build_gradle}"; then
    inplace_sed "s|libs/spotify-app-remote-release-[^']+\\.aar|libs/${aar_filename}|" "${build_gradle}"
    changed=1
  fi

  if [[ "${changed}" -eq 1 ]]; then
    echo "fetch-spotify-sdks: synced Android AAR path to ${aar_path}"
    echo "fetch-spotify-sdks: see version-bump checklist near top of scripts/fetch-spotify-sdks.sh"
  fi
}

fetch_ios() {
  local sdk_dir="${ROOT}/ios/SpotifySDK"
  local version_file="${sdk_dir}/.version"
  local xcframework="${sdk_dir}/SpotifyiOS.xcframework"
  local ios_binary="${xcframework}/ios-arm64/SpotifyiOS.framework/SpotifyiOS"

  if [[ -f "${version_file}" ]] \
    && [[ "$(cat "${version_file}")" == "${SPOTIFY_IOS_SDK_VERSION}" ]] \
    && [[ -d "${xcframework}" ]] \
    && [[ -f "${ios_binary}" ]] \
    && [[ -n "${SPOTIFY_IOS_SDK_SHA256:-}" ]]; then
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
}

fetch_android() {
  local libs_dir="${ROOT}/android/libs"
  local version_file="${libs_dir}/.version"
  local aar="${libs_dir}/spotify-app-remote-release-${SPOTIFY_APP_REMOTE_VERSION}.aar"

  if [[ -f "${version_file}" ]] \
    && [[ "$(cat "${version_file}")" == "${SPOTIFY_APP_REMOTE_VERSION}" ]] \
    && [[ -f "${aar}" ]]; then
    local actual
    actual="$(sha256_file "${aar}")"
    if [[ "${actual}" == "${SPOTIFY_APP_REMOTE_SHA256}" ]]; then
      echo "fetch-spotify-sdks: Android App Remote ${SPOTIFY_APP_REMOTE_VERSION} already present"
      return 0
    fi
  fi

  echo "fetch-spotify-sdks: downloading Android App Remote ${SPOTIFY_APP_REMOTE_VERSION}"
  mkdir -p "${libs_dir}"

  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "${tmp}"' RETURN

  curl -fsSL \
    "https://github.com/spotify/android-sdk/releases/download/${SPOTIFY_APP_REMOTE_TAG}/spotify-app-remote-release-${SPOTIFY_APP_REMOTE_VERSION}.aar" \
    -o "${tmp}"

  local actual
  actual="$(sha256_file "${tmp}")"
  if [[ "${actual}" != "${SPOTIFY_APP_REMOTE_SHA256}" ]]; then
    echo "error: Android App Remote AAR checksum mismatch" >&2
    echo "  expected ${SPOTIFY_APP_REMOTE_SHA256}" >&2
    echo "  actual   ${actual}" >&2
    exit 1
  fi

  mv "${tmp}" "${aar}"
  echo "${SPOTIFY_APP_REMOTE_VERSION}" > "${version_file}"
}

sync_native_refs
fetch_ios
fetch_android
echo "fetch-spotify-sdks: done"
