import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppRemote,
  Auth,
  AuthError,
  Content,
  type ContentItem,
  Images,
  Player,
  SpotifyError,
  type SpotifyScope,
  type SpotifySession,
  SpotifyURI,
  type SpotifyURIType,
  User,
  useCapabilities,
  useConnectionState,
  useCurrentTrack,
  useIsPlaying,
  useLibraryState,
  usePlaybackPosition,
} from "expo-spotify-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEV_HOST = Constants.expoConfig?.hostUri ?? "127.0.0.1:8081";
const TOKEN_SWAP_URL = `http://${DEV_HOST}/swap`;
const TOKEN_REFRESH_URL = `http://${DEV_HOST}/refresh`;
const USE_TOKEN_SWAP = false;

const SCOPES: SpotifyScope[] = [
  "app-remote-control",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "user-library-read",
  "user-library-modify",
  "streaming",
];

const C = {
  bg: "#121212",
  surface: "#1e1e1e",
  border: "#2a2a2a",
  green: "#1DB954",
  white: "#ffffff",
  muted: "#b3b3b3",
  error: "#e25d5d",
  errorBg: "#2d1515",
};

interface SpotifyProfile {
  display_name: string;
  email: string;
  product: string;
  followers: { total: number };
  images: Array<{ url: string }>;
}

type Busy = "auth" | "refresh" | "profile" | null;
type BrowseBusy = "root" | "children" | null;
type TransportBusy = "toggle" | "next" | "previous" | null;
const STORED_SESSION_KEY = "expo-spotify-example:session";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function deriveTrackTitle(trackName: string | null): string {
  const cleanName = trackName?.trim();
  if (cleanName) return cleanName;
  return "Title unavailable";
}

function formatExpiry(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
}

function formatAccountTier(product: string | undefined): "Premium" | "Free" | "Unknown" {
  if (product === "premium") return "Premium";
  if (product === "free") return "Free";
  return "Unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSpotifyError(e: unknown): string {
  if (e instanceof SpotifyError) {
    return `[${e.namespace}] ${e.code}: ${e.message}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

async function fetchProfile(accessToken: string): Promise<SpotifyProfile | null> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Spotify Web API returned ${res.status}`);
  return res.json() as Promise<SpotifyProfile>;
}


export default function HomeScreen() {
  const connectionState = useConnectionState();
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const playbackPositionMs = usePlaybackPosition();
  const [positionAnchor, setPositionAnchor] = useState<{ positionMs: number; capturedAt: number }>({
    positionMs: 0,
    capturedAt: Date.now(),
  });
  const [clockTick, setClockTick] = useState(0);

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
    setPositionAnchor({ positionMs: playbackPositionMs, capturedAt: Date.now() });
  }, [playbackPositionMs, currentTrack?.uri, isPlaying]);

  useEffect(() => {
    if (connectionState !== "connected" || currentTrack == null || !isPlaying) {
      return;
    }
    const timer = setInterval(() => setClockTick((v) => v + 1), 500);
    return () => clearInterval(timer);
  }, [connectionState, currentTrack?.uri, isPlaying]);

  const displayPlaybackMs = useMemo(() => {
    if (connectionState !== "connected" || currentTrack == null) return 0;
    if (!isPlaying) return positionAnchor.positionMs;

    const elapsedMs = Date.now() - positionAnchor.capturedAt;
    const durationMs = currentTrack.duration ?? 0;
    if (durationMs > 0) {
      return Math.min(positionAnchor.positionMs + elapsedMs, durationMs);
    }
    return positionAnchor.positionMs + elapsedMs;
  }, [clockTick, connectionState, currentTrack, isPlaying, positionAnchor]);

  const loadProfile = useCallback(async (token: string) => {
    setBusy("profile");
    try {
      const p = await fetchProfile(token);
      if (p !== null) setProfile(p);
    } catch {
      // Non-fatal for this demo.
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

      // On iOS, nudge Spotify to foreground so its App Remote transport is ready.
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
          <View
            style={[s.dot, { backgroundColor: Auth.isAvailable() ? C.green : C.muted }]}
          />
          <Text style={s.badgeText}>
            {Auth.isAvailable() ? "Spotify app detected" : "Spotify app not installed"}
          </Text>
        </View>
        <Text style={s.connectionText}>{connectionLabel}</Text>
        {session !== null && (
          <Text style={s.connectionText}>
            Account tier: {accountTier}
          </Text>
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

function ConnectButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <TouchableOpacity
      style={[s.connectBtn, loading && s.disabledOpacity]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Connect with Spotify"
    >
      {loading ? <ActivityIndicator color={C.bg} /> : <Text style={s.connectBtnText}>Connect with Spotify</Text>}
    </TouchableOpacity>
  );
}

function ProfileCard({ profile }: { profile: SpotifyProfile }) {
  const avatar = profile.images[0]?.url;
  return (
    <View style={s.card}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitial}>{profile.display_name?.[0] ?? "?"}</Text>
        </View>
      )}
      <Text style={s.profileName}>{profile.display_name}</Text>
      <Text style={s.profileMeta}>{profile.email}</Text>
      <Text style={s.profileMeta}>
        {profile.product === "premium" ? "✦ Spotify Premium" : "Spotify Free"}
        {" · "}
        {profile.followers.total.toLocaleString()} followers
      </Text>
    </View>
  );
}

function SessionCard({ session }: { session: SpotifySession }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Session</Text>
      <Row label="Access token" value={`${session.accessToken.slice(0, 16)}…`} />
      <Row label="Expires in" value={formatExpiry(session.expirationDate)} />
      <Row label="Refresh token" value={session.refreshToken ? "present" : "none (TOKEN flow)"} />
      <Row label="Scopes" value={`${session.scopes.length} granted`} />
    </View>
  );
}

function ConnectionActions({
  connectionState,
  onConnect,
  onDisconnect,
}: {
  connectionState: "disconnected" | "connecting" | "connected";
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>App Remote</Text>
      {connectionState !== "connected" ? (
        <Btn
          label={connectionState === "connecting" ? "Connecting…" : "Connect App Remote"}
          onPress={onConnect}
          disabled={connectionState === "connecting"}
          variant="primary"
        />
      ) : (
        <Btn label="Disconnect App Remote" onPress={onDisconnect} variant="secondary" />
      )}
    </View>
  );
}

function LibrarySaveButton({
  uri,
  onError,
}: {
  uri: SpotifyURIType;
  onError: (message: string) => void;
}) {
  const capabilities = useCapabilities();
  const libraryState = useLibraryState(uri);
  const [busy, setBusy] = useState(false);

  const canSave = capabilities?.canPlayOnDemand === true && libraryState?.canAdd !== false;
  const isSaved = libraryState?.isAdded === true;

  async function toggleSave() {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      if (isSaved) {
        await User.removeFromLibrary(uri);
      } else {
        await User.addToLibrary(uri);
      }
    } catch (e) {
      onError(formatSpotifyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Btn
      label={
        busy
          ? "Saving…"
          : !capabilities
            ? "Loading capabilities…"
            : !capabilities.canPlayOnDemand
              ? "Save (Premium required)"
              : isSaved
                ? "Saved — tap to remove"
                : "Save to library"
      }
      onPress={toggleSave}
      disabled={busy || !canSave}
      variant="secondary"
      accessibilityLabel={isSaved ? "Remove from library" : "Save to library"}
    />
  );
}

function NowPlayingCard({
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
              <Text style={s.profileName} numberOfLines={1}>{displayTitle}</Text>
              {currentTrackArtist ? <Text style={s.profileMeta} numberOfLines={1}>{currentTrackArtist}</Text> : null}
              {currentTrackAlbum ? <Text style={s.profileMeta} numberOfLines={1}>{currentTrackAlbum}</Text> : null}
              <Text style={s.profileMeta}>
                {isPlaying ? "Playing" : "Paused"} · {formatTime(playbackPositionMs)}
                {currentTrackDurationMs > 0 ? ` / ${formatTime(currentTrackDurationMs)}` : ""}
              </Text>
              {currentTrackUri ? <Text style={s.nowPlayingUri} numberOfLines={1}>{currentTrackUri}</Text> : null}
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
              <LibrarySaveButton
                uri={SpotifyURI.from(currentTrackUri)}
                onError={onPlaybackError}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function BrowseCard({
  isConnected,
  browseBusy,
  browseItems,
  browseTrail,
  selectedImageUri,
  onLoadRoot,
  onOpenItem,
}: {
  isConnected: boolean;
  browseBusy: BrowseBusy;
  browseItems: ContentItem[];
  browseTrail: string[];
  selectedImageUri: string | null;
  onLoadRoot: () => void;
  onOpenItem: (item: ContentItem) => void;
}) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Browse</Text>
      <Text style={s.profileMeta}>{browseTrail.length ? browseTrail.join(" / ") : "No browse path yet"}</Text>
      {!isConnected ? (
        <Text style={s.emptyHint}>Connect App Remote to browse content.</Text>
      ) : (
        <>
          <Btn
            label={browseBusy === "root" ? "Loading…" : "Load recommendations"}
            onPress={onLoadRoot}
            disabled={browseBusy !== null}
            variant="secondary"
          />
          {browseBusy === "children" && <ActivityIndicator color={C.green} style={{ marginTop: 12 }} />}
          {browseItems.length === 0 && browseBusy === null && (
            <View style={s.emptyBrowse}>
              <Text style={s.emptyBrowseIcon}>♪</Text>
              <Text style={s.emptyHint}>Nothing to show yet. Load recommendations.</Text>
            </View>
          )}
          {selectedImageUri ? <Image source={{ uri: selectedImageUri }} style={s.browseImage} /> : null}
          {browseItems.slice(0, 10).map((item) => (
            <TouchableOpacity
              key={item.identifier}
              style={s.browseRow}
              onPress={() => onOpenItem(item)}
              activeOpacity={0.8}
            >
              <Text style={s.rowLabel} numberOfLines={1}>{item.title ?? item.subtitle ?? item.uri}</Text>
              <Text style={s.rowValue}>{item.isPlayable ? "Play" : item.isContainer ? "Open" : "Item"}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

function Btn({
  label,
  onPress,
  disabled,
  variant,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "destructive";
  accessibilityLabel?: string;
}) {
  const bg = variant === "destructive" ? "transparent" : variant === "secondary" ? C.surface : C.green;
  const borderColor = variant === "destructive" ? C.error : variant === "secondary" ? C.border : C.green;
  const textColor = variant === "destructive" ? C.error : variant === "secondary" ? C.white : C.bg;

  return (
    <TouchableOpacity
      style={[
        s.btn,
        s.btnFull,
        { backgroundColor: bg, borderColor },
        disabled && s.disabledOpacity,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true }}
    >
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransportBtn({
  label,
  onPress,
  disabled,
  variant,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary";
  accessibilityLabel?: string;
}) {
  const bg = variant === "secondary" ? C.surface : C.green;
  const borderColor = variant === "secondary" ? C.border : C.green;
  const textColor = variant === "secondary" ? C.white : C.bg;

  return (
    <TouchableOpacity
      style={[
        s.transportBtn,
        { backgroundColor: bg, borderColor },
        disabled && s.disabledOpacity,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true }}
    >
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingBottom: 48, flexGrow: 1 },
  header: { alignItems: "center", marginBottom: 24, marginTop: 8 },
  title: { color: C.white, fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 4 },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  badgeText: { color: C.muted, fontSize: 13 },
  connectionText: { color: C.white, fontSize: 13, textAlign: "center", marginBottom: 12 },
  errorBox: { backgroundColor: C.errorBg, borderRadius: 10, padding: 14, marginBottom: 16 },
  errorText: { color: C.error, fontSize: 13, lineHeight: 18 },
  connectBtn: {
    backgroundColor: C.green,
    borderRadius: 32,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  connectBtnText: { color: C.bg, fontWeight: "700", fontSize: 16 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: "center",
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarFallback: { backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: C.muted, fontSize: 28 },
  profileName: { color: C.white, fontSize: 20, fontWeight: "700", marginBottom: 4 },
  profileMeta: { color: C.muted, fontSize: 13, marginBottom: 2, textAlign: "center" },
  cardTitle: {
    color: C.white,
    fontWeight: "700",
    fontSize: 13,
    alignSelf: "flex-start",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  rowLabel: { color: C.muted, fontSize: 13, flex: 1, marginRight: 8 },
  rowValue: { color: C.white, fontSize: 13, fontWeight: "500" },
  actions: { gap: 10, marginTop: 4 },
  restoreHint: { color: C.muted, fontSize: 12, textAlign: "center", marginBottom: 10 },
  emptyHint: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 8 },
  nowPlayingRow: { flexDirection: "row", width: "100%", alignItems: "center", gap: 12 },
  nowPlayingArtwork: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#2b2b2b" },
  nowPlayingArtworkPlaceholder: { alignItems: "center", justifyContent: "center" },
  nowPlayingArtworkIcon: { color: C.muted, fontSize: 24 },
  nowPlayingMeta: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  nowPlayingUri: { color: C.muted, fontSize: 11, marginTop: 2 },
  transportRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, width: "100%" },
  librarySaveRow: { width: "100%", marginTop: 10 },
  emptyBrowse: { alignItems: "center", justifyContent: "center", marginTop: 14, marginBottom: 8 },
  emptyBrowseIcon: { color: C.green, fontSize: 28, marginBottom: 4 },
  browseImage: { width: 90, height: 90, borderRadius: 8, marginTop: 12, marginBottom: 8 },
  browseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  btn: {
    borderRadius: 32,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  btnFull: { width: "100%" },
  transportBtn: {
    width: "31%",
    borderRadius: 32,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  btnText: { fontWeight: "600", fontSize: 15 },
  disabledOpacity: { opacity: 0.5 },
});
