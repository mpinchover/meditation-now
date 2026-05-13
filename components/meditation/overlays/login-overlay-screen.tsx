"use client";

import { useState } from "react";

type AuthMode = "login" | "signup";

export function LoginOverlayScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

  function switchMode(next: AuthMode) {
    setMode(next);
    setFormMessage(null);
    if (next === "login") setConfirmPassword("");
  }

  function handleUsernamePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage(null);
    if (!username.trim() || !password) {
      setFormMessage("Enter a username and password.");
      return;
    }
    if (mode === "signup") {
      if (password !== confirmPassword) {
        setFormMessage("Passwords do not match.");
        return;
      }
      if (password.length < 8) {
        setFormMessage("Use a password of at least 8 characters.");
        return;
      }
      setFormMessage("Sign-up is not wired up yet — connect your API here.");
      return;
    }
    setFormMessage("Sign-in is not wired up yet — connect your API here.");
  }

  function handleGoogleAuth() {
    setFormMessage(
      mode === "signup"
        ? "Google sign-up is not wired up yet — add OAuth to enable this."
        : "Google sign-in is not wired up yet — add OAuth to enable this.",
    );
  }

  const title = mode === "login" ? "Log in" : "Sign up";
 

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start overflow-y-auto px-4 pb-5 pt-14">
      <h2 className="mb-5 text-center text-lg font-semibold text-zinc-50">{title}</h2>
     

      <form onSubmit={handleUsernamePasswordSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="auth-username"
            className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Username
          </label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 placeholder:text-zinc-600 focus:ring-1"
            placeholder="your.name"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 placeholder:text-zinc-600 focus:ring-1"
            placeholder="••••••••"
          />
        </div>
        {mode === "signup" && (
          <div className="space-y-1.5">
            <label
              htmlFor="auth-confirm-password"
              className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Confirm password
            </label>
            <input
              id="auth-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-zinc-500 placeholder:text-zinc-600 focus:ring-1"
              placeholder="••••••••"
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-center text-sm font-semibold text-zinc-50 transition hover:border-zinc-500 hover:bg-zinc-700 active:scale-[0.99]"
        >
          {mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="mt-3 text-center text-xs leading-relaxed text-zinc-500">
        {mode === "login" ? (
          <>
            Need an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100"
              aria-label="Switch to sign up"
            >
              Click here
            </button>
          </>
        ) : (
          <>
            Have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-100"
              aria-label="Switch to log in"
            >
              Click here
            </button>
          </>
        )}
      </p>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px min-w-0 flex-1 bg-zinc-800" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">
          or
        </span>
        <span className="h-px min-w-0 flex-1 bg-zinc-800" aria-hidden />
      </div>

      <button
        type="button"
        onClick={handleGoogleAuth}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-950 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800/80 active:scale-[0.99]"
      >
        <GoogleGlyph className="size-5 shrink-0" />
        {mode === "login" ? "Continue with Google" : "Sign up with Google"}
      </button>

      {formMessage && (
        <p className="mt-3 text-center text-xs leading-snug text-zinc-400">{formMessage}</p>
      )}
    </div>
  );
}

function GoogleGlyph(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
