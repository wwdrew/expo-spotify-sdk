import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#121212" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#121212" },
          animation: "fade",
        }}
      />
    </>
  );
}
