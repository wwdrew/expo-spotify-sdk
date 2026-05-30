import { ActivityIndicator, Text, TouchableOpacity } from "react-native";

import { s } from "../styles";
import { C } from "../theme";

export function ConnectButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <TouchableOpacity
      style={[s.connectBtn, loading && s.disabledOpacity]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Connect with Spotify"
    >
      {loading ? (
        <ActivityIndicator color={C.bg} />
      ) : (
        <Text style={s.connectBtnText}>Connect with Spotify</Text>
      )}
    </TouchableOpacity>
  );
}
