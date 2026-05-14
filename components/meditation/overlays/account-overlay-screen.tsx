"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

export function AccountOverlayScreen(props: {
  email: string;
  onLoggedOut?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    setBusy(true);
    try {
      await signOut(getFirebaseAuth());
      props.onLoggedOut?.();
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-5 pt-14">
      <h2 className="mb-5 text-left text-lg font-semibold text-zinc-50">Account</h2>

      <div className="flex min-h-0 flex-1 flex-col items-start gap-2 self-stretch px-1 pt-1">
        <p className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          Email
        </p>
        <p className="w-full break-all text-left text-sm font-medium text-zinc-100">
          {props.email}
        </p>
      </div>

      <div className="mt-auto shrink-0 pt-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleLogout()}
          className="w-full rounded-xl border border-red-900/60 bg-zinc-950 py-3 text-center text-sm font-semibold text-red-400 transition hover:border-red-800/80 hover:bg-red-950/40 hover:text-red-300 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? "Signing out…" : "Log out"}
        </button>
        {error && (
          <p className="mt-2 text-center text-xs leading-snug text-zinc-400">{error}</p>
        )}
      </div>
    </div>
  );
}
