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
    const body = await request.formData();
    code = body.get("code") as string | null;
    redirectUri = body.get("redirect_uri") as string | null;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!code) {
    return Response.json(
      { error: "Missing required field: code" },
      { status: 400 },
    );
  }

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
      redirect_uri: redirectUri ?? "",
      code,
    }).toString(),
  });

  const data = await tokenRes.json();
  return Response.json(data, { status: tokenRes.status });
}
