import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, safeSelect } from "@/lib/admin/queries";

type OracleDetail = {
  id: string;
  name: string;
  user_id: string;
  is_legacy: boolean | null;
  one_line_hook: string | null;
  fingerprint: string | null;
  traits: Record<string, unknown> | null;
  persona_prompt: string | null;
  legacy_answers: {
    facts?: { extracted_at?: string; dropped?: number; items?: { field: string; value: string; quote: string; question_id: string }[] } | null;
    spoken?: string[];
  } | null;
  bio: string | null;
  created_at: string;
};

const PROMPT_PREVIEW_CHARS = 1200;

/** /admin/identities/[id] — the guts of one identity. */
export default async function AdminIdentityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const rows = await safeSelect<OracleDetail>(
    supabase,
    "oracles",
    "id, name, user_id, is_legacy, one_line_hook, fingerprint, traits, persona_prompt, bio, created_at, legacy_answers",
    (q) => q.eq("id", id),
  );
  const oracle = rows[0];
  if (!oracle) {
    notFound();
  }

  const { data: creator } = await supabase.auth.admin.getUserById(
    oracle.user_id,
  );
  const creatorEmail = creator?.user?.email ?? oracle.user_id;

  const prompt = oracle.persona_prompt ?? "";
  const promptPreview =
    prompt.length > PROMPT_PREVIEW_CHARS
      ? `${prompt.slice(0, PROMPT_PREVIEW_CHARS)}…`
      : prompt;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Link
        href="/admin/identities"
        className="text-sm font-medium text-warm-300 hover:text-warm-100"
      >
        ← All identities
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
            {oracle.name}
          </h1>
          <span
            className={
              oracle.is_legacy
                ? "rounded-full bg-teal/15 px-3 py-1 text-xs font-semibold text-teal-strong"
                : "rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral-strong"
            }
          >
            {oracle.is_legacy ? "Legacy" : "Randomized"}
          </span>
        </div>
        <p className="text-sm text-warm-300">
          Created {new Date(oracle.created_at).toLocaleString()} by{" "}
          <Link
            href={`/admin/users/${oracle.user_id}`}
            className="font-medium text-warm-100 hover:text-coral-strong"
          >
            {creatorEmail}
          </Link>
        </p>
        {oracle.one_line_hook ? (
          <p className="text-base italic text-warm-200">
            &ldquo;{oracle.one_line_hook}&rdquo;
          </p>
        ) : null}
      </header>

      <Panel title="Fingerprint">
        <p className="break-all font-mono text-sm text-warm-100">
          {oracle.fingerprint ?? "—"}
        </p>
      </Panel>

      {oracle.is_legacy ? (
        <Panel
          title={`Facts sheet${
            oracle.legacy_answers?.facts?.items?.length
              ? ` (${oracle.legacy_answers.facts.items.length} verified, ${oracle.legacy_answers.facts.dropped ?? 0} dropped)`
              : ""
          }`}
        >
          {oracle.legacy_answers?.facts?.items?.length ? (
            <ul className="flex flex-col gap-2">
              {oracle.legacy_answers.facts.items.map((f) => (
                <li key={f.field} className="text-sm">
                  <span className="font-semibold text-warm-100">{f.field.replace(/_/g, " ")}:</span>{" "}
                  <span className="text-warm-100">{f.value}</span>
                  <p className="mt-0.5 text-xs italic text-warm-300">&ldquo;{f.quote}&rdquo; <span className="not-italic text-warm-400">({f.question_id})</span></p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warm-300">No verified facts yet. Every fact must quote the answer it came from; none passed, or extraction hasn&rsquo;t run.</p>
          )}
          {oracle.legacy_answers?.spoken?.length ? (
            <p className="mt-3 text-xs text-warm-400">Dictated answers: {oracle.legacy_answers.spoken.length}</p>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Traits">
        {oracle.traits ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-warm-100">
            {JSON.stringify(oracle.traits, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-warm-300">No structured traits recorded.</p>
        )}
      </Panel>

      <Panel
        title={`Persona prompt${
          prompt.length > PROMPT_PREVIEW_CHARS
            ? ` (first ${PROMPT_PREVIEW_CHARS.toLocaleString()} of ${prompt.length.toLocaleString()} chars)`
            : ""
        }`}
      >
        {promptPreview ? (
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-warm-100">
            {promptPreview}
          </pre>
        ) : (
          <p className="text-sm text-warm-300">No persona prompt stored.</p>
        )}
      </Panel>

      {oracle.bio ? (
        <Panel title="Bio">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-warm-100">
            {oracle.bio}
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({
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
      <div className="rounded-2xl bg-ink-soft px-5 py-4 ring-1 ring-warm-700">
        {children}
      </div>
    </section>
  );
}
