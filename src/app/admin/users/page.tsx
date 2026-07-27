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
type PlanTone = "pro" | "trial" | "comped" | "cancel" | "lapsed" | "free";
type SinceKey = "today" | "week" | "month";
type SortKey = "recent" | "spend" | "activity";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    plan?: string;
    since?: string;
    sort?: string;
  }>;
}) {
  const {
    q = "",
    page: pageParam,
    plan: planFilter,
    since: sinceRaw,
    sort: sortRaw,
  } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const activeFilter = ["pro", "trial", "comped", "cancel", "lapsed", "free"].includes(
    planFilter ?? "",
  )
    ? (planFilter as PlanTone)
    : null;
  const sinceFilter = ["today", "week", "month"].includes(sinceRaw ?? "")
    ? (sinceRaw as SinceKey)
    : null;
  const sortKey: SortKey = ["recent", "spend", "activity"].includes(
    sortRaw ?? "",
  )
    ? (sortRaw as SortKey)
    : "recent";

  const supabase = createAdminClient();

  // 30-day COGS lookback for the per-user spend column. Reads once
  // and buckets by user_id — cheaper than N per-user queries.
  const monthAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [users, oracles, profiles, spend, activity] = await Promise.all([
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
    safeSelect<{ user_id: string; cents: number | null }>(
      supabase,
      "chat_spend_events",
      "user_id, cents",
      (q) => q.gte("created_at", monthAgoIso),
    ),
    safeSelect<{ user_id: string; created_at: string }>(
      supabase,
      "messages",
      "user_id, created_at",
      (q) => q.eq("role", "user").gte("created_at", monthAgoIso),
    ),
  ]);

  // Per-user spend (last 30 days) — the "who's costing what" answer
  // Wilson's "one stop shop" needs.
  const spendByUser = new Map<string, number>();
  for (const row of spend) {
    if (!row.user_id) continue;
    const c = typeof row.cents === "number" ? row.cents : 0;
    spendByUser.set(row.user_id, (spendByUser.get(row.user_id) ?? 0) + c);
  }
  // Per-user last-message timestamp (for "last active" column that
  // reflects app usage, not just sign-in cookie refresh).
  const lastMessageByUser = new Map<string, string>();
  for (const row of activity) {
    if (!row.user_id || !row.created_at) continue;
    const existing = lastMessageByUser.get(row.user_id);
    if (!existing || row.created_at > existing) {
      lastMessageByUser.set(row.user_id, row.created_at);
    }
  }

  const identityCounts = new Map<string, number>();
  for (const o of oracles) {
    identityCounts.set(o.user_id, (identityCounts.get(o.user_id) ?? 0) + 1);
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const termsByUser = new Map(profiles.map((p) => [p.id, p.terms_accepted_at]));

  // Resolve subscription state per user: admin / paid / trial /
  // comped / cancelling / free. Mirrors the aggregate breakdown on
  // /admin. Allowlisted admins resolve FIRST (same ordering rule as
  // the settings plan label) — they're Pro-forever via isAdmin, and a
  // stale trial_ends_at from before allowlisting must not read as
  // "Trial" (or "Free" once it lapses). Tone "comped" keeps them in
  // the same cohort the /admin "Comped (admin)" card counts.
  const nowMs = Date.now();
  function planLabel(
    userId: string,
    email: string | null | undefined,
  ): {
    label: string;
    tone: PlanTone;
  } {
    if (isAdmin(email)) return { label: "Admin", tone: "comped" };
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
    // "Cancelled (lapsed)" — subscription_status='canceled' and no
    // active Pro window. Distinct from "Free" so churn is visible.
    if (
      p.subscription_status === "canceled" &&
      !proActive
    ) {
      return { label: "Cancelled", tone: "lapsed" };
    }
    return { label: "Free", tone: "free" };
  }
  const planToneClass: Record<PlanTone, string> = {
    pro: "text-teal-strong font-semibold",
    trial: "text-warm-100",
    comped: "text-coral-strong font-semibold",
    cancel: "text-warm-300 italic",
    lapsed: "text-warm-400 italic",
    free: "text-warm-400",
  };

  // Since filter — signed-up cohort by window.
  const sinceMs =
    sinceFilter === "today"
      ? Date.now() - 24 * 60 * 60 * 1000
      : sinceFilter === "week"
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : sinceFilter === "month"
          ? Date.now() - 30 * 24 * 60 * 60 * 1000
          : null;

  const needle = q.trim().toLowerCase();
  const filtered = users
    .filter((u) => !needle || (u.email ?? "").toLowerCase().includes(needle))
    .filter(
      (u) => !activeFilter || planLabel(u.id, u.email).tone === activeFilter,
    )
    .filter(
      (u) => sinceMs === null || new Date(u.created_at).getTime() >= sinceMs,
    )
    .sort((a, b) => {
      if (sortKey === "spend") {
        return (
          (spendByUser.get(b.id) ?? 0) - (spendByUser.get(a.id) ?? 0)
        );
      }
      if (sortKey === "activity") {
        const av = lastMessageByUser.get(a.id) ?? "";
        const bv = lastMessageByUser.get(b.id) ?? "";
        return bv.localeCompare(av);
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function buildHref(
    overrides: Partial<{
      plan: PlanTone | null;
      since: SinceKey | null;
      sort: SortKey;
      page: number;
    }>,
  ): string {
    const params = new URLSearchParams();
    if (needle) params.set("q", q.trim());
    const nextPlan = overrides.plan !== undefined ? overrides.plan : activeFilter;
    const nextSince = overrides.since !== undefined ? overrides.since : sinceFilter;
    const nextSort = overrides.sort ?? sortKey;
    const nextPage = overrides.page ?? 1;
    if (nextPlan) params.set("plan", nextPlan);
    if (nextSince) params.set("since", nextSince);
    if (nextSort !== "recent") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/users${params.size ? `?${params}` : ""}`;
  }
  const pageHref = (p: number) => buildHref({ page: p });
  const planOptions: Array<{ key: PlanTone | null; label: string }> = [
    { key: null, label: "All" },
    { key: "pro", label: "Paid Pro" },
    { key: "trial", label: "Trial" },
    { key: "comped", label: "Comped" },
    { key: "cancel", label: "Cancelling" },
    { key: "lapsed", label: "Cancelled" },
    { key: "free", label: "Free" },
  ];
  const sinceOptions: Array<{ key: SinceKey | null; label: string }> = [
    { key: null, label: "Any time" },
    { key: "today", label: "Today" },
    { key: "week", label: "Last 7d" },
    { key: "month", label: "Last 30d" },
  ];
  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "recent", label: "Newest" },
    { key: "activity", label: "Last active" },
    { key: "spend", label: "Spend (30d)" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
          Users
        </h1>
        <p className="text-sm text-warm-300">
          {filtered.length.toLocaleString()}
          {needle ? ` matching "${q.trim()}"` : " total"}
          {activeFilter ? ` · ${activeFilter}` : ""}
          {sinceFilter ? ` · ${sinceFilter}` : ""}
          {sortKey !== "recent" ? ` · sorted by ${sortKey}` : ""}
        </p>
      </header>

      <SearchBox />

      {/* Filter chips — plan, sign-up window, sort. Server-rendered
          links; each preserves the other axes. Wilson's "one stop
          shop" ask: any cohort is one tap. */}
      <div className="flex flex-col gap-3">
        <ChipRow
          label="Plan"
          options={planOptions.map((o) => ({
            ...o,
            active: activeFilter === o.key,
            href: buildHref({ plan: o.key }),
          }))}
        />
        <ChipRow
          label="Signed up"
          options={sinceOptions.map((o) => ({
            ...o,
            active: sinceFilter === o.key,
            href: buildHref({ since: o.key }),
          }))}
        />
        <ChipRow
          label="Sort"
          options={sortOptions.map((o) => ({
            ...o,
            active: sortKey === o.key,
            href: buildHref({ sort: o.key }),
          }))}
        />
      </div>

      {/* Link-per-row grid instead of <table> so the whole row is
          clickable without a client component. */}
      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        <div className="grid grid-cols-[1fr_7rem_4rem] items-center gap-3 border-b border-warm-700 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-warm-400 sm:grid-cols-[1fr_7rem_4rem_4.5rem_7rem_5rem_6rem]">
          <span>Email</span>
          <span>Signed up</span>
          <span>Terms</span>
          <span className="hidden sm:block">Identities</span>
          <span className="hidden sm:block">Last active</span>
          <span className="hidden sm:block">Spend 30d</span>
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
              className="grid grid-cols-[1fr_7rem_4rem] items-center gap-3 border-b border-warm-700/60 px-4 py-3 text-sm transition-colors last:border-b-0 odd:bg-ink hover:bg-coral/5 sm:grid-cols-[1fr_7rem_4rem_4.5rem_7rem_5rem_6rem]"
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
                {(() => {
                  // Prefer real last-message-sent (from messages table)
                  // over GoTrue's last_sign_in_at. Session refresh
                  // doesn't count as active use.
                  const lastMsg = lastMessageByUser.get(u.id);
                  if (lastMsg) return new Date(lastMsg).toLocaleDateString();
                  return u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleDateString()
                    : "—";
                })()}
              </span>
              <span className="hidden text-warm-300 sm:block">
                {(() => {
                  const cents = spendByUser.get(u.id) ?? 0;
                  if (cents === 0) return "—";
                  return `$${(cents / 100).toFixed(2)}`;
                })()}
              </span>
              {(() => {
                const plan = planLabel(u.id, u.email);
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

/**
 * Titled row of pill-shaped filter links. Server component.
 * Highlights the active option; every other option is a subtle
 * link. Wilson's filter chips pattern from the plan row extended
 * across plan/since/sort axes.
 */
function ChipRow({
  label,
  options,
}: {
  label: string;
  options: Array<{ label: string; href: string; active: boolean }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="mr-1 font-semibold uppercase tracking-wider text-warm-500">
        {label}
      </span>
      {options.map((opt) => (
        <Link
          key={opt.label}
          href={opt.href}
          className={
            opt.active
              ? "rounded-full bg-coral/15 px-3 py-1.5 font-semibold text-coral-strong ring-1 ring-coral/40"
              : "rounded-full bg-ink-soft px-3 py-1.5 font-medium text-warm-300 ring-1 ring-warm-700 transition-colors hover:text-warm-100 hover:ring-warm-500"
          }
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
