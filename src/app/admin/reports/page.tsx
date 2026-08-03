import { createAdminClient } from "@/lib/admin/queries";
import { resolveOracleReport, resolveReport } from "./actions";

export const metadata = {
  title: "Reports · admin",
};

// Always show the freshest queue — admin overview never wants stale
// data. The admin layout already gates access to allowlisted emails.
export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  message_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reporter_user_id: string;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  user_id: string;
  oracle_id: string;
};

type OracleRow = {
  id: string;
  name: string;
  one_line_hook?: string | null;
  is_legacy?: boolean | null;
  is_concierge?: boolean | null;
};

type OracleReportRow = {
  id: string;
  oracle_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reporter_user_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

const REASON_LABEL: Record<string, string> = {
  inappropriate: "Inappropriate content",
  harmful: "Harmful or dangerous",
  off_character: "Out of character",
  spam: "Spam",
  other: "Other",
};

/**
 * /admin/reports — moderation queue for user-submitted message reports.
 *
 * Reports land here from the tapback popover ("Report" button) on any
 * chat bubble. Row shows the report reason + user notes + the full
 * message text + persona + reporter, with resolve / dismiss actions.
 * App Store 1.2 (UGC moderation) requires this workflow.
 */
export default async function ReportsPage() {
  const supabase = createAdminClient();

  const { data: reports } = await supabase
    .from("message_reports")
    .select(
      "id, message_id, reason, notes, status, created_at, reviewed_at, reporter_user_id",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<ReportRow[]>();

  const messageIds = (reports ?? []).map((r) => r.message_id);
  const oracleIds = new Set<string>();
  const reporterIds = new Set<string>();
  reports?.forEach((r) => reporterIds.add(r.reporter_user_id));

  const messagesById = new Map<string, MessageRow>();
  if (messageIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, role, content, created_at, user_id, oracle_id")
      .in("id", messageIds)
      .returns<MessageRow[]>();
    for (const m of msgs ?? []) {
      messagesById.set(m.id, m);
      oracleIds.add(m.oracle_id);
    }
  }

  // Identity-level pending reports (public.oracle_reports, 0123).
  // Sibling to the per-message queue above. Both surfaces here so an
  // admin has one place to work — Apple 1.2 / Play UGC don't care
  // whether the report was per-message or per-identity, only that
  // it's actioned.
  const { data: oracleReports } = await supabase
    .from("oracle_reports")
    .select(
      "id, oracle_id, reason, notes, status, created_at, reviewed_at, reporter_user_id",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<OracleReportRow[]>();

  const oracleReportOracleIds = new Set<string>();
  oracleReports?.forEach((r) => {
    oracleIds.add(r.oracle_id);
    oracleReportOracleIds.add(r.oracle_id);
    reporterIds.add(r.reporter_user_id);
  });

  const oraclesById = new Map<string, OracleRow>();
  if (oracleIds.size > 0) {
    const { data: oracles } = await supabase
      .from("oracles")
      .select("id, name, one_line_hook, is_legacy, is_concierge")
      .in("id", Array.from(oracleIds))
      .returns<OracleRow[]>();
    for (const o of oracles ?? []) oraclesById.set(o.id, o);
  }

  const profilesById = new Map<string, ProfileRow>();
  if (reporterIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(reporterIds))
      .returns<ProfileRow[]>();
    for (const p of profiles ?? []) profilesById.set(p.id, p);
  }

  const pending = reports ?? [];
  const pendingOracles = oracleReports ?? [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
          Reports
        </h1>
        <p className="text-sm text-warm-300">
          User-submitted moderation flags. Resolve or dismiss to close. We
          aim to review reports within 24 hours.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-warm-100">
          Message reports{" "}
          <span className="text-xs font-normal text-warm-400">
            ({pending.length} pending)
          </span>
        </h2>
      {pending.length === 0 ? (
        <div className="rounded-2xl bg-ink-soft p-6 text-sm text-warm-300 ring-1 ring-warm-700/60">
          No pending reports. The queue is empty.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((r) => {
            const msg = messagesById.get(r.message_id) ?? null;
            const oracle = msg ? oraclesById.get(msg.oracle_id) ?? null : null;
            const reporter = profilesById.get(r.reporter_user_id) ?? null;
            return (
              <li
                key={r.id}
                className="rounded-2xl bg-ink-soft p-5 ring-1 ring-warm-700/60"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                  <span className="rounded-full bg-coral/10 px-2.5 py-1 text-coral-strong">
                    {REASON_LABEL[r.reason] ?? r.reason}
                  </span>
                  <span className="text-warm-400">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  {msg ? (
                    <span className="rounded-full bg-warm-700/50 px-2.5 py-1 text-warm-200">
                      {msg.role === "assistant"
                        ? `Persona: ${oracle?.name ?? "unknown"}`
                        : "User's own message"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-warm-700/50 px-2.5 py-1 text-warm-400">
                      Message deleted
                    </span>
                  )}
                </div>

                {msg ? (
                  <blockquote className="mt-4 rounded-xl bg-warm-700/25 px-4 py-3 text-sm leading-relaxed text-warm-100 whitespace-pre-wrap">
                    {msg.content || <em className="text-warm-400">(image-only)</em>}
                  </blockquote>
                ) : null}

                {r.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-warm-300">
                    <span className="font-semibold text-warm-200">
                      Reporter notes:
                    </span>{" "}
                    {r.notes}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-warm-400">
                  Reporter:{" "}
                  {reporter?.full_name || (
                    <code className="text-warm-500">{r.reporter_user_id}</code>
                  )}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await resolveReport(r.id, "reviewed");
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-full bg-coral/10 px-4 py-2 text-sm font-semibold text-coral-strong transition-colors hover:bg-coral/20"
                    >
                      Mark reviewed
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await resolveReport(r.id, "dismissed");
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-full bg-warm-700/40 px-4 py-2 text-sm font-medium text-warm-200 transition-colors hover:bg-warm-700/60"
                    >
                      Dismiss
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-warm-100">
          Identity reports{" "}
          <span className="text-xs font-normal text-warm-400">
            ({pendingOracles.length} pending)
          </span>
        </h2>
        {pendingOracles.length === 0 ? (
          <div className="rounded-2xl bg-ink-soft p-6 text-sm text-warm-300 ring-1 ring-warm-700/60">
            No pending identity reports.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {pendingOracles.map((r) => {
              const oracle = oraclesById.get(r.oracle_id) ?? null;
              const reporter = profilesById.get(r.reporter_user_id) ?? null;
              const kind = oracle?.is_concierge
                ? "concierge"
                : oracle?.is_legacy
                  ? "legacy/inherited"
                  : "randomized";
              return (
                <li
                  key={r.id}
                  className="rounded-2xl bg-ink-soft p-5 ring-1 ring-warm-700/60"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                    <span className="rounded-full bg-coral/10 px-2.5 py-1 text-coral-strong">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                    <span className="text-warm-400">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <span className="rounded-full bg-warm-700/50 px-2.5 py-1 text-warm-200">
                      Identity: {oracle?.name ?? "unknown"} ({kind})
                    </span>
                  </div>

                  {oracle?.one_line_hook ? (
                    <p className="mt-3 text-sm text-warm-300">
                      {oracle.one_line_hook}
                    </p>
                  ) : null}

                  {r.notes ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-warm-300">
                      <span className="font-semibold text-warm-200">
                        Reporter notes:
                      </span>{" "}
                      {r.notes}
                    </p>
                  ) : null}

                  <p className="mt-3 text-xs text-warm-400">
                    Reporter:{" "}
                    {reporter?.full_name || (
                      <code className="text-warm-500">
                        {r.reporter_user_id}
                      </code>
                    )}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await resolveOracleReport(r.id, "reviewed");
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-coral/10 px-4 py-2 text-sm font-semibold text-coral-strong transition-colors hover:bg-coral/20"
                      >
                        Mark reviewed
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await resolveOracleReport(r.id, "dismissed");
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-warm-700/40 px-4 py-2 text-sm font-medium text-warm-200 transition-colors hover:bg-warm-700/60"
                      >
                        Dismiss
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
