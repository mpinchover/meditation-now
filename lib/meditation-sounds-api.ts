export const MEDITATION_SOUNDS_URL =
  "https://meditate-now-server-535943965628.us-central1.run.app/meditation-sounds";

const _soundsServer = new URL(MEDITATION_SOUNDS_URL);
export const UPLOAD_AUDIO_URL = `${_soundsServer.origin}/upload-audio`;
export const UPLOAD_AUDIO_PREPARE_URL = `${_soundsServer.origin}/upload-audio/prepare`;
export const UPLOAD_AUDIO_FINALIZE_URL = `${_soundsServer.origin}/upload-audio/finalize`;
export const DOWNLOAD_SOUND_URL = `${_soundsServer.origin}/download-sound`;

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

type PrepareResponse = {
  doc_id: string;
  upload_url: string;
  content_type: string;
  finalize_token: string;
  ext: string;
};

/**
 * Signed PUT to GCS (prepare → PUT → finalize) so large files bypass Cloud Run's HTTP/1 body limit.
 * Server accepts MP3 and WAV only; trims to 10 minutes on finalize.
 */
export async function postUploadAudioFiles(
  files: File[],
  firebaseUid: string,
): Promise<{ created: UploadAudioCreatedItem[]; errors: UploadAudioErrorItem[] }> {
  const created: UploadAudioCreatedItem[] = [];
  const errors: UploadAudioErrorItem[] = [];

  for (const f of files) {
    try {
      const prepRes = await fetch(UPLOAD_AUDIO_PREPARE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebase_uid: firebaseUid,
          filename: f.name,
          content_type: f.type || undefined,
        }),
      });
      let prepBody: unknown = {};
      try {
        prepBody = await prepRes.json();
      } catch {
        /* non-JSON */
      }
      const prepRec =
        typeof prepBody === "object" && prepBody !== null
          ? (prepBody as Record<string, unknown>)
          : {};

      if (!prepRes.ok) {
        const msg =
          typeof prepRec.error === "string"
            ? prepRec.error
            : `Prepare upload failed (${prepRes.status})`;
        errors.push({ filename: f.name, error: msg });
        continue;
      }

      const doc_id = prepRec.doc_id;
      const upload_url = prepRec.upload_url;
      const content_type = prepRec.content_type;
      const finalize_token = prepRec.finalize_token;
      const ext = prepRec.ext;
      if (
        typeof doc_id !== "string" ||
        typeof upload_url !== "string" ||
        typeof content_type !== "string" ||
        typeof finalize_token !== "string" ||
        typeof ext !== "string"
      ) {
        errors.push({ filename: f.name, error: "Invalid prepare response from server." });
        continue;
      }
      const prep: PrepareResponse = {
        doc_id,
        upload_url,
        content_type,
        finalize_token,
        ext,
      };

      const putRes = await fetch(prep.upload_url, {
        method: "PUT",
        headers: { "Content-Type": prep.content_type },
        body: f,
      });
      if (!putRes.ok) {
        errors.push({
          filename: f.name,
          error: `Storage upload failed (${putRes.status}). If this persists, ensure the GCS bucket allows CORS from this app's origin.`,
        });
        continue;
      }

      const finRes = await fetch(UPLOAD_AUDIO_FINALIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebase_uid: firebaseUid,
          doc_id: prep.doc_id,
          finalize_token: prep.finalize_token,
          ext: prep.ext,
          filename: f.name,
        }),
      });
      let finBody: unknown = {};
      try {
        finBody = await finRes.json();
      } catch {
        /* non-JSON */
      }
      const finRec =
        typeof finBody === "object" && finBody !== null ? (finBody as Record<string, unknown>) : {};

      const createdRaw = finRec.created;
      const errorsRaw = finRec.errors;
      const finCreated = Array.isArray(createdRaw)
        ? (createdRaw as UploadAudioCreatedItem[])
        : [];
      const finErrors = Array.isArray(errorsRaw) ? (errorsRaw as UploadAudioErrorItem[]) : [];

      if (!finRes.ok) {
        const row =
          finErrors.find((e) => e.filename === f.name) ??
          finErrors[0] ??
          (typeof finRec.error === "string"
            ? { filename: f.name, error: finRec.error }
            : null);
        errors.push(
          row ?? { filename: f.name, error: `Finalize failed (${finRes.status})` },
        );
        continue;
      }

      if (finCreated.length > 0) {
        created.push(...finCreated);
      }
      errors.push(...finErrors);
    } catch (e) {
      errors.push({
        filename: f.name,
        error: e instanceof Error ? e.message : "Upload failed.",
      });
    }
  }

  if (created.length === 0 && errors.length > 0) {
    throw new Error(errors[0]?.error ?? "Upload failed");
  }

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

export async function fetchMeditationSounds(
  firebaseUid: string | null,
): Promise<MeditationSoundsResponse> {
  const url = new URL(MEDITATION_SOUNDS_URL);
  if (firebaseUid) {
    url.searchParams.set("firebase_uid", firebaseUid);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
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
