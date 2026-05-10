export type Soundtrack = { id: string; title: string; durationHint?: string };

export const MOCK_SOUNDTRACKS: Soundtrack[] = [
  { id: "st-1", title: "Forest morning", durationHint: "~60 min" },
  { id: "st-2", title: "Ocean drift", durationHint: "~45 min" },
  { id: "st-3", title: "Rain on roof", durationHint: "~30 min" },
  { id: "st-4", title: "Bamboo flute", durationHint: "~40 min" },
  { id: "st-5", title: "Mountain stream", durationHint: "~50 min" },
];

export type BellSound = { id: string; name: string };

export const MOCK_STARTING_BELLS: BellSound[] = [
  { id: "sb-1", name: "Soft brass" },
  { id: "sb-2", name: "Wood block" },
  { id: "sb-3", name: "Crystal ping" },
];

export const MOCK_OPENING_BELLS: BellSound[] = [
  { id: "ob-1", name: "Temple bowl" },
  { id: "ob-2", name: "Bell tree shimmer" },
  { id: "ob-3", name: "Single chime" },
];

export const MOCK_INTERVAL_BELLS: BellSound[] = [
  { id: "ib-1", name: "Tingsha pair" },
  { id: "ib-2", name: "Small bowl (low)" },
  { id: "ib-3", name: "Small bowl (high)" },
];

export type BellCategory = "starting" | "opening" | "interval";

export const BELL_CATEGORY_LABELS: Record<BellCategory, string> = {
  starting: "Starting bell",
  opening: "Opening bell",
  interval: "Interval bells",
};
