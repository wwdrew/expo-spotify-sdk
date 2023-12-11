import { requireNativeViewManager } from "expo-modules-core";
import * as React from "react";

import { ExpoSpotifySDKViewProps } from "./ExpoSpotifySDK.types";

const NativeView: React.ComponentType<ExpoSpotifySDKViewProps> =
  requireNativeViewManager("ExpoSpotifySDK");

export default function ExpoSpotifySDKView(props: ExpoSpotifySDKViewProps) {
  return <NativeView {...props} />;
}
