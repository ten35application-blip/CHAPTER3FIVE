"use client";

import { useState, useTransition } from "react";
import { deleteAllIdentities, seedAdminIdentities } from "./actions";

type DeleteResult =
  | { kind: "success"; deleted: number }
  | { kind: "error"; error: string };

type SeedResult = {
  kind: "success" | "error";
  created: { email: string; count: number; names: string[] }[];
  skipped: { email: string; reason: string }[];
  errors: { email: string; error: string }[];
};

/**
 * Client wrapper for the two destructive/expensive tool actions. Each
 * tool has: a guarded confirm, a spinner while the action runs, and a
 * result panel that renders whatever the server returned.
 */
export function ToolsPanel() {
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<null | "delete" | "seed">(null);

  function runDelete() {
    if (
      !window.confirm(
        "Delete EVERY identity on the platform (across all users)?\n\n" +
          "This cascades to messages, inherit codes, and shared oracles.\n" +
          "There is no undo.",
      )
    )
      return;

    setRunning("delete");
    setDeleteResult(null);
    startTransition(async () => {
      const res = await deleteAllIdentities();
      setDeleteResult(
        res.ok
          ? { kind: "success", deleted: res.deleted ?? 0 }
          : { kind: "error", error: res.error ?? "unknown error" },
      );
      setRunning(null);
    });
  }

  function runSeed() {
    if (
      !window.confirm(
        "Seed 3 formula-generated identities for each admin account?\n\n" +
          "Uses Claude to synthesize personas. May take ~30 seconds.",
      )
    )
      return;

    setRunning("seed");
    setSeedResult(null);
    startTransition(async () => {
      const res = await seedAdminIdentities();
      setSeedResult({
        kind: res.ok ? "success" : "error",
        created: res.created,
        skipped: res.skipped,
        errors: res.errors,
      });
      setRunning(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* -- DELETE ALL -- */}
      <section className="rounded-2xl bg-ink-soft p-6 ring-1 ring-warm-700/60">
        <h2 className="text-lg font-bold text-warm-50">
          Delete all identities
        </h2>
        <p className="mt-2 text-sm text-warm-300">
          Wipes <span className="font-semibold text-warm-100">every</span> row
          in <code className="text-warm-200">oracles</code>, across all users.
          Cascades to messages, inherit codes, and shares. Not reversible.
          Intended for the pre-seed reset only.
        </p>

        <button
          type="button"
          onClick={runDelete}
          disabled={pending}
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-coral-strong px-6 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(232,138,118,0.55)] transition-all hover:-translate-y-px hover:bg-coral disabled:opacity-50"
        >
          {running === "delete" ? "Deleting…" : "Delete all identities"}
        </button>

        {deleteResult ? (
          deleteResult.kind === "success" ? (
            <p className="mt-4 rounded-lg bg-teal/10 px-4 py-3 text-sm text-teal-strong">
              Deleted{" "}
              <span className="font-bold">{deleteResult.deleted}</span>{" "}
              identit{deleteResult.deleted === 1 ? "y" : "ies"}.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral-strong">
              {deleteResult.error}
            </p>
          )
        ) : null}
      </section>

      {/* -- SEED ADMIN IDENTITIES -- */}
      <section className="rounded-2xl bg-ink-soft p-6 ring-1 ring-warm-700/60">
        <h2 className="text-lg font-bold text-warm-50">
          Seed 3 identities per admin
        </h2>
        <p className="mt-2 text-sm text-warm-300">
          Runs the identity formula (roll → fingerprint → Claude synthesis) 3
          times for each allowlisted admin email that has signed up. Skips
          admins without an account. Uses the same pipeline as{" "}
          <code className="text-warm-200">/identity/new</code>, so every seed
          is a real formula-generated person.
        </p>

        <button
          type="button"
          onClick={runSeed}
          disabled={pending}
          className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(232,138,118,0.5),_0_4px_12px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px disabled:opacity-50"
        >
          {running === "seed" ? "Seeding…" : "Seed admin identities"}
        </button>

        {seedResult ? (
          <div className="mt-4 space-y-3 text-sm">
            {seedResult.created.map((c) => (
              <div
                key={c.email}
                className="rounded-lg bg-teal/10 px-4 py-3 text-teal-strong"
              >
                <p className="font-semibold">
                  {c.email} — created {c.count}
                </p>
                <p className="mt-1 text-warm-200">{c.names.join(", ")}</p>
              </div>
            ))}
            {seedResult.skipped.map((s) => (
              <div
                key={s.email}
                className="rounded-lg bg-warm-700/40 px-4 py-3 text-warm-200"
              >
                <p className="font-semibold text-warm-100">{s.email}</p>
                <p className="mt-1">{s.reason}</p>
              </div>
            ))}
            {seedResult.errors.map((e, i) => (
              <div
                key={`${e.email}-${i}`}
                className="rounded-lg bg-coral/10 px-4 py-3 text-coral-strong"
              >
                <p className="font-semibold">{e.email}</p>
                <p className="mt-1">{e.error}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
