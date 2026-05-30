export interface SpotifyProfile {
  display_name: string;
  email: string;
  product: string;
  followers: { total: number };
  images: Array<{ url: string }>;
}

export type Busy = "auth" | "refresh" | "profile" | null;
export type BrowseBusy = "root" | "children" | null;
export type TransportBusy = "toggle" | "next" | "previous" | null;
