import { createAdminClient } from "@/lib/admin/queries";
import { startPromo, stopPromo } from "./actions";

export const dynamic = "force-dynamic";

type Promo = {
  id: string;
  label: string;
  kind: string;
  quota: number;
  claimed: number;
  enabled: boolean;
  starts_at: string;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  companion: "a free identity",
  pro_month: "a free month of Pro",
  message_pack: "+100 messages",
  image_pack: "+12 photo sends",
  inherit_credit: "a free inherit unlock",
};

/**
 * /admin/rewards — the signup-promo switch (Wilson 2026-09-01).
 * Type a number, flip it on, and the next N people who sign up are
 * handed the gift the first time they open the app. It counts down
 * and turns itself off. Built to be reused for whatever campaign
 * comes after this one.
 */
export default async function AdminRewardsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("signup_promos")
    .select("id, label, kind, quota, claimed, enabled, starts_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const promos = (data ?? []) as Promo[];
  const running = promos.find((p) => p.enabled) ?? null;
  const past = promos.filter((p) => !p.enabled);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
          Rewards
        </h1>
        <p className="text-sm text-warm-300">
          Give the next people who sign up something on the house. Turn it
          on, say how many, and it stops itself when they&apos;re gone.
        </p>
      </header>

      {running ? (
        <section className="rounded-2xl bg-ink-soft px-6 py-6 ring-1 ring-teal/40">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-strong" />
            <p className="text-xs font-bold uppercase tracking-wider text-teal-strong">
              Running now
            </p>
          </div>
          <p className="mt-2 text-lg font-semibold text-warm-50">
            {running.label}
          </p>
          <p className="mt-1 text-sm text-warm-300">
            The next people to sign up each get{" "}
            {KIND_LABEL[running.kind] ?? running.kind}.
          </p>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-bold tabular-nums text-warm-50">
                {running.quota - running.claimed}
                <span className="text-base font-medium text-warm-400">
                  {" "}
                  left of {running.quota}
                </span>
              </p>
              <p className="mt-1 text-xs text-warm-400">
                {running.claimed} claimed so far
              </p>
            </div>
            <form action={stopPromo}>
              <input type="hidden" name="id" value={running.id} />
              <button
                type="submit"
                className="rounded-full bg-coral/15 px-5 py-2 text-sm font-semibold text-coral-strong ring-1 ring-coral/30 transition-colors hover:bg-coral/25"
              >
                Turn it off
              </button>
            </form>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink">
            <div
              className="h-full rounded-full bg-teal-strong transition-all"
              style={{
                width: `${Math.min(100, (running.claimed / running.quota) * 100)}%`,
              }}
            />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-ink-soft px-6 py-6 ring-1 ring-warm-700">
          <p className="text-sm font-semibold text-warm-50">
            Nothing running right now
          </p>
          <p className="mt-1 text-sm text-warm-300">
            Only people who sign up <em>after</em> you turn this on will get
            it — nobody already here is affected.
          </p>

          <form action={startPromo} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                  How many people
                </span>
                <input
                  name="quota"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={50}
                  required
                  className="w-32 rounded-xl bg-ink px-4 py-2.5 text-lg font-semibold tabular-nums text-warm-50 ring-1 ring-warm-700 focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                  Each one gets
                </span>
                <select
                  name="kind"
                  defaultValue="companion"
                  className="rounded-xl bg-ink px-4 py-3 text-sm font-medium text-warm-50 ring-1 ring-warm-700 focus:outline-none focus:ring-2 focus:ring-teal"
                >
                  <option value="companion">A free identity</option>
                  <option value="pro_month">A free month of Pro</option>
                  <option value="message_pack">+100 messages</option>
                  <option value="image_pack">+12 photo sends</option>
                  <option value="inherit_credit">A free inherit unlock</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                Name it (just for you)
              </span>
              <input
                name="label"
                type="text"
                placeholder="Twitter launch push"
                className="rounded-xl bg-ink px-4 py-2.5 text-sm text-warm-50 ring-1 ring-warm-700 placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-teal"
              />
            </label>
            <button
              type="submit"
              className="bg-gradient-cta h-12 rounded-full text-base font-bold text-white transition-all hover:-translate-y-px active:opacity-90"
            >
              Turn it on
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
          What a person sees
        </h2>
        <div className="rounded-2xl bg-ink-soft px-6 py-5 text-sm leading-relaxed text-warm-300 ring-1 ring-warm-700">
          The first time they open the app they get the 🎁 moment naming the
          gift. Pressing Okay claims it. For a free identity, the same screen
          then shows their share link with the instructions — bring five
          people who sign up and start talking, and they earn another one
          free — plus a link to the plans if they&apos;d rather not wait. The
          gifted identity talks inside the normal 20-message allowance and is
          theirs to keep; it never counts against the identities a paid plan
          includes.
        </div>
      </section>

      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
            Past campaigns
          </h2>
          <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
            {past.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 border-b border-warm-700/60 px-5 py-3.5 text-sm last:border-b-0 odd:bg-ink"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-warm-100">{p.label}</p>
                  <p className="text-xs text-warm-400">
                    {new Date(p.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums text-warm-300">
                  {p.claimed} of {p.quota} claimed
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
