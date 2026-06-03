import type { SpotifyError } from "../error";

const CAUSE_SEPARATOR = "→ Caused by: ";
const LEGACY_CODE_PREFIX_RE = /^([A-Z_][A-Z0-9_]*):\s*(.*)$/s;

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
  /** Parse legacy `"CODE: message"` prefixes embedded in native error reasons. */
  legacyCodePrefix?: boolean;
  unknownCode: C;
}

export function createNativeErrorRethrow<
  C extends string,
  E extends SpotifyError & { code: C },
>(options: NativeErrorRethrowOptions<C, E>): (err: unknown) => never {
  const { ErrorClass, validCodes, legacyCodePrefix, unknownCode } = options;

  return function rethrowNativeError(err: unknown): never {
    if (err instanceof ErrorClass) throw err;
    if (err instanceof Error) {
      const reason = unwrapReason(err.message);
      const maybeCode = (err as Error & { code?: string }).code;
      if (maybeCode && validCodes.has(maybeCode as C)) {
        throw new ErrorClass(maybeCode as C, reason);
      }
      if (legacyCodePrefix) {
        const match = reason.match(LEGACY_CODE_PREFIX_RE);
        if (match && validCodes.has(match[1] as C)) {
          throw new ErrorClass(match[1] as C, match[2]!);
        }
      }
      throw new ErrorClass(unknownCode, reason);
    }
    throw new ErrorClass(unknownCode, String(err));
  };
}
