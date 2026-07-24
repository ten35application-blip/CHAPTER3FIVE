import { ToolsPanel } from "./ToolsPanel";

export const metadata = {
  title: "Tools — Admin",
};

/**
 * Admin tools — destructive + test-data operations.
 *
 * Everything here bypasses RLS via the service-role client, so the
 * layout's requireAdmin gate is the only thing between the buttons
 * and the whole database.
 */
export default function AdminToolsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-gradient-cta text-xs font-bold uppercase tracking-[0.14em]">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-warm-50">
          Tools
        </h1>
        <p className="mt-2 max-w-xl text-base text-warm-300">
          Destructive and test-data operations. Every button here bypasses RLS
          and affects every user on the platform. Read the button first.
        </p>
      </header>

      <ToolsPanel />
    </div>
  );
}
