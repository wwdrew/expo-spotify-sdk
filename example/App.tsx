import {
  addSessionChangeListener,
  authenticateAsync,
  isAvailable,
  refreshSessionAsync,
  SpotifyError,
  SpotifyScope,
  SpotifySession,
} from "expo-spotify-sdk";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ── Configuration ─────────────────────────────────────────────────────────────
// Start the token swap server before running the app:
//   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy node server.js
//
// On iOS Simulator "localhost" works. On Android Emulator use "10.0.2.2".
// On a physical device use your machine's LAN IP (e.g. "192.168.1.10").
const TOKEN_SWAP_URL = "http://localhost:3000/swap";
const TOKEN_REFRESH_URL = "http://localhost:3000/refresh";

const SCOPES: SpotifyScope[] = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "streaming",
];

// ── Colours ───────────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface SpotifyProfile {
  display_name: string;
  email: string;
  product: string;
  followers: { total: number };
  images: Array<{ url: string }>;
  country: string;
}

type Busy = "auth" | "refresh" | "profile" | null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatExpiry(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
}

async function fetchProfile(accessToken: string): Promise<SpotifyProfile> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify Web API returned ${res.status}`);
  return res.json() as Promise<SpotifyProfile>;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<SpotifySession | null>(null);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  // Demonstrate addSessionChangeListener — log failures from any call site.
  useEffect(() => {
    const sub = addSessionChangeListener((event) => {
      if (event.type === "didFail") {
        console.warn(
          "[SpotifySDK event]",
          event.error.code,
          event.error.message,
        );
      }
    });
    return () => sub.remove();
  }, []);

  const loadProfile = useCallback(async (token: string) => {
    setBusy("profile");
    try {
      setProfile(await fetchProfile(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  async function handleConnect() {
    setError(null);
    setBusy("auth");
    try {
      const s = await authenticateAsync({
        scopes: SCOPES,
        tokenSwapURL: TOKEN_SWAP_URL,
        tokenRefreshURL: TOKEN_REFRESH_URL,
      });
      setSession(s);
      await loadProfile(s.accessToken);
    } catch (e) {
      if (e instanceof SpotifyError && e.code === "USER_CANCELLED") return;
      setError(
        e instanceof SpotifyError ? `[${e.code}] ${e.message}` : String(e),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleRefresh() {
    if (!session?.refreshToken) return;
    setError(null);
    setBusy("refresh");
    try {
      const s = await refreshSessionAsync({
        refreshToken: session.refreshToken,
        tokenRefreshURL: TOKEN_REFRESH_URL,
      });
      setSession(s);
      await loadProfile(s.accessToken);
    } catch (e) {
      setError(
        e instanceof SpotifyError ? `[${e.code}] ${e.message}` : String(e),
      );
    } finally {
      setBusy(null);
    }
  }

  function handleDisconnect() {
    setSession(null);
    setProfile(null);
    setError(null);
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={s.scroll} bounces={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>expo-spotify-sdk</Text>
          <Text style={s.subtitle}>Example app</Text>
        </View>

        {/* Spotify app badge */}
        <View style={s.badgeRow}>
          <View
            style={[
              s.dot,
              { backgroundColor: isAvailable() ? C.green : C.muted },
            ]}
          />
          <Text style={s.badgeText}>
            {isAvailable()
              ? "Spotify app detected"
              : "Spotify app not installed"}
          </Text>
        </View>

        {/* Error */}
        {error !== null && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {session === null ? (
          /* Unauthenticated */
          <ConnectButton onPress={handleConnect} loading={busy === "auth"} />
        ) : (
          /* Authenticated */
          <>
            {busy === "profile" ? (
              <ActivityIndicator
                color={C.green}
                style={{ marginVertical: 24 }}
              />
            ) : profile !== null ? (
              <ProfileCard profile={profile} />
            ) : null}

            <SessionCard session={session} />

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

// ── Sub-components ────────────────────────────────────────────────────────────
function ConnectButton({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.connectBtn, loading && s.disabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={C.bg} />
      ) : (
        <Text style={s.connectBtnText}>Connect with Spotify</Text>
      )}
    </TouchableOpacity>
  );
}

function ProfileCard({ profile }: { profile: SpotifyProfile }) {
  const avatar = profile.images[0]?.url;
  return (
    <View style={s.card}>
      {avatar !== undefined ? (
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
      <Row
        label="Access token"
        value={`${session.accessToken.slice(0, 16)}…`}
      />
      <Row label="Expires in" value={formatExpiry(session.expirationDate)} />
      <Row
        label="Refresh token"
        value={session.refreshToken !== null ? "present" : "none (TOKEN flow)"}
      />
      <Row label="Scopes" value={`${session.scopes.length} granted`} />
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
  const bg =
    variant === "destructive"
      ? "transparent"
      : variant === "secondary"
        ? C.surface
        : C.green;
  const borderColor =
    variant === "destructive"
      ? C.error
      : variant === "secondary"
        ? C.border
        : C.green;
  const textColor =
    variant === "destructive" ? C.error : variant === "secondary" ? C.white : C.bg;

  return (
    <TouchableOpacity
      style={[s.btn, { backgroundColor: bg, borderColor }, disabled && s.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[s.btnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingBottom: 48, flexGrow: 1 },

  header: { alignItems: "center", marginBottom: 24, marginTop: 8 },
  title: {
    color: C.white,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 4 },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  badgeText: { color: C.muted, fontSize: 13 },

  errorBox: {
    backgroundColor: C.errorBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
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
  avatarFallback: {
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: C.muted, fontSize: 28 },
  profileName: {
    color: C.white,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileMeta: {
    color: C.muted,
    fontSize: 13,
    marginBottom: 2,
    textAlign: "center",
  },

  cardTitle: {
    color: C.white,
    fontWeight: "700",
    fontSize: 14,
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
  rowLabel: { color: C.muted, fontSize: 13 },
  rowValue: { color: C.white, fontSize: 13, fontWeight: "500" },

  actions: { gap: 10, marginTop: 4 },
  btn: {
    borderRadius: 32,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  btnText: { fontWeight: "600", fontSize: 15 },

  disabled: { opacity: 0.5 },
});
