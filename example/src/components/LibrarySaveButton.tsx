import { useState } from "react";

import {
  User,
  useCapabilities,
  useLibraryState,
  type SpotifyURIType,
} from "expo-spotify-sdk";

import { Btn } from "./Btn";
import { formatSpotifyError } from "../utils/format";

export function LibrarySaveButton({
  uri,
  onError,
}: {
  uri: SpotifyURIType;
  onError: (message: string) => void;
}) {
  const capabilities = useCapabilities();
  const libraryState = useLibraryState(uri);
  const [busy, setBusy] = useState(false);

  const canSave = capabilities?.canPlayOnDemand === true && libraryState?.canAdd !== false;
  const isSaved = libraryState?.isAdded === true;

  async function toggleSave() {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      if (isSaved) {
        await User.removeFromLibrary(uri);
      } else {
        await User.addToLibrary(uri);
      }
    } catch (e) {
      onError(formatSpotifyError(e));
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel =
    busy
      ? "Saving…"
      : !capabilities
        ? "Loading capabilities…"
        : !capabilities.canPlayOnDemand
          ? "Save (Premium required)"
          : isSaved
            ? "Saved — tap to remove"
            : "Save to library";

  return (
    <Btn
      label={buttonLabel}
      onPress={toggleSave}
      disabled={busy || !canSave}
      variant="secondary"
      accessibilityLabel={buttonLabel}
    />
  );
}
