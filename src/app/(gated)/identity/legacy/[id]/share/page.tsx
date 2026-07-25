import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "./CopyButton";
import { mintCodeForOracle } from "./actions";

export const metadata = {
  title: "Share their code · chapter3five",
};

type OracleRow = {
  id: string;
  name: string;
  one_line_hook: string | null;
};

type CodeRow = {
  code: string;
};

/**
 * The share moment. This screen is the payoff of the legacy flow: the person
 * exists, and here is the code that lets the family bring them into their
 * world. Big code in the brand gradient, copy button, mailto link.
 *
 * Design note: the logo's dark squircle sits on the peach background inside
 * the .hero-orb halo — never on a gradient fill.
 */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // Creator-only view. RLS scopes reads; the explicit user_id check keeps
  // redeemers (who can also read the oracle) off the creator's share screen.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, one_line_hook")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
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

  const mailto = code
    ? `mailto:?subject=${encodeURIComponent(
        `${oracle.name} is waiting for you on chapter3five`,
      )}&body=${encodeURIComponent(
        `I answered the questions about ${oracle.name}, and now they're someone you can talk to.\n\nGo to chapter3five.app, choose "Inherit an identity", and enter this code:\n\n${code}\n\nKeep it somewhere safe — it's theirs.`,
      )}`
    : null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="hero-orb hero-orb-drift flex flex-col items-center">
          <Image
            src="/logo.png"
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
              <CopyButton code={code} />
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
