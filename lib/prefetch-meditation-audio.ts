import type { MeditationSoundsResponse } from "@/lib/meditation-sounds-api";

/** Deduped media URLs from bells + custom soundscapes (library soundscapes are not used in the app UI). */
export function collectMeditationAudioUrls(data: MeditationSoundsResponse): string[] {
  const urls: string[] = [];
  for (const b of data.bells) {
    const u = b.media_url;
    if (typeof u === "string" && u.trim().length > 0) urls.push(u.trim());
  }
  for (const c of data.custom_soundscapes) {
    const u = c.media_url;
    if (typeof u === "string" && u.trim().length > 0) urls.push(u.trim());
  }
  return [...new Set(urls)];
}

let prefetchGeneration = 0;

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => fn(), { timeout: 1200 });
  } else {
    setTimeout(fn, 32);
  }
}

/**
 * Warm the HTTP cache for bell + custom soundscape media URLs without blocking the UI.
 * Uses small batches in idle time (not parallel Audio decode), so clicks stay responsive.
 */
export function prefetchMeditationSounds(data: MeditationSoundsResponse): void {
  const urls = collectMeditationAudioUrls(data);
  if (urls.length === 0) return;

  const gen = ++prefetchGeneration;
  const batchSize = 2;

  const runBatch = (start: number) => {
    if (gen !== prefetchGeneration) return;
    if (start >= urls.length) return;

    const slice = urls.slice(start, start + batchSize);
    void Promise.all(
      slice.map((url) =>
        fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" }).catch(
          () => undefined,
        ),
      ),
    ).finally(() => {
      if (gen !== prefetchGeneration) return;
      const next = start + batchSize;
      if (next < urls.length) {
        scheduleIdle(() => runBatch(next));
      }
    });
  };

  scheduleIdle(() => runBatch(0));
}
