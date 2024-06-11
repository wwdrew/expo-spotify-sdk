import { Platform } from "react-native";

import { SpotifyConfig, SpotifySession } from "./ExpoSpotifySDK.types";
import ExpoSpotifySDKModule from "./ExpoSpotifySDKModule";

function isAvailable(): boolean {
  return ExpoSpotifySDKModule.isAvailable();
}

async function authenticateAsyncAndroid(
  config: SpotifyConfig,
): Promise<SpotifySession> {
  if (!config.scopes || config.scopes?.length === 0) {
    throw new Error("scopes are required");
  }

  const result = await ExpoSpotifySDKModule.authenticateAsync(config);

  if (!config.tokenSwapURL) {
    return result;
  }

  let response;
  try {
    response = await fetch(config.tokenSwapURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: result.code,
      }).toString(),
    });
  } catch (error) {
    console.error("Failed to fetch from tokenSwapURL:", error);
    throw error;
  }

  if (!response.ok) {
    const error = await response.text();
    console.log({ error });
    throw new Error(error);
  }

  const newResult = await response.json();

  return newResult;
}

function authenticateAsync(config: SpotifyConfig): Promise<SpotifySession> {
  if (!config.scopes || config.scopes?.length === 0) {
    throw new Error("scopes are required");
  }

  return ExpoSpotifySDKModule.authenticateAsync(config);
}

const Authenticate = {
  authenticateAsync:
    Platform.OS === "ios" ? authenticateAsync : authenticateAsyncAndroid,
};

export { isAvailable, Authenticate };
