"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for the Supabase password-recovery link. The link the
 * reset email carries brings the browser here with a live session
 * already established by @supabase/ssr's client (the recovery token
 * is auto-exchanged on mount). We just need to render a "set new
 * password" form and call supabase.auth.updateUser({password}).
 *
 * If someone lands here WITHOUT a session (bookmarked the URL, opened
 * the link on a different browser, link expired), we tell them so
 * plainly and offer the way back.
 *
 * On success: sign-out is optional — the current session is already
 * the updated user, so we just route to /dashboard and let them
 * continue. Wilson's rule: fewer taps, warmer chrome.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [hasSession, setHasSession] = useState<null | boolean>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Wait for the client to hydrate the session from the URL. Supabase
  // fires PASSWORD_RECOVERY when a recovery link is exchanged; either
  // that or an already-live session means the user can update their
  // password.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(data.session));
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(true);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  function submit() {
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two entries don't match.");
      return;
    }
    startTransition(async () => {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message || "Couldn't update your password. Try again.");
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push("/dashboard"), 1400);
    });
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="hero-orb hero-orb-drift flex flex-col items-center">
          <Image
            src="/logo-transparent.png"
            alt=""
            width={56}
            height={56}
            priority
            className="h-14 w-14 drop-shadow-[0_12px_32px_rgba(232,138,118,0.22)]"
          />
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-warm-50">
          Set a new password
        </h1>

        {hasSession === null ? (
          <p className="mt-4 text-sm text-warm-300">Checking your link&hellip;</p>
        ) : hasSession === false ? (
          <div className="mt-6 flex w-full flex-col gap-3 rounded-2xl bg-ink-soft p-6 text-left ring-1 ring-warm-700/70">
            <p className="text-sm leading-relaxed text-warm-100">
              This link isn&rsquo;t active. Reset links expire quickly,
              and they only work in the browser that opened them.
            </p>
            <Link
              href="/settings"
              className="mt-1 text-sm font-medium text-coral-strong hover:text-coral"
            >
              Back to settings &rarr; send a new link
            </Link>
          </div>
        ) : done ? (
          <p
            role="status"
            className="mt-6 rounded-2xl bg-teal/10 px-4 py-3 text-sm font-medium text-teal-strong ring-1 ring-teal/25"
          >
            Password updated. Sending you home&hellip;
          </p>
        ) : (
          <form
            className="mt-6 flex w-full flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-warm-300">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
                minLength={8}
                className="h-12 w-full rounded-xl bg-warm-700/25 px-3.5 text-[15px] text-warm-50 ring-1 ring-warm-700/60 transition-all placeholder:text-warm-500 focus:bg-warm-700/40 focus:outline-none focus:ring-2 focus:ring-coral/50"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-warm-300">
                Confirm
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="h-12 w-full rounded-xl bg-warm-700/25 px-3.5 text-[15px] text-warm-50 ring-1 ring-warm-700/60 transition-all placeholder:text-warm-500 focus:bg-warm-700/40 focus:outline-none focus:ring-2 focus:ring-coral/50"
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm font-medium text-coral-strong">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || !password || !confirm}
              className="bg-gradient-cta mt-2 flex h-13 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_10px_28px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
