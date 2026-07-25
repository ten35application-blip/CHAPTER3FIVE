import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createIdentity } from "./actions";
import { AutoGenerate } from "./AutoGenerate";

export const metadata = {
  title: "Someone new · chapter3five",
};

type Identity = {
  id: string;
  name: string;
  one_line_hook: string;
  avatar_url: string | null;
};

export default async function IdentityNewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const { id, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // No id yet — kick off generation and show the loader.
  if (!id) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center">
          {error ? (
            // The action bounced back with a friendly error. Give the
            // user a "Try again" button rather than looping into a
            // fresh generation on mount.
            <RetryPanel message={error} />
          ) : (
            <AutoGenerate />
          )}
        </div>
      </main>
    );
  }

  // Load the reveal card. RLS restricts to the caller's own oracles.
  const { data: identity } = await supabase
    .from("oracles")
    .select("id, name, one_line_hook, avatar_url")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Identity>();

  if (!identity) {
    // Not the user's identity, or deleted. Send them home.
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-warm-300">
          Meet
        </p>

        <Avatar name={identity.name} url={identity.avatar_url} />

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {identity.name}
        </h1>
        <p className="mt-3 text-base text-warm-300">{identity.one_line_hook}</p>

        <Link
          href={`/chat/${identity.id}`}
          className="mt-10 flex h-14 w-full items-center justify-center rounded-full bg-amber text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(107,140,175,0.55),_0_4px_12px_rgba(232,138,118,0.12)] transition-all hover:-translate-y-px hover:shadow-[0_18px_44px_-10px_rgba(107,140,175,0.6),_0_6px_14px_rgba(232,138,118,0.15)] active:translate-y-0 active:opacity-90"
        >
          Say hi
        </Link>

        {/* No "not this one" reroll — you get who you get. Every
            generation costs real money (formula + Claude synthesis +
            face generation), and giving users an infinite retry
            button would both bleed cost and undermine the premise
            that this is a specific person made for you. */}

        <Link
          href="/dashboard"
          className="mt-6 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Back to messages
        </Link>
      </div>
    </main>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="mt-6 h-24 w-24 rounded-full object-cover shadow-[0_18px_50px_rgba(232,138,118,0.28)]"
      />
    );
  }
  return (
    <span className="mt-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber text-4xl font-semibold text-white shadow-[0_18px_50px_rgba(232,138,118,0.28)]">
      {initial}
    </span>
  );
}

function RetryPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <Image
        src="/logo-transparent.png"
        alt=""
        width={64}
        height={64}
        className="h-16 w-16 drop-shadow-[0_12px_32px_rgba(232,138,118,0.22)]"
      />
      <p className="mt-6 text-lg font-medium text-warm-50">{message}</p>
      <form action={createIdentity} className="mt-6 w-full">
        <button
          type="submit"
          className="flex h-14 w-full items-center justify-center rounded-full bg-amber text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(107,140,175,0.55),_0_4px_12px_rgba(232,138,118,0.12)] transition-all hover:-translate-y-px active:opacity-90"
        >
          Try again
        </button>
      </form>
      <Link
        href="/dashboard"
        className="mt-4 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
      >
        Back to messages
      </Link>
    </div>
  );
}
