"use client";

import type { CatalogSoundscape } from "@/lib/meditation-mocks";
import { EditGlyph } from "@/components/meditation/edit-glyph";
import { ModalSaveFooter } from "@/components/meditation/modal-save-footer";

export function SoundscapePickerOverlayScreen(props: {
  mySoundscapes: CatalogSoundscape[];
  pendingSoundtrackId: string | null;
  soundscapePulseId: string | null;
  mySoundsEditError: string | null;
  mySoundsEditingId: string | null;
  mySoundsEditingName: string;
  mySoundsEditMenuId: string | null;
  mySoundsDeleteConfirmId: string | null;
  mySoundsEditBusy: boolean;
  onPendingSoundtrackChange: (id: string | null) => void;
  onStopPreview: () => void;
  onStartPreview: (url: string, loop: boolean) => void;
  onSoundscapePulseChange: (id: string | null) => void;
  onMySoundsEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRowEdit: () => void;
  onToggleEditMenu: (id: string) => void;
  onStartRename: (s: CatalogSoundscape) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onOpenAddFiles: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
        <h2 className="mb-3 shrink-0 text-center text-lg font-semibold text-zinc-50">
          Soundscape
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          {props.mySoundsEditError && (
            <p className="shrink-0 px-3 text-xs leading-snug text-red-400/90">
              {props.mySoundsEditError}
            </p>
          )}
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
            <li key="__none">
              <button
                type="button"
                onClick={() => {
                  props.onPendingSoundtrackChange(null);
                  props.onStopPreview();
                  props.onSoundscapePulseChange(null);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.045] active:bg-white/[0.06] ${
                  props.pendingSoundtrackId === null
                    ? "font-medium text-zinc-50"
                    : "text-zinc-500"
                }`}
              >
                <span className="min-w-0 flex-1">None</span>
              </button>
            </li>
            {props.mySoundscapes.length === 0 && (
              <li className="list-none px-3 py-8 text-center text-sm text-zinc-500">
                No custom sounds yet.
              </li>
            )}
            {props.mySoundscapes.map((s) => {
              const selected = props.pendingSoundtrackId === s.id;
              return (
                <li
                  key={s.id}
                  className="rounded-lg transition hover:bg-white/[0.035]"
                >
                  {props.mySoundsEditingId === s.id ? (
                    <div className="px-3 py-2.5">
                      <input
                        type="text"
                        value={props.mySoundsEditingName}
                        onChange={(e) =>
                          props.onMySoundsEditingNameChange(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void props.onSaveRename();
                          }
                        }}
                        className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-1"
                        autoFocus
                        disabled={props.mySoundsEditBusy}
                        aria-label="Track name"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            props.mySoundsEditBusy ||
                            !props.mySoundsEditingName.trim()
                          }
                          onClick={() => void props.onSaveRename()}
                          className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={props.mySoundsEditBusy}
                          onClick={props.onCancelRowEdit}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button
                          type="button"
                          title={s.name}
                          onClick={() => {
                            props.onPendingSoundtrackChange(s.id);
                            if (!s.media_url.trim()) {
                              props.onStopPreview();
                              props.onSoundscapePulseChange(null);
                              return;
                            }
                            props.onSoundscapePulseChange(s.id);
                            props.onStartPreview(s.media_url, true);
                          }}
                          className={`min-w-0 flex-1 truncate text-left text-sm transition active:opacity-90 ${
                            selected ? "font-medium text-zinc-50" : "text-zinc-500"
                          }`}
                        >
                          {s.name}
                        </button>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {props.soundscapePulseId === s.id ? (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-zinc-400 preview-pulse-dot"
                              aria-hidden
                            />
                          ) : null}
                          <button
                            type="button"
                            aria-label={`Edit ${s.name}`}
                            disabled={props.mySoundsEditBusy}
                            onClick={() => props.onToggleEditMenu(s.id)}
                            className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-40"
                          >
                            <EditGlyph className="size-5" />
                          </button>
                        </div>
                      </div>
                      {props.mySoundsEditMenuId === s.id && (
                        <div className="flex flex-wrap gap-2 border-t border-zinc-800/50 px-3 pb-2.5 pt-2">
                          <button
                            type="button"
                            disabled={props.mySoundsEditBusy}
                            onClick={() => props.onStartRename(s)}
                            className="rounded-lg border border-zinc-600 bg-zinc-800/90 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-40"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            disabled={props.mySoundsEditBusy}
                            onClick={() => props.onRequestDelete(s.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400/90 transition hover:bg-red-500/10 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {props.mySoundsDeleteConfirmId === s.id && (
                        <div className="flex flex-col gap-2 border-t border-zinc-800/50 px-3 pb-2.5 pt-2">
                          <p className="text-xs leading-snug text-zinc-400">
                            Remove &ldquo;{s.name}&rdquo;? This cannot be undone.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={props.mySoundsEditBusy}
                              onClick={() => void props.onConfirmDelete(s.id)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                            >
                              Remove track
                            </button>
                            <button
                              type="button"
                              disabled={props.mySoundsEditBusy}
                              onClick={props.onCancelDelete}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="shrink-0 border-t border-zinc-800/70 pt-3">
            <button
              type="button"
              onClick={props.onOpenAddFiles}
              className="w-full rounded-xl border border-zinc-600 bg-zinc-800/90 py-3 text-center text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.99]"
            >
              Add sounds
            </button>
          </div>
        </div>
      </div>
      <ModalSaveFooter onSave={props.onSave} />
    </>
  );
}
