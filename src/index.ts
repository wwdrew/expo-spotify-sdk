import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to ExpoSpotifySDK.web.ts
// and on native platforms to ExpoSpotifySDK.ts
import ExpoSpotifySDKModule from './ExpoSpotifySDKModule';
import ExpoSpotifySDKView from './ExpoSpotifySDKView';
import { ChangeEventPayload, ExpoSpotifySDKViewProps } from './ExpoSpotifySDK.types';

// Get the native constant value.
export const PI = ExpoSpotifySDKModule.PI;

export function hello(): string {
  return ExpoSpotifySDKModule.hello();
}

export async function setValueAsync(value: string) {
  return await ExpoSpotifySDKModule.setValueAsync(value);
}

const emitter = new EventEmitter(ExpoSpotifySDKModule ?? NativeModulesProxy.ExpoSpotifySDK);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { ExpoSpotifySDKView, ExpoSpotifySDKViewProps, ChangeEventPayload };
