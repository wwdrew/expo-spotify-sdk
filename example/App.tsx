import { authenticatePrompt } from "expo-spotify-sdk";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  function handleAuthenticatePress() {
    console.log(authenticatePrompt());
  }

  return (
    <View style={styles.container}>
      <Text onPress={handleAuthenticatePress}>Authenticate Me</Text>
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
