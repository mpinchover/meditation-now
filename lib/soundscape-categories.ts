export type SoundscapeListTab =
  | "none"
  | "ambient"
  | "ohm"
  | "temple_bells"
  | "binaural"
  | "drones"
  | "bowls"
  | "sleep";

export const SOUNDSCAPE_CATEGORY_TABS: { id: SoundscapeListTab; label: string }[] = [
  { id: "none", label: "None" },
  { id: "ambient", label: "Ambient" },
  { id: "ohm", label: "Ohm" },
  { id: "temple_bells", label: "Temple bells" },
  { id: "binaural", label: "Binaural" },
  { id: "drones", label: "Drones" },
  { id: "bowls", label: "Bowls" },
  { id: "sleep", label: "Sleep" },
];

/** Maps API `soundscapes[].category` to the UI tab id. */
export function apiSoundscapeCategoryToTab(raw: string | undefined): SoundscapeListTab {
  const c = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  switch (c) {
    case "drone":
    case "drones":
      return "drones";
    case "ohm":
      return "ohm";
    case "sleep":
      return "sleep";
    case "binaural":
      return "binaural";
    case "bowls":
      return "bowls";
    case "temple_bells":
    case "templebells":
      return "temple_bells";
    case "nature":
    case "ambient":
      return "ambient";
    default:
      return "ambient";
  }
}

/** Prefer a short title when the API uses storage-style names. */
export function displayNameForApiSoundscape(s: {
  name: string;
  media_url: string;
}): string {
  const raw = s.name?.trim() || "";
  const withoutPrefix = raw.replace(/^soundscapes\//i, "");
  const base = withoutPrefix.replace(/\.mp3$/i, "");
  if (base.length > 0) return base;
  try {
    const seg = new URL(s.media_url).pathname.split("/").filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg).replace(/\.mp3$/i, "");
  } catch {
    /* ignore */
  }
  return raw.length > 0 ? raw : "Sound";
}
