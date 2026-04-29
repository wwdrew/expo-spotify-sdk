/**
 * POST /swap
 *
 * Receives an authorization code from the native Spotify SDK and exchanges
 * it for an access + refresh token pair via the Spotify Accounts service.
 *
 * Expected request body (application/x-www-form-urlencoded):
 *   code          — the authorization code from Spotify
 *   redirect_uri  — the redirect URI used during the auth request
 *   client_id     — the Spotify client ID (sent by the native SDK for validation)
 *
 * Required environment variables (.env.local):
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 */
export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      {
        error:
          "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env.local",
      },
      { status: 500 },
    );
  }

  let code: string | null;
  let redirectUri: string | null;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: URLSearchParams;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      body = new URLSearchParams(await request.text());
    } else {
      const fd = await request.formData();
      body = new URLSearchParams(
        [...fd.entries()].map(([k, v]) => [k, v.toString()]),
      );
    }

    code = body.get("code");
    redirectUri = body.get("redirect_uri");
    console.log("[swap] received body:", Object.fromEntries(body.entries()));
  } catch (e) {
    console.error("[swap] failed to parse request body:", e);
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!code) {
    return Response.json(
      { error: "Missing required field: code" },
      { status: 400 },
    );
  }

  // The iOS SPTSessionManager does not include redirect_uri in its swap
  // request body — fall back to the env var when the SDK omits it.
  const effectiveRedirectUri =
    redirectUri ?? process.env.SPOTIFY_REDIRECT_URI ?? "";

  if (!effectiveRedirectUri) {
    return Response.json(
      { error: "redirect_uri missing from request and SPOTIFY_REDIRECT_URI env var is not set" },
      { status: 400 },
    );
  }

  console.log("[swap] exchanging code for tokens, redirect_uri:", effectiveRedirectUri);

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: effectiveRedirectUri,
      code,
    }).toString(),
  });

  const data = await tokenRes.json();
  console.log("[swap] Spotify response:", tokenRes.status, data);
  return Response.json(data, { status: tokenRes.status });
}
