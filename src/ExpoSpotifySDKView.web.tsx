import * as React from 'react';

import { ExpoSpotifySDKViewProps } from './ExpoSpotifySDK.types';

export default function ExpoSpotifySDKView(props: ExpoSpotifySDKViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
