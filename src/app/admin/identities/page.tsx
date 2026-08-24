import Link from "next/link";
import {
  createAdminClient,
  getEmailMap,
  safeSelect,
} from "@/lib/admin/queries";

type OracleRow = {
  id: string;
  name: string;
  inherited_at: string | null;
  is_self_archive: boolean | null;
  creation_source: string | null;
  user_id: string;
  is_legacy: boolean | null;
  one_line_hook: string | null;
  created_at: string;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "randomized", label: "Randomized" },
  { key: "legacy", label: "Legacy" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/**
 * /admin/identities — the 100 most recent identities, filterable by
 * type. Filter chips are plain links (server-rendered) — no client
 * state needed.
 */
export default async function AdminIdentitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey =
    rawFilter === "randomized" || rawFilter === "legacy" ? rawFilter : "all";

  const supabase = createAdminClient();
  const [oracles, emails] = await Promise.all([
    safeSelect<OracleRow>(
      supabase,
      "oracles",
      "id, name, user_id, is_legacy, one_line_hook, created_at, inherited_at, is_self_archive, creation_source",
      (q) => {
        let query = q.is("deleted_at", null);
        // is_legacy is null on pre-0055 rows — treat null as randomized.
        if (filter === "legacy") query = query.eq("is_legacy", true);
        if (filter === "randomized")
          query = query.or("is_legacy.eq.false,is_legacy.is.null");
        return query.order("created_at", { ascending: false }).limit(100);
      },
    ),
    getEmailMap(supabase),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
          Identities
        </h1>
        <p className="text-sm text-warm-300">100 most recent, newest first.</p>
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/identities" : `/admin/identities?filter=${f.key}`}
            className={
              filter === f.key
                ? "bg-gradient-cta rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full px-4 py-1.5 text-sm font-medium text-warm-300 ring-1 ring-warm-700 transition-colors hover:bg-warm-700/40 hover:text-warm-100"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        {oracles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-warm-300">
            Nothing here yet — new identities appear the moment someone
            creates one.
          </p>
        ) : (
          oracles.map((o) => (
            <Link
              key={o.id}
              href={`/admin/identities/${o.id}`}
              className="grid grid-cols-[1fr_6.5rem] items-center gap-3 border-b border-warm-700/60 px-4 py-3 text-sm transition-colors last:border-b-0 odd:bg-ink hover:bg-coral/5 sm:grid-cols-[minmax(8rem,14rem)_6.5rem_1fr_6.5rem]"
            >
              <span className="truncate font-medium text-warm-50">{o.name}</span>
              {/* An inherited COPY carries the same name as its source
                  archive — unlabeled, one redeemed code reads as "it
                  came in twice" in this list (Wilson 2026-08-26, over
                  Pedro's archive + its redeemed copy). Say what each
                  row IS. */}
              <span
                className={
                  o.inherited_at
                    ? "justify-self-start rounded-full bg-warm-700/60 px-2.5 py-0.5 text-xs font-semibold text-warm-200"
                    : o.is_legacy
                      ? "justify-self-start rounded-full bg-teal/15 px-2.5 py-0.5 text-xs font-semibold text-teal-strong"
                      : "justify-self-start rounded-full bg-coral/10 px-2.5 py-0.5 text-xs font-semibold text-coral-strong"
                }
              >
                {o.inherited_at
                  ? "Inherited copy"
                  : o.is_self_archive
                    ? "Archive (self)"
                    : o.is_legacy
                      ? "Archive (other)"
                      : o.creation_source === "photo"
                        ? "Photo"
                        : "Random"}
              </span>
              <span className="hidden truncate text-warm-300 sm:block">
                {emails.get(o.user_id) ?? o.user_id}
              </span>
              <span className="text-right text-xs text-warm-400 sm:text-sm">
                {new Date(o.created_at).toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
