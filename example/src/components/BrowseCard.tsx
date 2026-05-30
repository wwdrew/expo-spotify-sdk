import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";

import type { ContentItem } from "expo-spotify-sdk";

import type { BrowseBusy } from "../types";
import { Btn } from "./Btn";
import { s } from "../styles";
import { C } from "../theme";

export function BrowseCard({
  isConnected,
  browseBusy,
  browseItems,
  browseTrail,
  selectedImageUri,
  onLoadRoot,
  onOpenItem,
}: {
  isConnected: boolean;
  browseBusy: BrowseBusy;
  browseItems: ContentItem[];
  browseTrail: string[];
  selectedImageUri: string | null;
  onLoadRoot: () => void;
  onOpenItem: (item: ContentItem) => void;
}) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Browse</Text>
      <Text style={s.profileMeta}>
        {browseTrail.length ? browseTrail.join(" / ") : "No browse path yet"}
      </Text>
      {!isConnected ? (
        <Text style={s.emptyHint}>Connect App Remote to browse content.</Text>
      ) : (
        <>
          <Btn
            label={browseBusy === "root" ? "Loading…" : "Load recommendations"}
            onPress={onLoadRoot}
            disabled={browseBusy !== null}
            variant="secondary"
          />
          {browseBusy === "children" && (
            <ActivityIndicator color={C.green} style={{ marginTop: 12 }} />
          )}
          {browseItems.length === 0 && browseBusy === null && (
            <View style={s.emptyBrowse}>
              <Text style={s.emptyBrowseIcon}>♪</Text>
              <Text style={s.emptyHint}>Nothing to show yet. Load recommendations.</Text>
            </View>
          )}
          {selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={s.browseImage} />
          ) : null}
          {browseItems.slice(0, 10).map((item) => (
            <TouchableOpacity
              key={item.identifier}
              style={s.browseRow}
              onPress={() => onOpenItem(item)}
              activeOpacity={0.8}
            >
              <Text style={s.rowLabel} numberOfLines={1}>
                {item.title ?? item.subtitle ?? item.uri}
              </Text>
              <Text style={s.rowValue}>
                {item.isPlayable ? "Play" : item.isContainer ? "Open" : "Item"}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
}
