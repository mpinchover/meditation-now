import type { BellCategory } from "@/lib/meditation-mocks";

export type ModalId =
  | "duration"
  | "soundtrack"
  | "bells"
  | "login"
  | "account"
  | null;

export type BellsUiStep = "menu" | BellCategory;

export const BELL_TYPE_MENU: { id: BellCategory; label: string }[] = [
  { id: "starting", label: "Starting" },
  { id: "ending", label: "Ending" },
  { id: "interval", label: "Interval" },
];

export type SessionSnapshot = {
  /** Epoch ms when the user tapped Begin (UTC instant). */
  startedAtEpochMs: number;
  totalSeconds: number;
  soundtrackId: string | null;
  /** Resolved at session start from the selected server soundscape. */
  soundtrackMediaUrl: string | null;
  startingBellId: string | null;
  endingBellId: string | null;
  intervalBellId: string | null;
  intervalEveryMinutes: number;
};
