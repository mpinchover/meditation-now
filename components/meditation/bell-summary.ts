import type { BellCategory, CatalogBellSound } from "@/lib/meditation-mocks";

function bellNameOrNone(
  id: string | null,
  catalog: { id: string; name: string }[],
): string {
  if (id === null) return "None";
  return catalog.find((b) => b.id === id)?.name ?? "None";
}

export function bellsMenuSummary(
  bells: CatalogBellSound[],
  cat: BellCategory,
  startingId: string | null,
  endingId: string | null,
  intervalId: string | null,
  intervalMinutes: number,
): string {
  switch (cat) {
    case "starting":
      return bellNameOrNone(startingId, bells);
    case "ending":
      return bellNameOrNone(endingId, bells);
    case "interval":
      if (intervalId === null) return "None";
      return `${bellNameOrNone(intervalId, bells)} · every ${intervalMinutes}m`;
  }
}
