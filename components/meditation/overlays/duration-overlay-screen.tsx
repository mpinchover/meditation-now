"use client";

import { ModalSaveFooter } from "@/components/meditation/modal-save-footer";
import { PickerColumn } from "@/components/meditation/picker-column";

export function DurationOverlayScreen(props: {
  pendingHours: number;
  pendingMinutes: number;
  hourOptions: number[];
  minuteOptions: number[];
  onChangeHours: (h: number) => void;
  onChangeMinutes: (m: number) => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-14">
        <h2 className="mb-4 shrink-0 text-center text-lg font-semibold text-zinc-50">
          Duration
        </h2>
        <div className="flex min-h-0 flex-1 gap-3">
          <PickerColumn
            label="Hours"
            value={props.pendingHours}
            options={props.hourOptions}
            format={(v) => String(v)}
            onChange={props.onChangeHours}
          />
          <PickerColumn
            label="Minutes"
            value={props.pendingMinutes}
            options={props.minuteOptions}
            format={(v) => (v === 0 ? "0" : String(v).padStart(2, "0"))}
            onChange={props.onChangeMinutes}
          />
        </div>
      </div>
      <ModalSaveFooter onSave={props.onSave} />
    </>
  );
}
