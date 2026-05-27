/**
 * Abstract base class for every error thrown by this library. Carry a
 * structured `code` and a `namespace` so catch-all handlers can branch
 * without importing concrete subclasses.
 *
 * Always thrown as one of the per-namespace subclasses:
 * `AuthError`, `AppRemoteError`, `PlayerError`, `UserError`,
 * `ContentError`, `ImagesError`.
 *
 * @example
 * ```ts
 * try { ... } catch (e) {
 *   if (e instanceof SpotifyError) {
 *     console.error(e.namespace, e.code, e.message);
 *   }
 * }
 * ```
 */
export abstract class SpotifyError extends Error {
  abstract readonly code: string;
  abstract readonly namespace: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
