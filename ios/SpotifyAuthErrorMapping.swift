import AuthenticationServices
import Foundation

/// Maps a raw authentication `NSError` into the structured `SpotifyError`
/// taxonomy.
///
/// This is the **single** canonical entry point for auth-error classification.
/// Both the `SPTSessionManager` delegate failure callback and the module-level
/// top-level `catch` route through `classify(_:context:)`, so a given raw error
/// yields the same `SpotifyError` regardless of which path delivers it. (The
/// Spotify iOS SDK does not always route cancellations through the delegate, so
/// the same error can arrive via either path.)
///
/// Keep aligned with [docs/auth-error-mapping.md](../docs/auth-error-mapping.md).
enum SpotifyAuthErrorMapping {
  /// Signals the classifier needs that aren't derivable from the error itself.
  /// `tokenSwapConfigured` lets ambiguous SDK failures be treated as
  /// token-swap-class errors when the caller supplied a token swap URL.
  struct Context {
    var tokenSwapConfigured: Bool = false
  }

  /// Walk the error once, then apply rules in priority order: typed/structural
  /// signals first (cancellation domain/code, URL transport errors, parsed HTTP
  /// status), then best-effort message-text heuristics, then `UNKNOWN`.
  static func classify(_ error: Error, context: Context = Context()) -> SpotifyError {
    let chain = nsErrorChain(error)
    let root = chain[0]
    let detail = describeError(root)
    let result = classify(chain: chain, root: root, detail: detail, context: context)

    NSLog(
      "[ExpoSpotifySDK] classifyAuthError classified=%@ domain=%@ code=%d detail=%@",
      result.code,
      root.domain,
      root.code,
      detail
    )
    return result
  }

  private static func classify(
    chain: [NSError],
    root: NSError,
    detail: String,
    context: Context
  ) -> SpotifyError {
    // 1. User cancellation — a typed domain/code anywhere in the chain, or
    //    best-effort cancel text within a known auth/browser domain.
    if chain.contains(where: { isKnownCancellationCode($0) || messageLooksCancelled($0) }) {
      return .userCancelled
    }

    // 2. Transport failure anywhere in the chain (cancellation already handled).
    if chain.contains(where: { $0.domain == NSURLErrorDomain && $0.code != NSURLErrorCancelled }) {
      return .networkError(
        message: "Network error during Spotify authentication: \(detail)",
        cause: root
      )
    }

    let lower = detail.lowercased()

    // 3. OAuth-style rejection text — evaluated before the token-swap gate so
    //    these are never misclassified as token-swap errors.
    if lower.contains("access_denied") || lower.contains("invalid_scope") ||
       lower.contains("invalid_client") || lower.contains("authorization") ||
       lower.contains("oauth") || lower.contains("spotify account") {
      return .authError(message: "Spotify authorization failed: \(detail)", cause: root)
    }

    if let status = extractHTTPStatusCode(from: detail), status == 401 || status == 403 {
      return .authError(
        message: "Spotify authorization failed (HTTP \(status)): \(detail)",
        cause: root
      )
    }

    // 4. Token-swap-class failure — when a swap URL was configured, or the text
    //    explicitly references the token endpoint.
    if context.tokenSwapConfigured || lower.contains("token swap") ||
       lower.contains("token endpoint") || lower.contains("token exchange") {
      if let status = extractHTTPStatusCode(from: detail) {
        return .tokenSwapFailed(
          status: status,
          message: "Token swap server returned HTTP \(status): \(detail)",
          cause: root
        )
      }
      if lower.contains("parse") || lower.contains("json") ||
         lower.contains("decode") || lower.contains("malformed") {
        return .tokenSwapParseError(message: "Token swap response was invalid: \(detail)", cause: root)
      }
      return .tokenSwapFailed(status: nil, message: "Token swap failed: \(detail)", cause: root)
    }

    // 5. Fallback. Keep the original NSError as `cause` so the structured
    //    underlying-chain is preserved (Sentry, debug breadcrumbs).
    return .underlying(message: detail, cause: root)
  }

  // MARK: — Chain traversal

  /// The error plus its `NSUnderlyingErrorKey` ancestry, root first. The chain
  /// is effectively a singly-linked list; the `seen` set only guards against a
  /// pathological cycle. Every rule above consumes this single walk instead of
  /// re-implementing the traversal.
  private static func nsErrorChain(_ error: Error) -> [NSError] {
    var chain: [NSError] = []
    var seen = Set<ObjectIdentifier>()
    var current: NSError? = error as NSError
    while let node = current, seen.insert(ObjectIdentifier(node)).inserted {
      chain.append(node)
      current = node.userInfo[NSUnderlyingErrorKey] as? NSError
    }
    return chain
  }

  // MARK: — Typed cancellation signals (locale-independent)

  /// Recognise a single error's well-known cancellation domain/code. These are
  /// stable identifiers and integer codes, so they hold across every locale.
  private static func isKnownCancellationCode(_ error: NSError) -> Bool {
    if error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled {
      return true
    }

    if #available(iOS 12.0, *),
       error.domain == ASWebAuthenticationSessionErrorDomain,
       error.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
      return true
    }

    if error.domain == "SFAuthenticationErrorDomain" && error.code == 1 {
      return true
    }

    // The Spotify iOS auth/login SDK reports user cancellation under its own
    // login domain with code 1. This domain contains "spotify" but not "auth",
    // so the fuzzy text matching below would not catch it either.
    if error.domain == "com.spotify.sdk.login" && error.code == 1 {
      return true
    }

    return false
  }

  // MARK: — Best-effort text heuristics (locale-dependent fallback)

  /// Last-resort cancellation detection for errors that lack a recognised
  /// domain/code. Matches localized message text, so it is English-biased by
  /// nature — kept deliberately narrow (auth/browser domains only) so unrelated
  /// transport/backend failures are never mapped to `USER_CANCELLED`.
  private static func messageLooksCancelled(_ error: NSError) -> Bool {
    guard isLikelyAuthCancellationDomain(error.domain) else {
      return false
    }

    let cancelKeywords = ["cancel", "canceled", "cancelled"]
    let negativeKeywords = [
      "timed out", "timeout", "network", "offline", "unreachable",
      "server", "unauthorized", "forbidden", "invalid"
    ]
    let combined = [
      error.localizedDescription,
      error.localizedFailureReason ?? "",
      error.userInfo[NSLocalizedDescriptionKey] as? String ?? "",
      error.userInfo[NSLocalizedFailureReasonErrorKey] as? String ?? ""
    ].joined(separator: " ").lowercased()

    if negativeKeywords.contains(where: { combined.contains($0) }) {
      return false
    }
    return cancelKeywords.contains(where: { combined.contains($0) })
  }

  private static func isLikelyAuthCancellationDomain(_ domain: String) -> Bool {
    if domain == ASWebAuthenticationSessionErrorDomain || domain == "SFAuthenticationErrorDomain" {
      return true
    }
    // SPT wrappers commonly bubble auth-web errors under their own namespace.
    let lower = domain.lowercased()
    return lower.contains("spotify") && lower.contains("auth")
  }

  // MARK: — Diagnostics

  /// Build a diagnostic string from an NSError that includes the domain, code,
  /// localized description, and the full chain of underlying errors. Needed
  /// because `SPTError` (and many `URLSession` errors it wraps) often have an
  /// empty `localizedDescription`, surfacing as "undefined reason" in JS
  /// without this expansion.
  private static func describeError(_ error: NSError) -> String {
    var parts: [String] = ["\(error.domain) code \(error.code)"]
    let desc = error.localizedDescription
    if !desc.isEmpty {
      parts.append("\"\(desc)\"")
    }
    var ui = error.userInfo
    ui.removeValue(forKey: NSUnderlyingErrorKey)
    ui.removeValue(forKey: NSLocalizedDescriptionKey)
    if !ui.isEmpty {
      parts.append("userInfo=\(ui)")
    }
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
      parts.append("→ underlying: \(describeError(underlying))")
    }
    return parts.joined(separator: " ")
  }

  private static func extractHTTPStatusCode(from message: String) -> Int? {
    let patterns = [
      #"http\s+([1-5][0-9]{2})"#,
      #"status(?:\s+code)?[:=\s]+([1-5][0-9]{2})"#
    ]

    for pattern in patterns {
      guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
        continue
      }
      let range = NSRange(message.startIndex..<message.endIndex, in: message)
      guard let match = regex.firstMatch(in: message, options: [], range: range),
            match.numberOfRanges > 1,
            let codeRange = Range(match.range(at: 1), in: message)
      else {
        continue
      }
      if let code = Int(message[codeRange]) {
        return code
      }
    }
    return nil
  }
}
