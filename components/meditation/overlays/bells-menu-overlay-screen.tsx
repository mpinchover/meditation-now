"use client";

import type { BellCategory, CatalogBellSound } from "@/lib/meditation-mocks";
import { BELL_TYPE_MENU } from "@/components/meditation/types";
import { bellsMenuSummary } from "@/components/meditation/bell-summary";
import { FieldRow } from "@/components/meditation/field-row";
import { ModalSaveFooter } from "@/components/meditation/modal-save-footer";

export function BellsMenuOverlayScreen(props: {
  bellsCatalog: CatalogBellSound[];
  pendingStartingBellId: string | null;
  pendingEndingBellId: string | null;
  pendingIntervalBellId: string | null;
  pendingIntervalEveryMinutes: number;
  onOpenCategory: (id: BellCategory) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
        <h2 className="mb-6 shrink-0 text-center text-lg font-semibold text-zinc-50">
          Bells
        </h2>
        <div className="flex min-h-0 flex-1 flex-col justify-start gap-3">
          {BELL_TYPE_MENU.map((opt) => (
            <FieldRow
              key={opt.id}
              label={opt.label}
              value={bellsMenuSummary(
                props.bellsCatalog,
                opt.id,
                props.pendingStartingBellId,
                props.pendingEndingBellId,
                props.pendingIntervalBellId,
                props.pendingIntervalEveryMinutes,
              )}
              onOpen={() => props.onOpenCategory(opt.id)}
            />
          ))}
        </div>
      </div>
      <ModalSaveFooter onSave={props.onSave} />
    </>
  );
}
