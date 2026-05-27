import { SpotifyError } from "../error";

export type AppRemoteErrorCode =
  | "CONNECTION_FAILED"
  | "CONNECTION_LOST"
  | "NOT_CONNECTED"
  | "UNKNOWN";

export class AppRemoteError extends SpotifyError {
  readonly namespace = "AppRemote" as const;
  readonly code: AppRemoteErrorCode;

  constructor(code: AppRemoteErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
