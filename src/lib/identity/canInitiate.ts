/**
 * THE LEGIT-CONTACT RULE (Wilson 2026-08-26: "only legit contacts in
 * the contact book can send notifications").
 *
 * Born from a real incident: Danisel's un-filled photo-companion
 * placeholder (is_photo_placeholder = true, persona_prompt NULL) was
 * picked up by the persona-outreach cron and texted "hey stranger —
 * still alive out there?" — a push with no readable message behind
 * it, because placeholder contacts open the photo-upload screen, not
 * a chat thread. The chat welcome route already refuses to speak for
 * placeholders; every cron that lets a companion INITIATE must apply
 * this same test before selecting a sender.
 *
 * A companion may initiate (outreach, check-ins, anniversaries,
 * promised pings) only when it has actually been born: not a photo
 * placeholder, and with a non-empty persona to speak from. Verified
 * against production 2026-08-26: the only persona-less oracles ARE
 * the placeholders (6 of 6), so this blocks exactly the ghosts —
 * Adrian and every real companion pass.
 */
export function canCompanionInitiate(o: {
  is_photo_placeholder?: boolean | null;
  persona_prompt?: string | null;
}): boolean {
  if (o.is_photo_placeholder === true) return false;
  return (
    typeof o.persona_prompt === "string" && o.persona_prompt.trim().length > 0
  );
}
