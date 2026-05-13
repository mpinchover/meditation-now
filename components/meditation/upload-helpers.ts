/** Matches server `/upload-audio`: MP3 and WAV only. */
export function isUploadableSoundFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp3" || ext === "wav") return true;
  const t = file.type.toLowerCase();
  return (
    t === "audio/mpeg" ||
    t === "audio/wav" ||
    t === "audio/wave" ||
    t === "audio/x-wav"
  );
}
