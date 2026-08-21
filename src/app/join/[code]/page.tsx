import { redirect } from "next/navigation";

/**
 * chapter3five.app/join/CODE — the shareable half of the referral.
 *
 * A short, human URL is what actually gets texted to a friend;
 * "/auth/signup?ref=xxxx" is not something anyone reads aloud. This
 * just forwards to signup carrying the code.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const clean = (code ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  redirect(clean ? `/auth/signup?ref=${clean}` : "/auth/signup");
}
