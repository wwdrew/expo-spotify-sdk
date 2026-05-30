import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppRemote,
  Auth,
  AuthError,
  Content,
  type ContentItem,
  Images,
  Player,
  type SpotifySession,
  SpotifyURI,
  useConnectionState,
  useCurrentTrack,
  useIsPlaying,
  usePlaybackPosition,
} from "expo-spotify-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchProfile } from "../api/spotifyWebApi";
import { BrowseCard } from "../components/BrowseCard";
import { Btn } from "../components/Btn";
import { ConnectButton } from "../components/ConnectButton";
import { ConnectionActions } from "../components/ConnectionActions";
import { NowPlayingCard } from "../components/NowPlayingCard";
import { ProfileCard } from "../components/ProfileCard";
import { SessionCard } from "../components/SessionCard";
import {
  SCOPES,
  STORED_SESSION_KEY,
  TOKEN_REFRESH_URL,
  TOKEN_SWAP_URL,
  USE_TOKEN_SWAP,
} from "../constants";
import { s } from "../styles";
import { C } from "../theme";
import type { BrowseBusy, Busy, SpotifyProfile, TransportBusy } from "../types";
import { formatAccountTier, formatSpotifyError, sleep } from "../utils/format";

export function HomeScreen() {
  const connectionState = useConnectionState();
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const playbackPositionMs = usePlaybackPosition();
  const [positionAnchor, setPositionAnchor] = useState<{ positionMs: number; capturedAt: number }>({
    positionMs: 0,
    capturedAt: 0,
  });
  const [clockTick, setClockTick] = useState(0);
  const nowMsRef = useRef(0);

  const [session, setSession] = useState<SpotifySession | null>(null);
  const [hasHydratedSession, setHasHydratedSession] = useState(false);
  const [isRestoredSession, setIsRestoredSession] = useState(false);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [transportBusy, setTransportBusy] = useState<TransportBusy>(null);
  const [browseBusy, setBrowseBusy] = useState<BrowseBusy>(null);
  const [browseItems, setBrowseItems] = useState<ContentItem[]>([]);
  const [browseTrail, setBrowseTrail] = useState<string[]>([]);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [nowPlayingImageUri, setNowPlayingImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accountTier = formatAccountTier(profile?.product);
  const [hasAttemptedAutoReconnect, setHasAttemptedAutoReconnect] = useState(false);

  useEffect(() => {
    const sub = Auth.addListener("sessionChange", (event) => {
      if (event.type === "didFail") {
        console.warn("[SpotifySDK]", event.error.code, event.error.message);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORED_SESSION_KEY)
      .then((raw) => {
        if (!active || raw == null) return;
        const parsed = JSON.parse(raw) as SpotifySession;
        if (!parsed.accessToken || !parsed.expirationDate) return;
        setSession(parsed);
        setIsRestoredSession(true);
      })
      .catch(() => {
        // Ignore persistence decode/read errors for this demo.
      })
      .finally(() => {
        if (active) setHasHydratedSession(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    nowMsRef.current = Date.now();
    setPositionAnchor({ positionMs: playbackPositionMs, capturedAt: nowMsRef.current });
  }, [playbackPositionMs, currentTrack?.uri, isPlaying]);

  useEffect(() => {
    if (connectionState !== "connected" || currentTrack == null || !isPlaying) {
      return;
    }
    const timer = setInterval(() => {
      nowMsRef.current = Date.now();
      setClockTick((v) => v + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [connectionState, currentTrack?.uri, isPlaying]);

  const displayPlaybackMs = useMemo(() => {
    if (connectionState !== "connected" || currentTrack == null) return 0;
    if (!isPlaying) return positionAnchor.positionMs;

    const elapsedMs = nowMsRef.current - positionAnchor.capturedAt;
    const durationMs = currentTrack.duration ?? 0;
    if (durationMs > 0) {
      return Math.min(positionAnchor.positionMs + elapsedMs, durationMs);
    }
    return positionAnchor.positionMs + elapsedMs;
  }, [clockTick, connectionState, currentTrack, isPlaying, positionAnchor]);

  const attemptedAutoRefreshRef = useRef<number | null>(null);

  const loadProfile = useCallback(async (token: string) => {
    setProfile(null);
    setBusy("profile");
    try {
      const p = await fetchProfile(token);
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setBusy(null);
    }
  }, []);

  const persistSession = useCallback(async (next: SpotifySession) => {
    await AsyncStorage.setItem(STORED_SESSION_KEY, JSON.stringify(next));
  }, []);

  async function handleConnect() {
    setError(null);
    setBusy("auth");
    try {
      const s = await Auth.authenticate({
        scopes: SCOPES,
        ...(USE_TOKEN_SWAP
          ? {
              tokenSwapURL: TOKEN_SWAP_URL,
              tokenRefreshURL: TOKEN_REFRESH_URL,
            }
          : {}),
      });
      setSession(s);
      setIsRestoredSession(false);
      setHasAttemptedAutoReconnect(false);
      await persistSession(s);
      await loadProfile(s.accessToken);
    } catch (e) {
      if (e instanceof AuthError && e.code === "USER_CANCELLED") return;
      setError(formatSpotifyError(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleRefresh() {
    if (!session?.refreshToken) return;
    setError(null);
    setBusy("refresh");
    try {
      const s = await Auth.refresh({
        refreshToken: session.refreshToken,
        tokenRefreshURL: TOKEN_REFRESH_URL,
        scopes: session.scopes,
      });
      setSession(s);
      setIsRestoredSession(false);
      setHasAttemptedAutoReconnect(false);
      await persistSession(s);
      await loadProfile(s.accessToken);
    } catch (e) {
      setError(formatSpotifyError(e));
    } finally {
      setBusy(null);
    }
  }

  function handleDisconnect() {
    void AppRemote.disconnect().catch(() => {
      // Ignore remote disconnect failures for local teardown.
    });
    void AsyncStorage.removeItem(STORED_SESSION_KEY).catch(() => {
      // Ignore storage cleanup errors for this demo.
    });
    setSession(null);
    setIsRestoredSession(false);
    setHasAttemptedAutoReconnect(false);
    setProfile(null);
    setBrowseItems([]);
    setBrowseTrail([]);
    setSelectedImageUri(null);
    setError(null);
  }

  async function handleConnectRemote() {
    if (session == null) return;
    setError(null);
    const retryDelaysMs = [0, 600, 1200];

    for (let i = 0; i < retryDelaysMs.length; i += 1) {
      if (retryDelaysMs[i] > 0) {
        await sleep(retryDelaysMs[i]);
      }

      if (i === 0) {
        void Linking.openURL("spotify://").catch(() => {
          // Ignore wake-up failures and still attempt a direct connect.
        });
        await sleep(450);
      }

      try {
        await AppRemote.connect(session.accessToken);
        return;
      } catch (e) {
        const isLastAttempt = i === retryDelaysMs.length - 1;
        if (isLastAttempt) {
          setError(formatSpotifyError(e));
        }
      }
    }
  }

  useEffect(() => {
    if (!hasHydratedSession) return;
    if (session == null) return;
    if (!isRestoredSession) return;
    if (connectionState !== "disconnected") return;
    if (hasAttemptedAutoReconnect) return;

    setHasAttemptedAutoReconnect(true);
    void AppRemote.connect(session.accessToken).catch(() => {
      // Keep manual connect available if auto-reconnect fails.
    });
  }, [connectionState, hasAttemptedAutoReconnect, hasHydratedSession, isRestoredSession, session]);

  useEffect(() => {
    if (session == null) return;
    if (busy !== null) return;
    if (session.expirationDate > Date.now()) return;
    if (!session.refreshToken) return;
    if (attemptedAutoRefreshRef.current === session.expirationDate) return;

    attemptedAutoRefreshRef.current = session.expirationDate;
    void handleRefresh();
  }, [busy, handleRefresh, session]);

  useEffect(() => {
    if (session?.accessToken) {
      void loadProfile(session.accessToken);
    }
  }, [loadProfile, session?.accessToken]);

  useEffect(() => {
    if (connectionState !== "connected" || currentTrack?.imageIdentifier == null) {
      setNowPlayingImageUri(null);
      return;
    }

    let active = true;
    void Images.load(currentTrack, "large")
      .then((image) => {
        if (!active) return;
        setNowPlayingImageUri(image.uri);
      })
      .catch(() => {
        if (!active) return;
        setNowPlayingImageUri(null);
      });

    return () => {
      active = false;
    };
  }, [connectionState, currentTrack]);

  async function handleTogglePlayback() {
    setTransportBusy("toggle");
    setError(null);
    try {
      if (isPlaying) {
        await Player.pause();
      } else {
        await Player.resume();
      }
    } catch (e) {
      setError(formatSpotifyError(e));
    } finally {
      setTransportBusy(null);
    }
  }

  async function handleSkipPrevious() {
    setTransportBusy("previous");
    setError(null);
    try {
      await Player.skipPrevious();
    } catch (e) {
      setError(formatSpotifyError(e));
    } finally {
      setTransportBusy(null);
    }
  }

  async function handleSkipNext() {
    setTransportBusy("next");
    setError(null);
    try {
      await Player.skipNext();
    } catch (e) {
      setError(formatSpotifyError(e));
    } finally {
      setTransportBusy(null);
    }
  }

  async function handleDisconnectRemote() {
    setError(null);
    try {
      await AppRemote.disconnect();
    } catch (e) {
      setError(formatSpotifyError(e));
    }
  }

  async function handleLoadBrowseRoot() {
    setBrowseBusy("root");
    setError(null);
    try {
      const items = await Content.getRecommendedContentItems("default");
      setBrowseItems(items);
      setBrowseTrail(["Recommended"]);
    } catch (e) {
      setError(formatSpotifyError(e));
    } finally {
      setBrowseBusy(null);
    }
  }

  async function handleOpenContentItem(item: ContentItem) {
    setError(null);

    if (item.imageIdentifier) {
      try {
        const image = await Images.load(item, "medium");
        setSelectedImageUri(image.uri);
      } catch {
        setSelectedImageUri(null);
      }
    } else {
      setSelectedImageUri(null);
    }

    if (item.isPlayable && SpotifyURI.isValid(item.uri)) {
      try {
        await Player.play(SpotifyURI.unsafe(item.uri));
      } catch (e) {
        setError(formatSpotifyError(e));
      }
      return;
    }

    if (item.isContainer) {
      setBrowseBusy("children");
      try {
        const children = await Content.getChildren(item);
        setBrowseItems(children);
        setBrowseTrail((prev) => [...prev, item.title ?? "Untitled"]);
      } catch (e) {
        setError(formatSpotifyError(e));
      } finally {
        setBrowseBusy(null);
      }
    }
  }

  const connectionLabel = useMemo(() => {
    switch (connectionState) {
      case "connected":
        return "Connected to Spotify App Remote";
      case "connecting":
        return "Connecting to Spotify App Remote…";
      default:
        return "Disconnected from Spotify App Remote";
    }
  }, [connectionState]);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} bounces={false}>
        <View style={s.header}>
          <Text style={s.title}>expo-spotify-sdk</Text>
          <Text style={s.subtitle}>Auth + App Remote demo</Text>
        </View>

        <View style={s.badgeRow}>
          <View style={[s.dot, { backgroundColor: Auth.isAvailable() ? C.green : C.muted }]} />
          <Text style={s.badgeText}>
            {Auth.isAvailable() ? "Spotify app detected" : "Spotify app not installed"}
          </Text>
        </View>
        <Text style={s.connectionText}>{connectionLabel}</Text>
        {session !== null && (
          <Text style={s.connectionText}>Account tier: {accountTier}</Text>
        )}

        {error !== null && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {session === null ? (
          <ConnectButton onPress={handleConnect} loading={busy === "auth"} />
        ) : (
          <>
            {busy === "profile" ? (
              <ActivityIndicator color={C.green} style={{ marginVertical: 24 }} />
            ) : profile !== null ? (
              <ProfileCard profile={profile} />
            ) : null}

            <SessionCard session={session} />
            {isRestoredSession && (
              <Text style={s.restoreHint}>Session restored from local storage.</Text>
            )}

            <ConnectionActions
              connectionState={connectionState}
              onConnect={handleConnectRemote}
              onDisconnect={handleDisconnectRemote}
            />

            <NowPlayingCard
              isConnected={connectionState === "connected"}
              currentTrackName={currentTrack?.name?.trim() ? currentTrack.name : null}
              currentTrackArtist={currentTrack?.artist?.name ?? null}
              currentTrackAlbum={currentTrack?.album?.name ?? null}
              currentTrackUri={currentTrack?.uri ?? null}
              currentTrackImageUri={nowPlayingImageUri}
              currentTrackDurationMs={currentTrack?.duration ?? 0}
              isPlaying={isPlaying}
              playbackPositionMs={displayPlaybackMs}
              transportBusy={transportBusy}
              onTogglePlayback={handleTogglePlayback}
              onSkipPrevious={handleSkipPrevious}
              onSkipNext={handleSkipNext}
              onPlaybackError={setError}
            />

            <BrowseCard
              isConnected={connectionState === "connected"}
              browseBusy={browseBusy}
              browseItems={browseItems}
              browseTrail={browseTrail}
              selectedImageUri={selectedImageUri}
              onLoadRoot={handleLoadBrowseRoot}
              onOpenItem={handleOpenContentItem}
            />

            <View style={s.actions}>
              {session.refreshToken !== null && (
                <Btn
                  label={busy === "refresh" ? "Refreshing…" : "Refresh session"}
                  onPress={handleRefresh}
                  disabled={busy !== null}
                  variant="secondary"
                />
              )}
              <Btn
                label="Disconnect"
                onPress={handleDisconnect}
                disabled={busy !== null}
                variant="destructive"
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
