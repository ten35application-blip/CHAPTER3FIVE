import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { AdminNav } from "./_components/AdminNav";

export const metadata = {
  title: "Admin · chapter3five",
};

/**
 * /admin lives OUTSIDE the (gated) route group on purpose: admins may need
 * to reach admin surfaces before they've accepted terms (e.g. first-time
 * login) and shouldn't be forced through consumer onboarding.
 *
 * Gate: requireAdmin() → no session redirects to /auth/signin; a signed-in
 * non-admin gets notFound() (404 — the path doesn't reveal it exists).
 * The edge proxy (src/proxy.ts) applies the same check before the shell
 * even renders; this is the second, server-component layer.
 *
 * Chrome note: deliberately no logo PNG here — text wordmark only;
 * admin chrome stays quiet.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Sidebar (top bar on mobile). The mobile layout gets a
          right-aligned "Back to dashboard" pill in the top row so
          admins on their phone always have a one-tap escape hatch —
          Wilson's read of the /admin/* surfaces was that they felt
          trapped. Desktop keeps the discreet footer link at the
          bottom of the rail. */}
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-warm-700 bg-ink-soft/60 px-4 py-4 backdrop-blur md:min-h-dvh md:w-60 md:border-b-0 md:border-r md:px-5 md:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-tight text-warm-50">
              chapter<span className="text-gradient-cta">3</span>five
            </span>
            <span className="text-sm font-medium text-warm-400">· admin</span>
          </Link>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1.5 text-xs font-semibold text-coral-strong ring-1 ring-coral/25 transition-colors hover:bg-coral/15 md:hidden"
            aria-label="Back to dashboard"
          >
            <CompassIcon />
            <span>Back to dashboard</span>
          </Link>
        </div>

        <AdminNav />

        <div className="mt-auto hidden flex-col gap-2 md:flex">
          <p className="truncate text-xs text-warm-400" title={user.email ?? ""}>
            {user.email}
          </p>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-warm-300 transition-colors hover:text-warm-100"
          >
            ← Back to the app
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
