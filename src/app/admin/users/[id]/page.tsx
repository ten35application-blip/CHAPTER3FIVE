import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin/allowlist";
import {
  createAdminClient,
  formatUsd,
  safeCount,
  safeSelect,
  type PaymentRow,
} from "@/lib/admin/queries";
import { ActionButton } from "../../_components/ActionButton";
import {
  deleteIdentityAction,
  deleteUserAction,
  refundPaymentAction,
  revokeInheritCodeAction,
} from "./actions";

type ProfileRow = {
  full_name: string | null;
  terms_accepted_at: string | null;
  terms_version_accepted: string | null;
  deleted_at: string | null;
};

type OracleRow = {
  id: string;
  name: string;
  is_legacy: boolean | null;
  created_at: string;
};

type CodeRow = {
  id: string;
  code: string;
  revoked_at: string | null;
  created_at: string;
};

type ShareRow = {
  id: string;
  oracle_id: string;
  created_at: string;
};

/** /admin/users/[id] — everything about one account in one place. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(id);
  const user = userData?.user;
  if (userError || !user) {
    notFound();
  }

  const [profiles, oracles, chatCount, payments, codes, shares] =
    await Promise.all([
      safeSelect<ProfileRow>(
        supabase,
        "profiles",
        "full_name, terms_accepted_at, terms_version_accepted, deleted_at",
        (q) => q.eq("id", id),
      ),
      safeSelect<OracleRow>(
        supabase,
        "oracles",
        "id, name, is_legacy, created_at",
        (q) => q.eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      ),
      safeCount(supabase, "messages", (q) => q.eq("user_id", id)),
      safeSelect<PaymentRow>(
        supabase,
        "payments",
        "id, user_id, amount_cents, currency, purpose, status, created_at, paid_at",
        (q) => q.eq("user_id", id).order("created_at", { ascending: false }).limit(10),
      ),
      safeSelect<CodeRow>(
        supabase,
        "inherit_codes",
        "id, code, revoked_at, created_at",
        (q) => q.eq("created_by", id).order("created_at", { ascending: false }),
      ),
      safeSelect<ShareRow>(
        supabase,
        "oracle_shares",
        "id, oracle_id, created_at",
        (q) => q.eq("user_id", id).order("created_at", { ascending: false }),
      ),
    ]);

  const profile = profiles[0];
  const email = user.email ?? "(no email)";

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Link
        href="/admin/users"
        className="text-sm font-medium text-warm-300 hover:text-warm-100"
      >
        ← All users
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="break-all text-2xl font-semibold tracking-tight text-warm-50">
            {email}
          </h1>
          {isAdmin(user.email) ? (
            <span className="bg-gradient-cta rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Admin
            </span>
          ) : null}
          {profile?.deleted_at ? (
            <span className="rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral-strong ring-1 ring-coral/25">
              Soft-deleted
            </span>
          ) : null}
        </div>
        <p className="text-sm text-warm-300">
          Signed up {new Date(user.created_at).toLocaleString()}
          {user.last_sign_in_at
            ? ` · last sign-in ${new Date(user.last_sign_in_at).toLocaleString()}`
            : ""}
        </p>
        <div className="mt-2">
          <ActionButton
            label="Delete user"
            danger
            confirm={`This permanently deletes ${email} and everything they created — identities, chats, codes. (Stubbed for now; nothing is actually deleted.)`}
            action={deleteUserAction.bind(null, user.id)}
          />
        </div>
      </header>

      <Section title="Profile">
        <Row label="Name" value={profile?.full_name ?? "—"} />
        <Row
          label="Terms accepted"
          value={
            profile?.terms_accepted_at
              ? `${new Date(profile.terms_accepted_at).toLocaleString()} (v${profile.terms_version_accepted ?? "?"})`
              : "Not yet"
          }
        />
        {/* TODO: real plan once Stripe billing lands — $5/mo Pro plan,
            4 formula + 1 photo identity (see src/lib/pricing.ts). */}
        <Row label="Plan" value="Free" />
      </Section>

      <Section title={`Identities (${oracles.length})`}>
        {oracles.length === 0 ? (
          <p className="px-4 py-4 text-sm text-warm-300">
            No identities yet.
          </p>
        ) : (
          oracles.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center gap-3 border-b border-warm-700/60 px-4 py-3 last:border-b-0 odd:bg-ink"
            >
              <Link
                href={`/admin/identities/${o.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-warm-50 hover:text-coral-strong"
              >
                {o.name}
              </Link>
              <span className="text-xs text-warm-400">
                {o.is_legacy ? "Legacy" : "Randomized"} ·{" "}
                {new Date(o.created_at).toLocaleDateString()}
              </span>
              <ActionButton
                label="Delete"
                danger
                confirm={`Delete the identity "${o.name}"? (Stubbed — nothing is actually deleted.)`}
                action={deleteIdentityAction.bind(null, o.id)}
              />
            </div>
          ))
        )}
      </Section>

      <Section title="Chats">
        {/* Count only, deliberately — reading someone's messages is a
            bigger step than the dashboard should invite. */}
        <Row label="Messages" value={chatCount.toLocaleString()} />
      </Section>

      <Section title="Payments">
        {payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-warm-300">
            No payments recorded.
          </p>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 border-b border-warm-700/60 px-4 py-3 last:border-b-0 odd:bg-ink"
            >
              <span className="flex-1 text-sm font-medium text-warm-50">
                {formatUsd(p.amount_cents)}{" "}
                <span className="font-normal text-warm-400">
                  · {p.purpose} · {p.status}
                </span>
              </span>
              <span className="text-xs text-warm-400">
                {new Date(p.paid_at ?? p.created_at).toLocaleDateString()}
              </span>
              {p.status === "paid" ? (
                <ActionButton
                  label="Refund"
                  action={refundPaymentAction.bind(null, p.id)}
                />
              ) : null}
            </div>
          ))
        )}
      </Section>

      <Section title="Inherit codes">
        {codes.length === 0 && shares.length === 0 ? (
          <p className="px-4 py-4 text-sm text-warm-300">
            None created, none redeemed.
          </p>
        ) : (
          <>
            {codes.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 border-b border-warm-700/60 px-4 py-3 last:border-b-0 odd:bg-ink"
              >
                <span className="flex-1 break-all text-sm font-medium text-warm-50">
                  {c.code}
                  {c.revoked_at ? (
                    <span className="ml-2 text-xs text-warm-400">revoked</span>
                  ) : null}
                </span>
                <span className="text-xs text-warm-400">
                  created {new Date(c.created_at).toLocaleDateString()}
                </span>
                {!c.revoked_at ? (
                  <ActionButton
                    label="Revoke"
                    action={revokeInheritCodeAction.bind(null, c.id)}
                  />
                ) : null}
              </div>
            ))}
            {shares.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 border-b border-warm-700/60 px-4 py-3 last:border-b-0 odd:bg-ink"
              >
                <span className="flex-1 text-sm text-warm-200">
                  Redeemed access to{" "}
                  <Link
                    href={`/admin/identities/${s.oracle_id}`}
                    className="font-medium text-warm-50 hover:text-coral-strong"
                  >
                    an identity
                  </Link>
                </span>
                <span className="text-xs text-warm-400">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-warm-700/60 px-4 py-3 text-sm last:border-b-0">
      <span className="text-warm-300">{label}</span>
      <span className="text-right font-medium text-warm-50">{value}</span>
    </div>
  );
}
