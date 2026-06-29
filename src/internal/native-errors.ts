import type { SpotifyError } from "../error";

const CAUSE_SEPARATOR = "→ Caused by: ";

function unwrapReason(message: string): string {
  const idx = message.lastIndexOf(CAUSE_SEPARATOR);
  return idx === -1 ? message : message.slice(idx + CAUSE_SEPARATOR.length);
}

export interface NativeErrorRethrowOptions<
  C extends string,
  E extends SpotifyError & { code: C },
> {
  ErrorClass: new (code: C, message: string) => E;
  validCodes: ReadonlySet<C>;
  unknownCode: C;
}

export function createNativeErrorRethrow<
  C extends string,
  E extends SpotifyError & { code: C },
>(options: NativeErrorRethrowOptions<C, E>): (err: unknown) => never {
  const { ErrorClass, validCodes, unknownCode } = options;

  return function rethrowNativeError(err: unknown): never {
    if (err instanceof ErrorClass) throw err;
    if (err instanceof Error) {
      const reason = unwrapReason(err.message);
      // `err.code` is the structured code from the native `Exception`. On iOS
      // before Expo SDK 57 the async-rejection bridge dropped it (the message
      // survived), surfacing as `unknownCode` with the correct message; fixed
      // in Expo SDK 57 (expo/expo#47259), which preserves the code.
      const maybeCode = (err as Error & { code?: string }).code;
      if (maybeCode && validCodes.has(maybeCode as C)) {
        throw new ErrorClass(maybeCode as C, reason);
      }
      throw new ErrorClass(unknownCode, reason);
    }
    throw new ErrorClass(unknownCode, String(err));
  };
}
