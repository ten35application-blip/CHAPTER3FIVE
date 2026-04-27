import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupChat } from "@/components/GroupChat";

export const metadata = {
  title: "Group — chapter3five",
};

const MAX_GROUP_SIZE = 3;

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();

  const language = (profile?.preferred_language ?? "en") as "en" | "es";

  const { data: oraclesAll } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, onboarding_completed")
    .eq("user_id", user.id)
    .eq("onboarding_completed", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const oracles = oraclesAll ?? [];

  // Resolve which oracles are in this group (from query string).
  const requestedIds = (ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_GROUP_SIZE);

  const validIds = new Set(oracles.map((o) => o.id));
  const groupIds = requestedIds.filter((id) => validIds.has(id));
  const groupMembers = groupIds
    .map((id) => oracles.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  return (
    <main className="flex-1 flex flex-col px-6 py-6 relative overflow-hidden">
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between mb-8">
        <Link
          href="/dashboard"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          ← chapter3five
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
          {language === "es" ? "Grupo" : "Group"}
        </span>
      </header>

      {groupMembers.length === 0 ? (
        <GroupSelector
          oracles={oracles.map((o) => ({
            id: o.id,
            name: o.name ?? "(untitled)",
            avatar_url: o.avatar_url ?? null,
          }))}
          language={language}
        />
      ) : (
        <GroupChat
          members={groupMembers.map((o) => ({
            id: o.id,
            name: o.name ?? "(untitled)",
            avatar_url: o.avatar_url ?? null,
          }))}
          language={language}
        />
      )}
    </main>
  );
}

function GroupSelector({
  oracles,
  language,
}: {
  oracles: { id: string; name: string; avatar_url: string | null }[];
  language: "en" | "es";
}) {
  const t = COPY[language];
  return (
    <div className="max-w-2xl w-full mx-auto">
      <h1 className="font-serif text-3xl text-warm-50 mb-2">{t.title}</h1>
      <p className="text-warm-200 mb-8 leading-relaxed">{t.subtitle}</p>

      {oracles.length < 2 ? (
        <div className="rounded-2xl border border-warm-700/60 bg-warm-700/20 p-5">
          <p className="text-warm-100 text-sm leading-relaxed">{t.needMore}</p>
        </div>
      ) : (
        <GroupSelectorClient oracles={oracles} language={language} />
      )}
    </div>
  );
}

import { GroupSelectorClient } from "@/components/GroupSelectorClient";

const COPY = {
  en: {
    title: "Pick up to three.",
    subtitle:
      "A group chat. Send one message — each identity replies in their own voice. Made for the moments you don't want to be alone in a thread.",
    needMore: "You need at least two identities to start a group. Create one from the user menu.",
  },
  es: {
    title: "Elige hasta tres.",
    subtitle:
      "Un chat grupal. Mandas un mensaje — cada identity contesta en su propia voz. Para los momentos en que no quieres estar solo en un hilo.",
    needMore: "Necesitas al menos dos identities para empezar un grupo. Crea uno desde el menú.",
  },
};
