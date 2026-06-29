import { SpotifyError } from "../error";

export type AuthErrorCode =
  | "USER_CANCELLED"
  | "AUTH_IN_PROGRESS"
  | "INVALID_CONFIG"
  | "NETWORK_ERROR"
  | "TOKEN_SWAP_FAILED"
  | "TOKEN_SWAP_PARSE_ERROR"
  | "REFRESH_TOKEN_EXPIRED"
  | "SPOTIFY_NOT_INSTALLED"
  | "AUTH_ERROR"
  | "UNKNOWN";

export class AuthError extends SpotifyError {
  readonly namespace = "Auth" as const;
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
