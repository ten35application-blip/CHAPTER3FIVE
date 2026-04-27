import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BeneficiaryGroupCreator } from "@/components/BeneficiaryGroupCreator";

export const metadata = {
  title: "Group rooms — chapter3five",
};

export default async function BeneficiaryGroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin?next=/beneficiary-groups");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();
  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  const admin = createAdminClient();

  // Archives the user can be in a beneficiary room for: ones they
  // have an archive_grant on AND whose owner is deceased.
  const { data: grants } = await admin
    .from("archive_grants")
    .select("oracle_id")
    .eq("user_id", user.id);

  const grantedOracleIds = (grants ?? []).map((g) => g.oracle_id);
  const { data: oracles } = grantedOracleIds.length
    ? await admin
        .from("oracles")
        .select("id, name, avatar_url, user_id")
        .in("id", grantedOracleIds)
    : { data: [] };

  const ownerIds = Array.from(
    new Set((oracles ?? []).map((o) => o.user_id)),
  );
  const { data: ownerProfiles } = ownerIds.length
    ? await admin
        .from("profiles")
        .select("id, deceased_at")
        .in("id", ownerIds)
    : { data: [] };
  const deceasedOwners = new Set(
    (ownerProfiles ?? [])
      .filter((p) => p.deceased_at)
      .map((p) => p.id),
  );

  const eligibleArchives = (oracles ?? [])
    .filter((o) => deceasedOwners.has(o.user_id))
    .map((o) => ({
      id: o.id,
      name: o.name ?? "their archive",
      avatarUrl: o.avatar_url,
    }));

  // Existing rooms the user is in.
  const { data: memberRows } = await admin
    .from("beneficiary_room_members")
    .select("room_id")
    .eq("user_id", user.id)
    .is("left_at", null);

  const roomIds = (memberRows ?? []).map((r) => r.room_id);
  const { data: rooms } = roomIds.length
    ? await admin
        .from("beneficiary_rooms")
        .select("id, oracle_id, name, language, created_at, last_message_at")
        .in("id", roomIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    : { data: [] };

  const roomOracleIds = Array.from(
    new Set((rooms ?? []).map((r) => r.oracle_id)),
  );
  const { data: roomOracles } = roomOracleIds.length
    ? await admin
        .from("oracles")
        .select("id, name, avatar_url")
        .in("id", roomOracleIds)
    : { data: [] };
  const roomOracleMap = new Map(
    (roomOracles ?? []).map((o) => [o.id, o]),
  );

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            ← chapter3five
          </Link>
          <span className="text-xs uppercase tracking-[0.25em] text-warm-300">
            {t.heading}
          </span>
        </header>

        <h1 className="font-serif text-4xl text-warm-50 mb-3">
          <span className="italic font-light">{t.title}</span>
        </h1>
        <p className="text-warm-300 leading-relaxed mb-10 max-w-xl">
          {t.intro}
        </p>

        <BeneficiaryGroupCreator
          eligibleArchives={eligibleArchives}
          language={language}
        />

        <div className="space-y-3 mt-12">
          {(rooms ?? []).map((r) => {
            const oracle = roomOracleMap.get(r.oracle_id);
            return (
              <Link
                key={r.id}
                href={`/beneficiary-groups/${r.id}`}
                className="block rounded-2xl border border-warm-700/60 bg-warm-700/15 px-5 py-4 hover:bg-warm-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {oracle?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={oracle.avatar_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-warm-300/30"
                    />
                  ) : (
                    <span className="w-12 h-12 rounded-full bg-warm-700/40 border border-warm-300/30 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg text-warm-50 truncate">
                      {r.name}
                    </p>
                    <p className="text-xs text-warm-300 truncate mt-0.5">
                      {language === "es" ? "con" : "with"}{" "}
                      {oracle?.name ?? t.someone}
                    </p>
                  </div>
                  <span className="text-xs text-warm-400 flex-shrink-0">
                    {r.last_message_at
                      ? new Date(r.last_message_at).toLocaleDateString(
                          language === "es" ? "es" : "en",
                          { month: "short", day: "numeric" },
                        )
                      : t.justMade}
                  </span>
                </div>
              </Link>
            );
          })}

          {(!rooms || rooms.length === 0) && (
            <p className="text-warm-300 italic text-center py-8">
              {eligibleArchives.length > 0 ? t.empty : t.noEligible}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

const COPY = {
  en: {
    heading: "Group rooms",
    title: "Sit with them — together.",
    intro:
      "If you and other beneficiaries inherited the same archive, you can sit with them in one room together. The archive responds to all of you. Each person sees the others' messages. It's the closest thing to a real shared moment with someone who's gone — and you don't have to be alone with it.",
    empty: "No rooms yet. Create one above.",
    noEligible:
      "Group rooms are for archives whose owner has passed away. None of yours are in that state right now.",
    someone: "their archive",
    justMade: "new",
  },
  es: {
    heading: "Cuartos grupales",
    title: "Estar con ellos — juntos.",
    intro:
      "Si tú y otros beneficiarios heredaron el mismo archivo, pueden estar con ellos en un cuarto juntos. El archivo les responde a todos. Cada persona ve los mensajes de las otras. Es lo más cercano a un momento compartido real con alguien que ya no está — y no tienes que pasarlo solo.",
    empty: "Aún no hay cuartos. Crea uno arriba.",
    noEligible:
      "Los cuartos grupales son para archivos cuyo dueño ha fallecido. Ninguno de los tuyos está en ese estado ahora.",
    someone: "su archivo",
    justMade: "nuevo",
  },
};
