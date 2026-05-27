import { SpotifyError } from "../error";

export type ContentErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_LOST"
  | "CONTENT_API_UNAVAILABLE"
  | "UNKNOWN";

export class ContentError extends SpotifyError {
  readonly namespace = "Content" as const;
  readonly code: ContentErrorCode;

  constructor(code: ContentErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
