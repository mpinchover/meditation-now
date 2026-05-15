import type { User } from "firebase/auth";
import { SESSIONS_POST_URL } from "@/lib/meditation-sounds-api";

/** Persists a finish event when the user taps Finish (server writes to Firestore). */
export async function recordSessionFinishIfAuthenticated(
  user: User,
  startedAtMs: number,
): Promise<void> {
  const idToken = await user.getIdToken();
  const finishedAtMs = Date.now();
  const res = await fetch(SESSIONS_POST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      started_at_ms: startedAtMs,
      finished_at_ms: finishedAtMs,
    }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === "string") detail = j.error;
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(`POST /sessions failed (${res.status}): ${detail}`);
  }
}
