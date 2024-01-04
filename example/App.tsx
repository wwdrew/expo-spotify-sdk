import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useSpotifyAuthentication } from "./src/hooks/useSpotifyAuthentication";

export default function App() {
  const [authToken, setAuthToken] = useState<string>("unknown");
  const { authenticate } = useSpotifyAuthentication();

  function handleAuthenticatePress() {
    const token = authenticate();
    setAuthToken(token);
  }

  return (
    <View style={styles.container}>
      <Text onPress={handleAuthenticatePress}>Authenticate Me</Text>
      <Text>Auth Token: {authToken}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
