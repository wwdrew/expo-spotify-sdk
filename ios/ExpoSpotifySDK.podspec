require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
spotify_native = JSON.parse(File.read(File.join(__dir__, 'spotify-native-sdk-versions.json')))

ios_sdk = spotify_native['ios']
if ios_sdk.nil? ||
    ios_sdk['version'].to_s.empty? ||
    ios_sdk['binarySha256'].to_s.empty?
  raise "ios/spotify-native-sdk-versions.json is missing required iOS fields: version, binarySha256"
end

xcframework = File.join(__dir__, 'SpotifySDK', 'SpotifyiOS.xcframework')
ios_binary = File.join(xcframework, 'ios-arm64', 'SpotifyiOS.framework', 'SpotifyiOS')
unless File.directory?(xcframework) && File.file?(ios_binary)
  raise <<~MSG
    ExpoSpotifySDK: missing SpotifyiOS.xcframework at #{xcframework}

    npm consumers: reinstall from a published package (the xcframework is bundled in npm).
    git contributors: run `yarn fetch-native-sdks` before `pod install`.
  MSG
end

Pod::Spec.new do |s|
  s.name           = 'ExpoSpotifySDK'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platform       = :ios, '16.4'
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/wwdrew/expo-spotify-sdk' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
  s.exclude_files = "SpotifySDK/SpotifyiOS.xcframework/**/*.h"
  s.vendored_frameworks = "SpotifySDK/SpotifyiOS.xcframework"
end
