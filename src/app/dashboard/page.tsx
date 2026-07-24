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

      {/* Top-right: Trash icon */}
      <div className="fixed right-4 top-4 z-20">
        <Link
          href="/trash"
          aria-label="Recently deleted"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-700/70 text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
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
    <div className="flex flex-col items-center pt-24 text-center">
      <Image
        src="/logo.png"
        alt=""
        width={96}
        height={96}
        className="h-24 w-24 drop-shadow-[0_18px_50px_rgba(232,138,118,0.28)]"
      />
      <p className="mt-8 text-xl font-medium text-warm-50">
        It&apos;s quiet in here.
      </p>
      <p className="mt-2 max-w-xs text-sm text-warm-300">
        Tap <span className="font-medium text-warm-100">Edit</span> above to
        bring someone in.
      </p>
    </div>
  );
}

function List({ items }: { items: Identity[] }) {
  return (
    <ul className="divide-y divide-warm-700/60 rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
      {items.map((p) => (
        <li key={p.id}>
          <Link
            href={`/chat/${p.id}`}
            className="flex items-center gap-3 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl hover:bg-warm-700/20"
          >
            <Avatar name={p.name} url={p.avatar_url} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-medium text-warm-50">
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
              className="text-warm-400"
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
        className="h-11 w-11 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warm-700/60 text-base font-semibold text-warm-100">
      {initial}
    </span>
  );
}
