import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./PrintButton";

export const metadata = {
  title: "Keepsake card · chapter3five",
};

type OracleRow = {
  id: string;
  name: string;
  one_line_hook: string | null;
  is_self_archive: boolean | null;
  avatar_url: string | null;
};

/**
 * The printable heirloom (Wilson 2026-08-26). A code on a screen is a
 * string; a card in a drawer is a promise. This page renders one
 * print-ready card — name, portrait, the code, and one line in the
 * right voice — meant to be printed, cut out, and physically handed to
 * family. Creator-only, same access rule as the share page.
 *
 * Deliberately self-contained styling with a white ground: this page's
 * one job is paper. Screen shows a preview + print button; @media
 * print strips everything but the card.
 */
export default async function KeepsakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, one_line_hook, is_self_archive, avatar_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .maybeSingle<OracleRow>();
  if (!oracle) redirect("/dashboard");

  const { data: codeRow } = await supabase
    .from("inherit_codes")
    .select("code")
    .eq("oracle_id", oracle.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ code: string }>();
  if (!codeRow?.code) redirect(`/identity/legacy/${oracle.id}/share`);

  const isSelf = !!oracle.is_self_archive;
  const line = isSelf
    ? "So you can talk to me whenever you need to."
    : "So they're never more than a message away.";

  return (
    <main className="keepsake-root">
      <style>{`
        .keepsake-root { min-height: 100dvh; background: #f6f4f0; color: #1c1c1a; display: flex; flex-direction: column; align-items: center; padding: 48px 16px; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        .keepsake-actions { margin-bottom: 32px; display: flex; gap: 12px; }
        .keepsake-print-btn { background: #1c1c1a; color: #fff; border: 0; border-radius: 999px; padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer; }
        .keepsake-hint { color: #6e6e6c; font-size: 14px; max-width: 420px; text-align: center; margin-bottom: 24px; line-height: 1.5; }
        .keepsake-card { width: 5.5in; max-width: 100%; background: #fffdf9; border: 1px solid #e2ddd4; border-radius: 18px; padding: 40px 36px; text-align: center; box-shadow: 0 12px 40px -18px rgba(28,28,26,.25); }
        .keepsake-card img { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; margin: 0 auto 20px; display: block; }
        .keepsake-monogram { width: 96px; height: 96px; border-radius: 50%; background: #efe9df; color: #8a6f5c; font-size: 40px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .keepsake-name { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
        .keepsake-line { margin-top: 10px; color: #55524c; font-size: 15px; line-height: 1.5; font-style: italic; }
        .keepsake-code-label { margin-top: 28px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #8a877f; }
        .keepsake-code { margin-top: 8px; font-size: 22px; font-weight: 700; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
        .keepsake-how { margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee7db; font-size: 13px; color: #6e6b64; line-height: 1.6; }
        .keepsake-brand { margin-top: 18px; font-size: 12px; color: #a8a49b; letter-spacing: .04em; }
        @media print {
          .keepsake-root { background: #fff; padding: 0; min-height: auto; }
          .keepsake-actions, .keepsake-hint { display: none; }
          .keepsake-card { box-shadow: none; border-color: #d8d2c8; }
        }
      `}</style>

      <div className="keepsake-actions">
        <PrintButton />
      </div>
      <p className="keepsake-hint">
        Print it, cut it out, and hand it to someone. Tuck it into a
        birthday card. Leave it where they&rsquo;ll find it. The code works
        whenever they&rsquo;re ready.
      </p>

      <div className="keepsake-card">
        {oracle.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={oracle.avatar_url} alt="" />
        ) : (
          <div className="keepsake-monogram">
            {oracle.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="keepsake-name">{oracle.name}</div>
        <p className="keepsake-line">&ldquo;{line}&rdquo;</p>
        <div className="keepsake-code-label">Your inherit code</div>
        <div className="keepsake-code">{codeRow.code}</div>
        <div className="keepsake-how">
          Download <strong>chapter3five</strong> from the App Store or
          Google Play (or visit chapter3five.app), create an account, and
          choose <strong>&ldquo;Inherit an identity&rdquo;</strong> — then
          enter this code.
        </div>
        <div className="keepsake-brand">chapter3five</div>
      </div>
    </main>
  );
}
