import type { SoundscapeListTab } from "@/lib/soundscape-categories";

export type CatalogSoundscape = {
  id: string;
  name: string;
  media_url: string;
  /** Which Soundscape modal tab lists this item (from API `category`). */
  tab: SoundscapeListTab;
};

export type CatalogBellSound = {
  id: string;
  name: string;
  media_url: string;
};

export type BellCategory = "starting" | "ending" | "interval";
