import { Text, View } from "react-native";

import { Btn } from "./Btn";
import { s } from "../styles";

export function ConnectionActions({
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
