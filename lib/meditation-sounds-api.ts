export const MEDITATION_SOUNDS_URL =
  "https://meditate-now-server-535943965628.us-central1.run.app/meditation-sounds";

const _soundsServer = new URL(MEDITATION_SOUNDS_URL);
export const DOWNLOAD_SOUND_URL = `${_soundsServer.origin}/download-sound`;
export const UPLOAD_AUDIO_URL = `${_soundsServer.origin}/upload-audio`;

export async function patchCustomSoundscapeName(id: string, name: string): Promise<void> {
  const res = await fetch(
    `${_soundsServer.origin}/custom-soundscape/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new Error(
      typeof rec.error === "string" ? rec.error : `Rename failed (${res.status})`,
    );
  }
}

export async function deleteCustomSoundscape(id: string): Promise<void> {
  const res = await fetch(
    `${_soundsServer.origin}/custom-soundscape/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new Error(
      typeof rec.error === "string" ? rec.error : `Delete failed (${res.status})`,
    );
  }
}

export type UploadAudioCreatedItem = {
  id: string;
  name: string;
  media_url: string;
};

export type UploadAudioErrorItem = {
  filename: string;
  error: string;
};

/**
 * POST multipart field `files` (one or more). Server accepts MP3 and WAV only.
 */
export async function postUploadAudioFiles(
  files: File[],
): Promise<{ created: UploadAudioCreatedItem[]; errors: UploadAudioErrorItem[] }> {
  const fd = new FormData();
  for (const f of files) {
    fd.append("files", f);
  }
  const res = await fetch(UPLOAD_AUDIO_URL, { method: "POST", body: fd });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};

  if (!res.ok) {
    const msg =
      typeof rec.error === "string"
        ? rec.error
        : `Upload failed (${res.status})`;
    throw new Error(msg);
  }

  const createdRaw = rec.created;
  const errorsRaw = rec.errors;
  const created = Array.isArray(createdRaw) ? (createdRaw as UploadAudioCreatedItem[]) : [];
  const errors = Array.isArray(errorsRaw) ? (errorsRaw as UploadAudioErrorItem[]) : [];

  return { created, errors };
}

export type ApiBell = {
  id: string;
  name: string;
  media_url: string;
};

export type ApiSoundscape = {
  id: string;
  name: string;
  media_url: string;
  /** Server category: e.g. drone, ohm, nature, temple_bells, binaural, bowls, sleep */
  category?: string;
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

/**
 * Ask the server to download and process a YouTube URL into a custom soundscape.
 * Returns the background job id (201); throws on validation or server errors.
 */
export async function postDownloadSound(url: string): Promise<{ id: string }> {
  const res = await fetch(DOWNLOAD_SOUND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (res.status === 201 && isRecord(data) && typeof data.id === "string") {
    return { id: data.id };
  }
  if (isRecord(data) && typeof data.error === "string") {
    throw new Error(data.error);
  }
  throw new Error(`Could not start download (${res.status})`);
}
