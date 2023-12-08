import { StyleSheet, Text, View } from 'react-native';

import * as ExpoSpotifySDK from 'expo-spotify-sdk';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>{ExpoSpotifySDK.hello()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
