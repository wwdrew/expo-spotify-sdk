require 'json'

pins = JSON.parse(File.read(File.join(__dir__, '..', 'ios', 'spotify-native-sdk-versions.json')))['ios']
version = pins['version']
tag = "v#{version}"

Pod::Spec.new do |s|
  s.name             = 'SpotifyiOS'
  s.version          = version
  s.summary          = 'Spotify iOS SDK (binary pod for @wwdrew/expo-spotify-sdk)'
  s.homepage         = 'https://github.com/spotify/ios-sdk'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'Spotify'
  s.platform         = :ios, '16.4'
  s.static_framework = true

  s.source = {
    :http => "https://github.com/spotify/ios-sdk/archive/refs/tags/#{tag}.tar.gz",
  }

  s.prepare_command = <<-CMD
    set -e
    if [ ! -d SpotifyiOS.xcframework ]; then
      framework="$(find . -name 'SpotifyiOS.xcframework' -type d | head -1)"
      test -n "$framework"
      mv "$framework" .
    fi
    if [ ! -d Licenses ]; then
      licenses="$(find . -path '*/Licenses' -type d | head -1)"
      if [ -n "$licenses" ]; then mv "$licenses" .; fi
    fi
    find . -mindepth 1 -maxdepth 1 ! -name 'SpotifyiOS.xcframework' ! -name 'Licenses' -exec rm -rf {} +
  CMD

  s.vendored_frameworks = 'SpotifyiOS.xcframework'
  s.preserve_paths = 'Licenses'
end
