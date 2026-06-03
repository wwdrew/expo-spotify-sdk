import { Image, Text, View } from "react-native";

import type { SpotifyProfile } from "../types";
import { s } from "../styles";

export function ProfileCard({ profile }: { profile: SpotifyProfile }) {
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
