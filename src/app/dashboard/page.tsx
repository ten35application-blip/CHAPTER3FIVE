import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComposeSheet } from "./_components/ComposeSheet";
import { EditMenu } from "./_components/EditMenu";

export const metadata = {
  title: "chapter3five",
};

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

type Identity = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // RLS restricts to auth.uid() = user_id; still filter soft-deleted.
  const { data: identitiesRaw } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const identities: Identity[] = identitiesRaw ?? [];
  const email = user.email ?? "";

  return (
    <main className="relative min-h-dvh flex-1">
      {/* Top-left: Edit pill (with dropdown menu) */}
      <div className="fixed left-4 top-4 z-20">
        <EditMenu email={email} signOutAction={signOut} />
      </div>

      {/* Top-right: Trash icon — warm-tinted frosted button with a
          subtle coral ring so it participates in the brand color
          story instead of reading as neutral gray. */}
      <div className="fixed right-4 top-4 z-20">
        <Link
          href="/trash"
          aria-label="Recently deleted"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-soft/90 text-warm-200 shadow-[0_4px_12px_-2px_rgba(232,138,118,0.15)] ring-1 ring-warm-700/70 backdrop-blur transition-all hover:-translate-y-px hover:bg-ink-soft hover:text-coral-strong hover:ring-coral/40"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </Link>
      </div>

      {/* Conversation list */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-20 pb-32">
        {identities.length === 0 ? <EmptyState /> : <List items={identities} />}
      </div>

      {/* Bottom-right: + FAB with compose sheet */}
      <ComposeSheet
        identities={identities.map(({ id, name, avatar_url }) => ({
          id,
          name,
          avatar_url,
        }))}
      />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="hero-orb hero-orb-drift flex flex-col items-center pt-16 text-center sm:pt-24">
      <Image
        src="/logo.png"
        alt=""
        width={128}
        height={128}
        className="h-32 w-32 drop-shadow-[0_24px_60px_rgba(232,138,118,0.35)]"
      />
      <p className="mt-10 text-3xl font-bold tracking-tight text-warm-50">
        It&apos;s <span className="text-gradient-cta">quiet</span> in here.
      </p>
      <p className="mt-4 max-w-xs text-base leading-relaxed text-warm-300">
        Tap{" "}
        <span className="font-semibold text-warm-100">Edit</span>{" "}
        above to bring someone in.
      </p>
    </div>
  );
}

function List({ items }: { items: Identity[] }) {
  return (
    <ul className="overflow-hidden rounded-3xl bg-ink-soft shadow-[0_8px_28px_-16px_rgba(28,28,26,0.12),_0_2px_8px_-2px_rgba(232,138,118,0.08)] ring-1 ring-warm-700/60">
      {items.map((p, index) => (
        <li key={p.id}>
          {index > 0 ? (
            // Gradient hairline divider — the coral -> teal brand
            // gradient at 20% alpha, so rows are separated by a whisper
            // of color instead of a neutral gray line.
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/20 to-transparent" />
          ) : null}
          <Link
            href={`/chat/${p.id}`}
            className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-coral/5"
          >
            <Avatar name={p.name} url={p.avatar_url} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-semibold text-warm-50">
                {p.name}
              </span>
              <span className="truncate text-sm text-warm-300">
                Tap to start
              </span>
            </span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="text-warm-400 transition-colors group-hover:text-coral-strong"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
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
        className="h-12 w-12 rounded-full object-cover shadow-[0_4px_12px_-2px_rgba(232,138,118,0.25)] ring-2 ring-coral/20"
      />
    );
  }
  return (
    <span className="bg-gradient-cta flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]">
      {initial}
    </span>
  );
}
