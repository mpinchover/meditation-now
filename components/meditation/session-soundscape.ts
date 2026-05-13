export const SOUNDSCAPE_BASE_VOLUME = 0.85;
/** Fade soundscape volume over the last N seconds of each file before manual loop restart. */
export const SOUNDSCAPE_LOOP_FADE_SEC = 3;

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function applySoundscapeLoopFade(audio: HTMLAudioElement) {
  const d = audio.duration;
  if (!Number.isFinite(d) || d <= 0) {
    audio.volume = SOUNDSCAPE_BASE_VOLUME;
    return;
  }
  const fadeWindow = Math.min(SOUNDSCAPE_LOOP_FADE_SEC, d);
  const tail = d - audio.currentTime;
  if (tail <= fadeWindow && tail >= 0) {
    audio.volume = SOUNDSCAPE_BASE_VOLUME * smoothstep01(tail / fadeWindow);
  } else {
    audio.volume = SOUNDSCAPE_BASE_VOLUME;
  }
}

export function playBellOnce(url: string) {
  const a = new Audio(url);
  a.volume = 0.9;
  void a.play().catch(() => {});
}
