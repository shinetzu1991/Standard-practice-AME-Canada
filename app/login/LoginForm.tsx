"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import PartnerBadge from "../PartnerBadge";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  type AuthState,
} from "./actions";

const INPUT =
  "w-full rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-blue-200 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-600";

export default function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(
    signInWithEmail,
    { error: initialError },
  );
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(
    signUpWithEmail,
    {},
  );
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-blue-50 to-sky-100 p-6 shadow-xl shadow-blue-900/15 ring-1 ring-blue-200 sm:p-8 dark:from-slate-900 dark:to-slate-900 dark:shadow-black/40 dark:ring-slate-700">
      <div className="mb-6 text-center">
        <Image
          src="/icons/icon-192.png"
          alt="M2 Canada logo"
          width={80}
          height={80}
          priority
          className="mx-auto mb-3 h-20 w-20 rounded-2xl shadow-lg shadow-blue-900/25"
        />
        <h1 className="text-2xl font-extrabold">M2 Canada</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === "signin" ? "Sign in to practice" : "Create your free account"}
        </p>
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-sm ring-1 ring-slate-300 transition hover:bg-slate-50 dark:bg-slate-800 dark:ring-slate-600 dark:hover:bg-slate-700"
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-blue-200 dark:bg-slate-700" />
        or with email
        <span className="h-px flex-1 bg-blue-200 dark:bg-slate-700" />
      </div>

      <form action={mode === "signin" ? signInAction : signUpAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <input name="name" placeholder="Full name" autoComplete="name" className={INPUT} required />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          className={INPUT}
          required
        />
        <input
          name="password"
          type="password"
          placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          className={INPUT}
          required
        />

        {state.error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
            {state.error}
          </p>
        )}
        {state.message && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-300"
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
        When you sign in we keep your name, email and approximate location
        (city and country) to manage access to the site.
      </p>

      <PartnerBadge className="mt-5 !ring-blue-100" />
    </div>
  );
}
