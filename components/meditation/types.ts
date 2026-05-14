import type { BellCategory } from "@/lib/meditation-mocks";

export type ModalId =
  | "duration"
  | "soundtrack"
  | "bells"
  | "login"
  | "account"
  | null;

export type BellsUiStep = "menu" | BellCategory;

export type MySoundsUiStep = "main" | "add_files";

export type AddSoundUploadRow = {
  id: string;
  name: string;
  uploading: boolean;
  error: string | null;
};

export const BELL_TYPE_MENU: { id: BellCategory; label: string }[] = [
  { id: "starting", label: "Starting" },
  { id: "ending", label: "Ending" },
  { id: "interval", label: "Interval" },
];

export type SessionSnapshot = {
  totalSeconds: number;
  soundtrackId: string | null;
  /** Resolved at session start for custom soundscapes. */
  soundtrackMediaUrl: string | null;
  startingBellId: string | null;
  endingBellId: string | null;
  intervalBellId: string | null;
  intervalEveryMinutes: number;
};
