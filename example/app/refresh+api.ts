/**
 * POST /refresh
 *
 * Exchanges a refresh token for a new access token via the Spotify Accounts
 * service. The server rotates refresh tokens when Spotify issues a new one.
 *
 * Expected request body (application/x-www-form-urlencoded):
 *   refresh_token — the refresh token from a previous swap or refresh
 *   client_id     — the Spotify client ID (sent by the native SDK)
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

  let refreshToken: string | null;

  try {
    const body = await request.formData();
    refreshToken = body.get("refresh_token") as string | null;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!refreshToken) {
    return Response.json(
      { error: "Missing required field: refresh_token" },
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
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  const data = await tokenRes.json();
  return Response.json(data, { status: tokenRes.status });
}
