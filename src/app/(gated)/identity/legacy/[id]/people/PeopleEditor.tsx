"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * "Who are you giving this code to?" — the recorder's private list.
 * Name + who they are to you (your words) + optional email + optional
 * birthday. Email or name+birthday lets the archive know it's them the
 * moment they redeem; otherwise it asks. Nobody on the list ever sees
 * the list. Mirrors mobile app/identity/legacy/people.tsx.
 */
type Person = { name: string; relation: string; email: string; birthday: string };
type Redeemed = { status: "confirmed" | "ask" | "unlisted"; name: string | null; relation: string | null };

const EMPTY: Person = { name: "", relation: "", email: "", birthday: "" };

export default function PeopleEditor({ oracleId, name, isSelf }: { oracleId: string; name: string; isSelf: boolean }) {
  const [people, setPeople] = useState<Person[]>([{ ...EMPTY }]);
  const [redeemed, setRedeemed] = useState<Redeemed[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/legacy/people?oracle_id=${encodeURIComponent(oracleId)}`);
        const body = (await res.json().catch(() => ({}))) as { people?: Person[]; redeemed?: Redeemed[]; error?: string };
        if (!alive) return;
        if (!res.ok) {
          setError(body.error ?? "Couldn't load the list.");
        } else {
          const rows = (body.people ?? []).map((p) => ({ name: p.name ?? "", relation: p.relation ?? "", email: p.email ?? "", birthday: p.birthday ?? "" }));
          setPeople(rows.length ? rows : [{ ...EMPTY }]);
          setRedeemed(body.redeemed ?? []);
        }
      } catch {
        if (alive) setError("Couldn't load the list.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [oracleId]);

  function update(i: number, patch: Partial<Person>) {
    setSaved(null);
    setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/legacy/people", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracle_id: oracleId, people: people.filter((p) => p.name.trim() && p.relation.trim()) }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; count?: number; rematched?: number; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save. Try again.");
        return;
      }
      setSaved(
        body.rematched
          ? `Saved. ${body.rematched === 1 ? "One person who already has your code" : `${body.rematched} people who already have your code`} now know${body.rematched === 1 ? "s" : ""} who they are to you.`
          : "Saved.",
      );
      const again = await fetch(`/api/legacy/people?oracle_id=${encodeURIComponent(oracleId)}`);
      const b2 = (await again.json().catch(() => ({}))) as { redeemed?: Redeemed[] };
      setRedeemed(b2.redeemed ?? []);
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const you = isSelf ? "you" : name;

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="rounded-2xl border-[1.5px] border-coral bg-ink-soft p-4">
        <p className="text-gradient-cta text-[13px] font-extrabold uppercase tracking-wider">The more you tell us, the more it knows who&rsquo;s who</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-relaxed text-warm-100">
          Add their name and birthday, or their email, and the code will know it&rsquo;s them the moment they open it: {isSelf ? "your husband gets your wife, your son gets his mother" : `their husband gets ${name} as a wife, their son gets ${name} as a mother`}. Leave someone off and they still get {you} in full, just as a friend. Nobody on this list ever sees it.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-warm-400">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {people.map((p, i) => (
            <div key={i} className="rounded-[18px] bg-ink-soft p-4 ring-1 ring-warm-700">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Their name"
                  maxLength={80}
                  className="h-11 rounded-xl bg-ink px-3 text-[15px] text-warm-50 ring-1 ring-warm-700 placeholder:text-warm-500 focus:outline-none focus:ring-teal"
                />
                <input
                  value={p.relation}
                  onChange={(e) => update(i, { relation: e.target.value })}
                  placeholder={isSelf ? "Who they are to you — my husband, my baby" : `Who they are to ${name} — her son, his best friend`}
                  maxLength={60}
                  className="h-11 rounded-xl bg-ink px-3 text-[15px] text-warm-50 ring-1 ring-warm-700 placeholder:text-warm-500 focus:outline-none focus:ring-teal"
                />
                <input
                  value={p.email}
                  onChange={(e) => update(i, { email: e.target.value })}
                  placeholder="Their email (optional)"
                  type="email"
                  className="h-11 rounded-xl bg-ink px-3 text-[15px] text-warm-50 ring-1 ring-warm-700 placeholder:text-warm-500 focus:outline-none focus:ring-teal"
                />
                <input
                  value={p.birthday}
                  onChange={(e) => update(i, { birthday: e.target.value })}
                  type="date"
                  aria-label="Their birthday (optional)"
                  className="h-11 rounded-xl bg-ink px-3 text-[15px] text-warm-50 ring-1 ring-warm-700 focus:outline-none focus:ring-teal"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-warm-400">Email or name + birthday lets the code recognize them. Birthday is the one they signed up with.</p>
                <button type="button" onClick={() => { setSaved(null); setPeople((prev) => prev.filter((_, idx) => idx !== i)); }} className="text-xs font-semibold text-warm-400 underline underline-offset-2 hover:text-coral">
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPeople((prev) => [...prev, { ...EMPTY }])}
            className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-coral px-5 text-sm font-bold text-coral hover:opacity-80"
          >
            Add another person
          </button>
        </div>
      )}

      {error ? <p className="text-sm font-medium text-coral-strong">{error}</p> : null}
      {saved ? <p className="text-sm font-medium text-teal-strong">{saved}</p> : null}

      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="bg-gradient-cta flex h-13 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      {redeemed.length > 0 ? (
        <div className="rounded-[18px] bg-ink-soft p-4 ring-1 ring-warm-700">
          <p className="text-[11px] font-bold uppercase tracking-wide text-warm-400">Who has {isSelf ? "your" : "their"} code</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {redeemed.map((r, i) => (
              <li key={i} className="text-sm text-warm-100">
                {r.status === "confirmed"
                  ? `${r.name} — ${r.relation}`
                  : r.status === "ask"
                    ? `Someone who hasn't said who they are yet${r.name ? ` (they wrote "${r.name}")` : ""}`
                    : `Someone not on the list${r.name ? ` (they wrote "${r.name}")` : ""} — they get ${you} as a friend`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-warm-400">
        <Link href="/settings" className="underline underline-offset-2 hover:text-warm-200">Back to Settings</Link>
      </p>
    </div>
  );
}
