import Foundation
import SpotifyiOS
import UIKit

/// Serializes Spotify App Remote SDK objects into NSDictionary-compatible payloads
/// for the Expo JS bridge.
enum SpotifyAppRemoteMappers {
  static func playerStateToMap(_ state: any SPTAppRemotePlayerState) -> [String: Any] {
    let track = state.track
    let restrictions = state.playbackRestrictions
    let options = state.playbackOptions
    return [
      "track": [
        "uri": track.uri,
        "name": track.name,
        "imageIdentifier": track.imageIdentifier,
        "duration": track.duration,
        "artist": ["name": track.artist.name, "uri": track.artist.uri],
        "album": ["name": track.album.name, "uri": track.album.uri],
        "isSaved": track.isSaved,
        "isEpisode": track.isEpisode,
        "isPodcast": track.isPodcast,
        "isAdvertisement": track.isAdvertisement,
      ] as [String: Any],
      "playbackPosition": state.playbackPosition,
      "playbackSpeed": state.playbackSpeed,
      "isPaused": state.isPaused,
      "playbackOptions": [
        "isShuffling": options.isShuffling,
        "repeatMode": options.repeatMode.rawValue,
      ] as [String: Any],
      "playbackRestrictions": [
        "canSkipNext": restrictions.canSkipNext,
        "canSkipPrevious": restrictions.canSkipPrevious,
        "canRepeatTrack": restrictions.canRepeatTrack,
        "canRepeatContext": restrictions.canRepeatContext,
        "canToggleShuffle": restrictions.canToggleShuffle,
        "canSeek": restrictions.canSeek,
      ] as [String: Any],
      "contextTitle": state.contextTitle,
      "contextUri": state.contextURI.absoluteString,
    ]
  }

  static func capabilitiesToMap(_ capabilities: any SPTAppRemoteUserCapabilities) -> [String: Any] {
    ["canPlayOnDemand": capabilities.canPlayOnDemand]
  }

  static func libraryStateToMap(_ state: any SPTAppRemoteLibraryState) -> [String: Any] {
    ["uri": state.uri, "isAdded": state.isAdded, "canAdd": state.canAdd]
  }

  static func mapContentType(_ type: String) -> String {
    switch type {
    case "navigation": return SPTAppRemoteContentTypeNavigation
    case "fitness": return SPTAppRemoteContentTypeFitness
    case "gaming": return SPTAppRemoteContentTypeGaming
    default: return SPTAppRemoteContentTypeDefault
    }
  }

  static func mapImageSize(_ size: String) -> CGSize {
    switch size {
    case "small": return CGSize(width: 64, height: 64)
    case "medium": return CGSize(width: 300, height: 300)
    default: return CGSize(width: 640, height: 640)
    }
  }

  static func contentItemToMap(_ item: any SPTAppRemoteContentItem) -> [String: Any] {
    var map: [String: Any] = [
      "title": item.title as Any,
      "subtitle": item.subtitle as Any,
      "contentDescription": item.contentDescription as Any,
      "identifier": item.identifier,
      "uri": item.uri,
      "imageIdentifier": item.imageIdentifier,
      "isAvailableOffline": item.isAvailableOffline,
      "isPlayable": item.isPlayable,
      "isContainer": item.isContainer,
      "isPinned": item.isPinned,
    ]
    if let children = item.children {
      map["children"] = children.map(contentItemToMap)
    }
    return map
  }
}
