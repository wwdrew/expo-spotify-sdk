import { SpotifyError } from "../error";

export type ImagesErrorCode =
  | "NOT_CONNECTED"
  | "INVALID_URI"
  | "IMAGE_LOAD_FAILED"
  | "UNKNOWN";

export class ImagesError extends SpotifyError {
  readonly namespace = "Images" as const;
  readonly code: ImagesErrorCode;

  constructor(code: ImagesErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
