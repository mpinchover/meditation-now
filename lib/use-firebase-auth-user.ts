"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";

export function useFirebaseAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      unsub = onAuthStateChanged(auth, (next) => {
        setUser(next);
        setAuthReady(true);
      });
    } catch {
      setUser(null);
      setAuthReady(true);
    }
    return () => unsub?.();
  }, []);

  return { user, authReady };
}
