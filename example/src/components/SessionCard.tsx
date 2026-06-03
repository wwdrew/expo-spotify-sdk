import { Text, View } from "react-native";

import type { SpotifySession } from "expo-spotify-sdk";

import { formatExpiry } from "../utils/format";
import { Row } from "./Row";
import { s } from "../styles";

export function SessionCard({ session }: { session: SpotifySession }) {
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
