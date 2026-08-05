/**
 * The one predicate for "did this user block this persona?"
 *
 * profiles.muted_conversations is a jsonb array of {kind, id} written
 * by /api/user/mute-oracle with kind: "oracle". The UI calls this
 * Block, the Settings page promises it in writing ("They stop
 * reaching out. Immediately."), and App Store 1.2 / Play UGC both
 * expect it to work.
 *
 * It did not work. The writer wrote kind "oracle"; the only two crons
 * that consulted the list compared kind === "owned" — a value nothing
 * in either repo has ever written (0047 never pinned the vocabulary,
 * and the two sides drifted). Three more outreach paths never
 * consulted the list at all. Net effect: tapping Block changed the
 * button label and nothing else — the persona still messaged and
 * pushed that night.
 *
 * Every persona-initiated send now routes through this helper.
 * "owned" is accepted alongside "oracle" deliberately: nothing is
 * known to have written it, but if any historical row somewhere
 * carries it, honoring it errs on the side of the user who asked for
 * silence — the only safe direction for a block.
 */

type MuteEntryish = { kind?: unknown; id?: unknown };

export function isOracleMuted(
  mutedConversations: unknown,
  oracleId: string | null | undefined,
): boolean {
  if (!oracleId || !Array.isArray(mutedConversations)) return false;
  return (mutedConversations as MuteEntryish[]).some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      (e.kind === "oracle" || e.kind === "owned") &&
      e.id === oracleId,
  );
}
