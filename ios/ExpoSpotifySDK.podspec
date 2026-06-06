require 'json'

absolute_react_native_path = ''
if !ENV['REACT_NATIVE_PATH'].nil?
  absolute_react_native_path = File.expand_path(ENV['REACT_NATIVE_PATH'], Pod::Config.instance.project_root)
else
  absolute_react_native_path = File.dirname(`node --print "require.resolve('react-native/package.json')"`)
end

unless defined?(spm_dependency)
  require File.join(absolute_react_native_path, "scripts/react_native_pods")
end

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
spotify_native = JSON.parse(File.read(File.join(__dir__, 'spotify-native-sdk-versions.json')))

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

  ios_sdk = spotify_native['ios']
  if ios_sdk.nil? ||
      ios_sdk['spmRepositoryUrl'].to_s.empty? ||
      ios_sdk['spmVersion'].to_s.empty? ||
      ios_sdk['spmProduct'].to_s.empty?
    raise "ios/spotify-native-sdk-versions.json is missing required iOS fields: spmRepositoryUrl, spmVersion, spmProduct"
  end

  spm_dependency(s,
    url: ios_sdk['spmRepositoryUrl'],
    requirement: { kind: 'exactVersion', version: ios_sdk['spmVersion'] },
    products: [ios_sdk['spmProduct']]
  )
end
