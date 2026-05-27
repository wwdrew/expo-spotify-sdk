import { SpotifyError } from "../error";

export type PlayerErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_LOST"
  | "PREMIUM_REQUIRED"
  | "INVALID_URI"
  | "INVALID_PARAMETER"
  | "OPERATION_NOT_ALLOWED"
  | "UNKNOWN";

export class PlayerError extends SpotifyError {
  readonly namespace = "Player" as const;
  readonly code: PlayerErrorCode;

  constructor(code: PlayerErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
