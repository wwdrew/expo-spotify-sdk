import type { SpotifyProfile } from "../types";

export async function fetchProfile(accessToken: string): Promise<SpotifyProfile | null> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Spotify Web API returned ${res.status}`);
  return res.json() as Promise<SpotifyProfile>;
}
