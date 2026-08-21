import { redirect } from "next/navigation";

/**
 * /cookies existed only as a 404 (2026-08-21). The cookie disclosure
 * lives inside the privacy policy rather than as its own document, but
 * "chapter3five.app/cookies" is what a person types, what a store
 * listing or a compliance form might reference, and what an old link
 * could point at. Send them to the section instead of a dead end.
 */
export default function CookiesRedirect(): never {
  redirect("/privacy#cookies");
}
