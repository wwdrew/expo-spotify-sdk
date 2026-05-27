import { SpotifyError } from "../error";

export type UserErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_LOST"
  | "INVALID_URI"
  | "OPERATION_NOT_ALLOWED"
  | "UNKNOWN";

export class UserError extends SpotifyError {
  readonly namespace = "User" as const;
  readonly code: UserErrorCode;

  constructor(code: UserErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
