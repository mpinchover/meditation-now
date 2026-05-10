import mockSounds from "./mock-sounds.json";

export type CatalogSoundscape = {
  id: string;
  name: string;
  media_url: string;
};

export type CatalogBellSound = {
  id: string;
  name: string;
  media_url: string;
};

export const MOCK_SOUNDSCAPES: CatalogSoundscape[] = mockSounds.soundscapes.map(
  (s, i) => ({
    id: `ssc-${i}`,
    name: s.name,
    media_url: s.media_url,
  }),
);

export const MOCK_BELL_SOUNDS: CatalogBellSound[] = mockSounds.bells.map((b, i) => ({
  id: `bell-${i}`,
  name: b.name,
  media_url: b.media_url,
}));

export type BellCategory = "starting" | "opening" | "interval";
