import type { ApiCustomSoundscape, ApiSoundscape } from "@/lib/meditation-sounds-api";
import type { CatalogSoundscape } from "@/lib/meditation-mocks";
import {
  apiSoundscapeCategoryToLibraryCategory,
  displayNameForApiSoundscape,
} from "@/lib/soundscape-categories";

export function catalogFromApiCustom(c: ApiCustomSoundscape): CatalogSoundscape {
  const url = c.media_url;
  const mediaUrl = typeof url === "string" && url.trim().length > 0 ? url : "";
  const label = c.name?.trim();
  return {
    id: c.id,
    name: label && label.length > 0 ? label : c.link,
    media_url: mediaUrl,
    tab: "ambient",
  };
}

export function catalogFromApiSoundscape(s: ApiSoundscape): CatalogSoundscape {
  return {
    id: s.id,
    name: displayNameForApiSoundscape({ name: s.name, media_url: s.media_url }),
    media_url: s.media_url,
    tab: apiSoundscapeCategoryToLibraryCategory(s.category),
  };
}
