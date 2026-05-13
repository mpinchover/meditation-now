"use client";

import type { RefObject } from "react";
import type { AddSoundUploadRow } from "@/components/meditation/types";

export function SoundscapeAddFilesOverlayScreen(props: {
  addAudioFilesInputRef: RefObject<HTMLInputElement | null>;
  addSoundDropZoneRef: RefObject<HTMLDivElement | null>;
  addSoundDropActive: boolean;
  setAddSoundDropActive: (v: boolean) => void;
  addSoundUploadError: string | null;
  addSoundRows: AddSoundUploadRow[];
  onDone: () => void;
  onFilesSelected: (list: FileList | File[]) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="absolute left-3 top-3 z-10 flex h-10 items-center gap-0.5 rounded-full px-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
        aria-label="Done"
        onClick={props.onDone}
      >
        Done
      </button>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
        <input
          ref={props.addAudioFilesInputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) props.onFilesSelected(list);
            e.target.value = "";
          }}
        />

        <div
          ref={props.addSoundDropZoneRef}
          role="region"
          aria-label="Addsounds — drop MP3 or WAV files"
          onDragEnter={(e) => {
            e.preventDefault();
            props.setAddSoundDropActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            const related = e.relatedTarget as Node | null;
            if (
              related &&
              props.addSoundDropZoneRef.current?.contains(related)
            ) {
              return;
            }
            props.setAddSoundDropActive(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            props.setAddSoundDropActive(false);
            if (e.dataTransfer.files?.length) {
              props.onFilesSelected(e.dataTransfer.files);
            }
          }}
          className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl transition ${
            props.addSoundDropActive ? "bg-emerald-500/5" : "bg-zinc-950/50"
          }`}
        >
          <div className="shrink-0 border-b border-zinc-800/50 px-4 py-3 text-center">
            <p className="mt-2 text-sm font-medium text-zinc-300">
              Drop MP3 or WAV files here
            </p>
            {props.addSoundUploadError && (
              <p className="mt-2 text-center text-xs leading-snug text-red-400/90">
                {props.addSoundUploadError}
              </p>
            )}
          </div>

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
            {props.addSoundRows.length === 0 ? (
              <li className="list-none py-8 text-center text-sm text-zinc-600">
                No files yet
              </li>
            ) : (
              props.addSoundRows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300"
                >
                  <span className="min-w-0 flex-1 truncate" title={row.name}>
                    {row.name}
                  </span>
                  {row.uploading && (
                    <span
                      className="inline-flex size-4 shrink-0 items-center justify-center"
                      role="status"
                      aria-label={`Uploading ${row.name}`}
                    >
                      <span
                        className="size-3.5 shrink-0 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin"
                        aria-hidden
                      />
                    </span>
                  )}
                  {row.error && (
                    <span
                      className="max-w-[45%] shrink-0 truncate text-xs text-red-400/90"
                      title={row.error}
                    >
                      {row.error}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>

          <div className="shrink-0 border-t border-zinc-800/70 p-3">
            <button
              type="button"
              onClick={() => props.addAudioFilesInputRef.current?.click()}
              className="w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
            >
              Choose files
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
