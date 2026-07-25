import { redirect } from "next/navigation";

/**
 * /trash is retired — recently-deleted lives inside the hub FAB on
 * the dashboard now. Old bookmarks, emails, or muscle memory still
 * land on the dashboard where the hub is one tap away.
 */
export default function TrashRedirect() {
  redirect("/dashboard");
}
