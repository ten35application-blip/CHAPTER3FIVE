import Link from "next/link";
import { isAdmin } from "@/lib/admin/allowlist";
import {
  createAdminClient,
  listAllUsers,
  safeSelect,
} from "@/lib/admin/queries";
import { SearchBox } from "./SearchBox";

const PAGE_SIZE = 50;

/**
 * /admin/users — every account, newest first, with email search and
 * 50-per-page pagination. Emails come from the GoTrue admin API (the
 * auth schema isn't reachable through PostgREST); identity counts and
 * terms state are stitched on from service-role table reads.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; plan?: string }>;
}) {
  const { q = "", page: pageParam, plan: planFilter } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const activeFilter = ["pro", "trial", "comped", "cancel", "free"].includes(
    planFilter ?? "",
  )
    ? (planFilter as "pro" | "trial" | "comped" | "cancel" | "free")
    : null;

  const supabase = createAdminClient();

  const [users, oracles, profiles] = await Promise.all([
    listAllUsers(supabase),
    safeSelect<{ user_id: string; updated_at: string }>(
      supabase,
      "oracles",
      "user_id, updated_at",
      (query) => query.is("deleted_at", null),
    ),
    safeSelect<{
      id: string;
      terms_accepted_at: string | null;
      pro_until: string | null;
      trial_ends_at: string | null;
      plan_source: string | null;
      stripe_subscription_id: string | null;
      cancel_at_period_end: boolean | null;
      subscription_status: string | null;
    }>(
      supabase,
      "profiles",
      "id, terms_accepted_at, pro_until, trial_ends_at, plan_source, stripe_subscription_id, cancel_at_period_end, subscription_status",
    ),
  ]);

  const identityCounts = new Map<string, number>();
  for (const o of oracles) {
    identityCounts.set(o.user_id, (identityCounts.get(o.user_id) ?? 0) + 1);
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const termsByUser = new Map(profiles.map((p) => [p.id, p.terms_accepted_at]));

  // Resolve subscription state per user: paid / trial / comped /
  // cancelling / free. Mirrors the aggregate breakdown on /admin.
  const nowMs = Date.now();
  function planLabel(userId: string): {
    label: string;
    tone: "pro" | "trial" | "comped" | "cancel" | "free";
  } {
    const p = profileById.get(userId);
    if (!p) return { label: "Free", tone: "free" };
    const proActive =
      p.pro_until && new Date(p.pro_until).getTime() > nowMs;
    const trialActive =
      p.trial_ends_at && new Date(p.trial_ends_at).getTime() > nowMs;
    if (p.plan_source === "admin_grant" && proActive) {
      return { label: "Comped", tone: "comped" };
    }
    if (p.stripe_subscription_id && proActive) {
      if (p.cancel_at_period_end) {
        return { label: "Cancelling", tone: "cancel" };
      }
      return { label: "Paid Pro", tone: "pro" };
    }
    if (trialActive && !p.stripe_subscription_id) {
      return { label: "Trial", tone: "trial" };
    }
    return { label: "Free", tone: "free" };
  }
  const planToneClass: Record<
    "pro" | "trial" | "comped" | "cancel" | "free",
    string
  > = {
    pro: "text-teal-strong font-semibold",
    trial: "text-warm-100",
    comped: "text-coral-strong font-semibold",
    cancel: "text-warm-300 italic",
    free: "text-warm-400",
  };

  const needle = q.trim().toLowerCase();
  const filtered = users
    .filter((u) => !needle || (u.email ?? "").toLowerCase().includes(needle))
    .filter((u) => !activeFilter || planLabel(u.id).tone === activeFilter)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (needle) params.set("q", q.trim());
    if (activeFilter) params.set("plan", activeFilter);
    if (p > 1) params.set("page", String(p));
    return `/admin/users${params.size ? `?${params}` : ""}`;
  };
  const filterHref = (
    plan: "pro" | "trial" | "comped" | "cancel" | "free" | null,
  ) => {
    const params = new URLSearchParams();
    if (needle) params.set("q", q.trim());
    if (plan) params.set("plan", plan);
    return `/admin/users${params.size ? `?${params}` : ""}`;
  };
  const filterOptions: Array<{
    key: "pro" | "trial" | "comped" | "cancel" | "free" | null;
    label: string;
  }> = [
    { key: null, label: "All" },
    { key: "pro", label: "Paid Pro" },
    { key: "trial", label: "Trial" },
    { key: "comped", label: "Comped" },
    { key: "cancel", label: "Cancelling" },
    { key: "free", label: "Free" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
          Users
        </h1>
        <p className="text-sm text-warm-300">
          {filtered.length.toLocaleString()}
          {needle ? ` matching "${q.trim()}"` : " total"} · newest first
        </p>
      </header>

      <SearchBox />

      {/* Plan-tone filter chips. Server-rendered links so no client
          component overhead; each preserves the current search
          needle. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {filterOptions.map((opt) => {
          const active = activeFilter === opt.key;
          return (
            <Link
              key={opt.key ?? "all"}
              href={filterHref(opt.key)}
              className={
                active
                  ? "rounded-full bg-coral/15 px-3 py-1.5 font-semibold text-coral-strong ring-1 ring-coral/40"
                  : "rounded-full bg-ink-soft px-3 py-1.5 font-medium text-warm-300 ring-1 ring-warm-700 transition-colors hover:text-warm-100 hover:ring-warm-500"
              }
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Link-per-row grid instead of <table> so the whole row is
          clickable without a client component. */}
      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        <div className="grid grid-cols-[1fr_7rem_5rem] items-center gap-3 border-b border-warm-700 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-warm-400 sm:grid-cols-[1fr_7rem_5rem_5.5rem_7rem_6rem]">
          <span>Email</span>
          <span>Signed up</span>
          <span>Terms</span>
          <span className="hidden sm:block">Identities</span>
          <span className="hidden sm:block">Last active</span>
          <span className="hidden sm:block">Plan</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-warm-300">
            {needle
              ? `Nobody here matches "${q.trim()}" — try fewer letters.`
              : "No users yet. They'll appear the moment the first person signs up."}
          </p>
        ) : (
          rows.map((u) => (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className="grid grid-cols-[1fr_7rem_5rem] items-center gap-3 border-b border-warm-700/60 px-4 py-3 text-sm transition-colors last:border-b-0 odd:bg-ink hover:bg-coral/5 sm:grid-cols-[1fr_7rem_5rem_5.5rem_7rem_6rem]"
            >
              <span className="truncate font-medium text-warm-50">
                {u.email ?? "(no email)"}
                {isAdmin(u.email) ? (
                  <span className="text-gradient-cta ml-2 text-xs font-bold">
                    admin
                  </span>
                ) : null}
              </span>
              <span className="text-warm-300">
                {new Date(u.created_at).toLocaleDateString()}
              </span>
              <span
                className={
                  termsByUser.get(u.id)
                    ? "font-medium text-teal-strong"
                    : "text-warm-400"
                }
              >
                {termsByUser.get(u.id) ? "Yes" : "No"}
              </span>
              <span className="hidden text-warm-300 sm:block">
                {identityCounts.get(u.id) ?? 0}
              </span>
              <span className="hidden text-warm-300 sm:block">
                {/* Best-effort: last sign-in from GoTrue. No session
                    tracking exists beyond this. */}
                {u.last_sign_in_at
                  ? new Date(u.last_sign_in_at).toLocaleDateString()
                  : "—"}
              </span>
              {(() => {
                const plan = planLabel(u.id);
                return (
                  <span
                    className={`hidden sm:block ${planToneClass[plan.tone]}`}
                  >
                    {plan.label}
                  </span>
                );
              })()}
            </Link>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link
              href={pageHref(current - 1)}
              className="font-medium text-warm-200 hover:text-warm-50"
            >
              ← Previous
            </Link>
          ) : (
            <span className="text-warm-500">← Previous</span>
          )}
          <span className="text-warm-400">
            Page {current} of {totalPages}
          </span>
          {current < totalPages ? (
            <Link
              href={pageHref(current + 1)}
              className="font-medium text-warm-200 hover:text-warm-50"
            >
              Next →
            </Link>
          ) : (
            <span className="text-warm-500">Next →</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
