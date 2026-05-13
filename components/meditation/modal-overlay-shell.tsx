"use client";

import type { ReactNode } from "react";

export function ModalOverlayShell(props: {
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-[2px]"
      role="presentation"
      onClick={props.onDismiss}
    >
      <div
        className="relative flex h-[min(92dvh,92vh)] w-full max-w-[23.4rem] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            props.onDismiss();
          }}
        >
          <span className="text-xl leading-none">×</span>
        </button>
        {props.children}
      </div>
    </div>
  );
}
