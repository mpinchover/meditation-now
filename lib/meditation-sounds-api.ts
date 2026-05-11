export const MEDITATION_SOUNDS_URL =
  "https://meditate-now-server-535943965628.us-central1.run.app/meditation-sounds";

export type ApiBell = {
  id: string;
  name: string;
  media_url: string;
};

export type ApiSoundscape = {
  id: string;
  name: string;
  media_url: string;
};

export type ApiCustomSoundscape = {
  id: string;
  link: string;
  /** User-facing label; prefer this over `link` in UI. */
  name?: string;
  media_url?: string | null;
  status: string;
};

export type MeditationSoundsResponse = {
  bells: ApiBell[];
  soundscapes: ApiSoundscape[];
  custom_soundscapes: ApiCustomSoundscape[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function fetchMeditationSounds(): Promise<MeditationSoundsResponse> {
  const res = await fetch(MEDITATION_SOUNDS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load meditation sounds (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!isRecord(data)) throw new Error("Invalid sounds response");

  const bells = data.bells;
  const soundscapes = data.soundscapes;
  const custom_soundscapes = data.custom_soundscapes;

  if (!Array.isArray(bells) || !Array.isArray(soundscapes) || !Array.isArray(custom_soundscapes)) {
    throw new Error("Invalid sounds response shape");
  }

  return { bells, soundscapes, custom_soundscapes } as MeditationSoundsResponse;
}
