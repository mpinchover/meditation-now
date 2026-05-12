import type { SoundscapeLibraryCategory } from "@/lib/soundscape-categories";

export type CatalogSoundscape = {
  id: string;
  name: string;
  media_url: string;
  /** From API `category` for library items; informational only in the UI. */
  tab: SoundscapeLibraryCategory;
};

export type CatalogBellSound = {
  id: string;
  name: string;
  media_url: string;
};

export type BellCategory = "starting" | "ending" | "interval";
