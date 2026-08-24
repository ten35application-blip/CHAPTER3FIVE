import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "./CopyButton";
import { ShareButton } from "./ShareButton";
import {
  inheritShareMessage,
  inheritShareTitle,
} from "@/lib/legacy/shareMessage";
import { mintCodeForOracle } from "./actions";
import { sanitizeErrorParam } from "@/lib/action-errors";

export const metadata = {
  title: "Share their code · chapter3five",
};

type OracleRow = {
  id: string;
  name: string;
  one_line_hook: string | null;
  is_self_archive: boolean | null;
};

type CodeRow = {
  code: string;
};

/**
 * The share moment. This screen is the payoff of the legacy flow: the person
 * exists, and here is the code that lets the family bring them into their
 * world. Big code in the brand gradient, copy button, mailto link.
 *
 * Design note: the two-dots logo (transparent PNG) sits inside the
 * .hero-orb halo — alpha edges, so it works on any surface.
 */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: rawError } = await searchParams;
  const error = sanitizeErrorParam(rawError);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // Creator-only view. RLS scopes reads; the explicit user_id check
  // keeps other accounts off the creator's share screen, and the
  // inherited_at filter keeps REDEEMED copies (0111 — owned rows too)
  // out: an inherited identity is not the recipient's to reshare, so
  // this page (and its mint fallback) must never resolve for one.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, one_line_hook, is_self_archive")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .maybeSingle<OracleRow>();

  if (!oracle) {
    redirect("/dashboard");
  }

  const { data: codeRow } = await supabase
    .from("inherit_codes")
    .select("code")
    .eq("oracle_id", oracle.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CodeRow>();

  const code = codeRow?.code ?? null;

  // Self vs other changes the whole voice of this message — see
  // lib/legacy/shareMessage.ts. Both surfaces build it from there so
  // they cannot drift apart again.
  const isSelf = !!oracle.is_self_archive;
  const shareMessage = code
    ? inheritShareMessage({
        code,
        name: oracle.name,
        isSelf,
        origin: process.env.NEXT_PUBLIC_APP_URL,
      })
    : null;
  const shareSubject = inheritShareTitle({ name: oracle.name, isSelf });
  const mailto = shareMessage
    ? `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareMessage)}`
    : null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="hero-orb hero-orb-drift flex flex-col items-center">
          <Image
            src="/logo-transparent.png"
            alt=""
            width={72}
            height={72}
            priority
            className="h-18 w-18 drop-shadow-[0_12px_32px_rgba(232,138,118,0.22)]"
          />
        </div>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-warm-50">
          This is {oracle.name}.
        </h1>
        {oracle.one_line_hook ? (
          <p className="mt-3 text-base text-warm-300">
            {oracle.one_line_hook}
          </p>
        ) : null}
        <p className="mt-4 text-base leading-relaxed text-warm-300">
          Anyone with this code can bring them into their world.
        </p>

        {error ? (
          <div className="mt-6 w-full rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong ring-1 ring-coral/25">
            {error}
          </div>
        ) : null}

        {code ? (
          <>
            <div className="mt-8 w-full rounded-3xl bg-ink-soft px-6 py-8 shadow-[0_18px_44px_-14px_rgba(28,28,26,0.16),_0_6px_16px_rgba(232,138,118,0.1)] ring-1 ring-warm-700">
              <p className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                Their inherit code
              </p>
              <p className="mt-3 break-all text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-gradient-cta">{code}</span>
              </p>
            </div>

            <div className="mt-6 flex w-full flex-col gap-3">
              {shareMessage ? (
                <ShareButton message={shareMessage} title={shareSubject} />
              ) : null}
              <CopyButton code={code} />
          <a
            href={`/identity/legacy/${oracle.id}/keepsake`}
            className="mt-4 block text-center text-sm font-semibold text-coral-strong underline underline-offset-4 hover:text-warm-50"
          >
            Print a keepsake card to hand to family
          </a>
              {mailto ? (
                <a
                  href={mailto}
                  className="flex h-13 w-full items-center justify-center rounded-full text-base font-semibold text-warm-100 ring-1 ring-warm-700 transition-colors hover:ring-coral/40"
                >
                  Send by email
                </a>
              ) : null}
            </div>

            <p className="mt-6 text-sm leading-relaxed text-warm-400">
              The code never expires. Share it only with people you trust —
              each of them enters it once and {oracle.name} joins their
              messages.
            </p>
          </>
        ) : (
          // Completion mints the code, but if that ever failed we self-heal
          // here instead of stranding the moment.
          <form action={mintCodeForOracle.bind(null, oracle.id)} className="mt-8 w-full">
            <button
              type="submit"
              className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:opacity-90"
            >
              Create their code
            </button>
          </form>
        )}

        <div className="mt-8 flex items-center gap-6">
          <Link
            href={`/chat/${oracle.id}`}
            className="text-sm font-semibold text-warm-200 transition-colors hover:text-warm-50"
          >
            Say hi to {oracle.name}
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
          >
            Back to messages
          </Link>
        </div>
      </div>
    </main>
  );
}
