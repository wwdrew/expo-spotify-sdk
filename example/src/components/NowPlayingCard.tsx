import { Image, Text, View } from "react-native";

import { SpotifyURI } from "expo-spotify-sdk";

import type { TransportBusy } from "../types";
import { deriveTrackTitle, formatTime } from "../utils/format";
import { TransportBtn } from "./Btn";
import { LibrarySaveButton } from "./LibrarySaveButton";
import { s } from "../styles";

export function NowPlayingCard({
  isConnected,
  currentTrackName,
  currentTrackArtist,
  currentTrackAlbum,
  currentTrackUri,
  currentTrackImageUri,
  currentTrackDurationMs,
  isPlaying,
  playbackPositionMs,
  transportBusy,
  onTogglePlayback,
  onSkipPrevious,
  onSkipNext,
  onPlaybackError,
}: {
  isConnected: boolean;
  currentTrackName: string | null;
  currentTrackArtist: string | null;
  currentTrackAlbum: string | null;
  currentTrackUri: string | null;
  currentTrackImageUri: string | null;
  currentTrackDurationMs: number;
  isPlaying: boolean;
  playbackPositionMs: number;
  transportBusy: TransportBusy;
  onTogglePlayback: () => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
  onPlaybackError: (message: string) => void;
}) {
  const displayTitle = deriveTrackTitle(currentTrackName);
  const hasActiveTrack =
    (currentTrackUri != null && currentTrackUri.trim().length > 0) ||
    (currentTrackName != null && currentTrackName.trim().length > 0);

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Now Playing</Text>
      {!isConnected ? (
        <Text style={s.emptyHint}>Connect App Remote to view player state.</Text>
      ) : !hasActiveTrack ? (
        <Text style={s.emptyHint}>No active track yet.</Text>
      ) : (
        <>
          <View style={s.nowPlayingRow}>
            {currentTrackImageUri ? (
              <Image source={{ uri: currentTrackImageUri }} style={s.nowPlayingArtwork} />
            ) : (
              <View style={[s.nowPlayingArtwork, s.nowPlayingArtworkPlaceholder]}>
                <Text style={s.nowPlayingArtworkIcon}>♪</Text>
              </View>
            )}
            <View style={s.nowPlayingMeta}>
              <Text style={s.profileName} numberOfLines={1}>
                {displayTitle}
              </Text>
              {currentTrackArtist ? (
                <Text style={s.profileMeta} numberOfLines={1}>
                  {currentTrackArtist}
                </Text>
              ) : null}
              {currentTrackAlbum ? (
                <Text style={s.profileMeta} numberOfLines={1}>
                  {currentTrackAlbum}
                </Text>
              ) : null}
              <Text style={s.profileMeta}>
                {isPlaying ? "Playing" : "Paused"} · {formatTime(playbackPositionMs)}
                {currentTrackDurationMs > 0 ? ` / ${formatTime(currentTrackDurationMs)}` : ""}
              </Text>
              {currentTrackUri ? (
                <Text style={s.nowPlayingUri} numberOfLines={1}>
                  {currentTrackUri}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={s.transportRow}>
            <TransportBtn
              label={transportBusy === "previous" ? "…" : "Prev"}
              onPress={onSkipPrevious}
              disabled={transportBusy !== null}
              variant="secondary"
              accessibilityLabel="Skip to previous track"
            />
            <TransportBtn
              label={transportBusy === "toggle" ? "…" : isPlaying ? "Pause" : "Play"}
              onPress={onTogglePlayback}
              disabled={transportBusy !== null}
              variant="primary"
              accessibilityLabel={isPlaying ? "Pause playback" : "Resume playback"}
            />
            <TransportBtn
              label={transportBusy === "next" ? "…" : "Next"}
              onPress={onSkipNext}
              disabled={transportBusy !== null}
              variant="secondary"
              accessibilityLabel="Skip to next track"
            />
          </View>
          {currentTrackUri != null && SpotifyURI.isValid(currentTrackUri) ? (
            <View style={s.librarySaveRow}>
              <LibrarySaveButton uri={SpotifyURI.from(currentTrackUri)} onError={onPlaybackError} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
