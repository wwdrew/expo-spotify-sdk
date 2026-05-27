export type { UserErrorCode } from "./error";
export { UserError } from "./error";

// ---------------------------------------------------------------------------
// User namespace (stub — implemented in Phase 4)
// ---------------------------------------------------------------------------

/**
 * Spotify User namespace. Capabilities and library state queries and
 * mutations. Requires `AppRemote.connect()` to be resolved before any call.
 *
 * @example
 * ```ts
 * import { User } from "@wwdrew/expo-spotify-sdk";
 *
 * const caps = await User.getCapabilities();
 * ```
 */
export const User = {} as const;
