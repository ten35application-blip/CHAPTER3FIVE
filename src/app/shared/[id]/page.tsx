import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/components/Chat";

export const metadata = {
  title: "Shared archive — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SharedOraclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/signin?next=${encodeURIComponent(`/shared/${id}`)}`);

  // RLS allows this read if the user has an archive_grant on this oracle.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, preferred_language, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (!oracle) {
    // Either no grant (RLS blocked) or the oracle no longer exists.
    redirect("/dashboard?error=No%20access%20to%20that%20archive");
  }

  // Pull the invitee's own message history with this oracle.
  const { data: messageRows } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("oracle_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialHistory = (messageRows ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const language = (oracle.preferred_language ?? "en") as "en" | "es";

  return (
    <main className="flex-1 flex flex-col px-6 py-6 relative overflow-hidden">
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between mb-12">
        <Link
          href="/dashboard"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          ← chapter3five
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/shared/${id}/welcome`}
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
            title={language === "es" ? "Bienvenida" : "Orientation"}
          >
            {language === "es" ? "Inicio" : "Welcome"}
          </Link>
          <Link
            href={`/shared/${id}/archive`}
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
          >
            {language === "es" ? "Archivo" : "Archive"}
          </Link>
          <Link
            href="/beneficiary-groups"
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
            title={
              language === "es"
                ? "Cuartos grupales con otros beneficiarios"
                : "Group rooms with other beneficiaries"
            }
          >
            {language === "es" ? "Juntos" : "Together"}
          </Link>
          <a
            href={`/api/conversation/export?oracle_id=${id}`}
            download
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
            title={
              language === "es"
                ? "Descargar conversación"
                : "Download conversation"
            }
          >
            {language === "es" ? "Descargar" : "Download"}
          </a>
        </div>
      </header>

      <div className="flex-1 flex justify-center">
        <Chat
          oracleName={oracle.name ?? "your thirtyfive"}
          language={language}
          initialHistory={initialHistory}
          avatarUrl={oracle.avatar_url}
          oracleId={oracle.id}
        />
      </div>
    </main>
  );
}
