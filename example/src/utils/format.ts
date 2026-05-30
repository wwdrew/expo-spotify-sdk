import { SpotifyError } from "expo-spotify-sdk";

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function deriveTrackTitle(trackName: string | null): string {
  const cleanName = trackName?.trim();
  if (cleanName) return cleanName;
  return "Title unavailable";
}

export function formatExpiry(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
}

export function formatAccountTier(product: string | undefined): "Premium" | "Free" | "Unknown" {
  if (product === "premium") return "Premium";
  if (product === "free") return "Free";
  return "Unknown";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatSpotifyError(e: unknown): string {
  if (e instanceof SpotifyError) {
    return `[${e.namespace}] ${e.code}: ${e.message}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}
