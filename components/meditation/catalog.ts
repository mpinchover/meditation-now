import type { ApiCustomSoundscape } from "@/lib/meditation-sounds-api";
import type { CatalogSoundscape } from "@/lib/meditation-mocks";

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
