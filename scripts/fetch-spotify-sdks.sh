#!/usr/bin/env bash
# Fetch Spotify native SDK binaries into ios/SpotifySDK/ and android/libs/.
# Run before native dev builds and automatically during prepublishOnly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SPOTIFY_IOS_SDK_VERSION="5.0.1"
SPOTIFY_IOS_SDK_TARBALL_SHA256="acafc07d35ce3f0bce93cac0031cd1cca1ba7ba6647a3e07e123f2e954ec298b"

SPOTIFY_APP_REMOTE_VERSION="0.8.0"
SPOTIFY_APP_REMOTE_TAG="v0.8.0-appremote_v2.1.0-auth"
SPOTIFY_APP_REMOTE_SHA256="b5a6dd880eaf01f63a871cba9ef7af77c341f8a94ffc8fdf2e9021f9a9d4c198"

sha256_file() {
  openssl dgst -sha256 -hex "$1" | awk '{print $2}'
}

fetch_ios() {
  local sdk_dir="${ROOT}/ios/SpotifySDK"
  local version_file="${sdk_dir}/.version"
  local xcframework="${sdk_dir}/SpotifyiOS.xcframework"

  if [[ -f "${version_file}" ]] \
    && [[ "$(cat "${version_file}")" == "${SPOTIFY_IOS_SDK_VERSION}" ]] \
    && [[ -d "${xcframework}" ]]; then
    echo "fetch-spotify-sdks: iOS ${SPOTIFY_IOS_SDK_VERSION} already present"
    return 0
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

fetch_ios
fetch_android
echo "fetch-spotify-sdks: done"
