import Constants from "expo-constants";
import {
  AppRemote,
  Auth,
  Content,
  type ContentItem,
  Images,
  Player,
  SpotifyError,
  type SpotifyScope,
  type SpotifySession,
  SpotifyURI,
  useConnectionState,
  useCurrentTrack,
  useIsPlaying,
  usePlaybackPosition,
} from "expo-spotify-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DEV_HOST = Constants.expoConfig?.hostUri ?? "127.0.0.1:8081";
const TOKEN_SWAP_URL = `http://${DEV_HOST}/swap`;
const TOKEN_REFRESH_URL = `http://${DEV_HOST}/refresh`;

const SCOPES: SpotifyScope[] = [
  "app-remote-control",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
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

function formatExpiry(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
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

  const [session, setSession] = useState<SpotifySession | null>(null);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [browseBusy, setBrowseBusy] = useState<BrowseBusy>(null);
  const [browseItems, setBrowseItems] = useState<ContentItem[]>([]);
  const [browseTrail, setBrowseTrail] = useState<string[]>([]);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = Auth.addListener("sessionChange", (event) => {
      if (event.type === "didFail") {
        console.warn("[SpotifySDK]", event.error.code, event.error.message);
      }
    });
    return () => sub.remove();
  }, []);

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

  async function handleConnect() {
    setError(null);
    setBusy("auth");
    try {
      const s = await Auth.authenticate({
        scopes: SCOPES,
        tokenSwapURL: TOKEN_SWAP_URL,
        tokenRefreshURL: TOKEN_REFRESH_URL,
      });
      setSession(s);
      await loadProfile(s.accessToken);
    } catch (e) {
      if (e instanceof SpotifyError && e.code === "USER_CANCELLED") return;
      setError(e instanceof Error ? e.message : String(e));
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
      await loadProfile(s.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function handleDisconnect() {
    setSession(null);
    setProfile(null);
    setBrowseItems([]);
    setBrowseTrail([]);
    setSelectedImageUri(null);
    setError(null);
  }

  async function handleConnectRemote() {
    if (session == null) return;
    setError(null);
    try {
      await AppRemote.connect(session.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDisconnectRemote() {
    setError(null);
    try {
      await AppRemote.disconnect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
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
        setError(e instanceof Error ? e.message : String(e));
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
        setError(e instanceof Error ? e.message : String(e));
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

            <ConnectionActions
              connectionState={connectionState}
              onConnect={handleConnectRemote}
              onDisconnect={handleDisconnectRemote}
            />

            <NowPlayingCard
              isConnected={connectionState === "connected"}
              currentTrackName={currentTrack?.name ?? null}
              isPlaying={isPlaying}
              playbackPositionMs={playbackPositionMs}
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

function NowPlayingCard({
  isConnected,
  currentTrackName,
  isPlaying,
  playbackPositionMs,
}: {
  isConnected: boolean;
  currentTrackName: string | null;
  isPlaying: boolean;
  playbackPositionMs: number;
}) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Now Playing</Text>
      {!isConnected ? (
        <Text style={s.emptyHint}>Connect App Remote to view player state.</Text>
      ) : currentTrackName == null ? (
        <Text style={s.emptyHint}>No active track yet.</Text>
      ) : (
        <>
          <Text style={s.profileName}>{currentTrackName}</Text>
          <Text style={s.profileMeta}>
            {isPlaying ? "Playing" : "Paused"} · {Math.floor(playbackPositionMs / 1000)}s
          </Text>
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
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "destructive";
}) {
  const bg = variant === "destructive" ? "transparent" : variant === "secondary" ? C.surface : C.green;
  const borderColor = variant === "destructive" ? C.error : variant === "secondary" ? C.border : C.green;
  const textColor = variant === "destructive" ? C.error : variant === "secondary" ? C.white : C.bg;

  return (
    <TouchableOpacity
      style={[s.btn, { backgroundColor: bg, borderColor }, disabled && s.disabledOpacity]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
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
  emptyHint: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 8 },
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
    width: "100%",
  },
  btnText: { fontWeight: "600", fontSize: 15 },
  disabledOpacity: { opacity: 0.5 },
});
