/**
 * POST /swap
 *
 * Receives an authorization code from the native Spotify SDK and exchanges
 * it for an access + refresh token pair via the Spotify Accounts service.
 *
 * Expected request body (application/x-www-form-urlencoded):
 *   code          — required
 *
 * Required environment variables (.env.local):
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   SPOTIFY_REDIRECT_URI
 */
export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return Response.json(
      {
        error:
          "SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI must be set in .env.local",
      },
      { status: 500 },
    );
  }

  let code: string | null;

  try {
    const body = new URLSearchParams(await request.text());

    code = body.get("code");
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

  console.log("[swap] exchanging code for tokens, redirect_uri:", redirectUri);

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
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });

  const data = await tokenRes.json();
  console.log("[swap] Spotify response:", tokenRes.status, data);
  return Response.json(data, { status: tokenRes.status });
}
