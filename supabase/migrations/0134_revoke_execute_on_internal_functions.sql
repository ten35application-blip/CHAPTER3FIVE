-- 0134_revoke_execute_on_internal_functions
--
-- Supabase's own database linter flagged six SECURITY DEFINER functions
-- reachable at /rest/v1/rpc/<name> by anon and by signed-in users. Four
-- of the six are ours to close; the other two are RLS policy helpers
-- that legitimately need EXECUTE (see the note at the bottom).
--
-- THREE TRIGGER FUNCTIONS WERE EXPOSED AS API ENDPOINTS.
--
--   protect_oracle_state()
--   protect_beneficiary_state()
--   protect_group_room_state()
--
-- These are the guards that stop a user clearing their own persona's
-- safety block, un-deleting an identity without paying, or reassigning a
-- beneficiary claim. They return `trigger` and each is bound to exactly
-- one trigger — verified, not assumed.
--
-- A trigger function does NOT need EXECUTE granted to the writing role.
-- Permission is checked when the trigger is CREATED, not when it fires.
-- So the grants here bought nothing and only widened the surface.
--
-- The proof this was an oversight rather than a decision: the two
-- sibling guards from the same design, protect_oracle_columns() and
-- protect_billing_columns(), already carry exactly the ACL this
-- migration applies — postgres and service_role only. Three were done
-- correctly and three were missed.
--
-- Exploitability today is low: PostgREST cannot meaningfully invoke a
-- trigger-returning function, and calling one outside a trigger context
-- errors on NEW/OLD. This is hygiene, not a live hole. But "the function
-- that enforces your safety blocks is listed as a public API endpoint"
-- is not a sentence to carry into a security review, and the correct
-- shape already existed three feet away.
--
-- AND is_entitled(uuid, text) WAS ANON-CALLABLE.
--
-- This one is a real, if minor, information leak. It answers "does this
-- user hold this entitlement" for ANY user id, to ANYONE, without
-- signing in. It is server-only by design — the RevenueCat webhook
-- writes iap_entitlements and server code reads through this function.
-- Confirmed by grep across BOTH repos: neither app calls it, the only
-- mentions are comments describing it as server-side. anon and
-- authenticated both lose it; service_role keeps it.
--
-- NOT TOUCHED, DELIBERATELY: user_owns_oracle, user_has_grant_on_oracle
-- and user_in_beneficiary_room. The linter flags these too, but they are
-- called from inside RLS policies on answers, oracles, archive_grants,
-- messages and the beneficiary_room tables — and a policy helper is
-- evaluated with the CALLER's privileges, so revoking EXECUTE would make
-- those policies error instead of deny. Migration 0071 granted them for
-- exactly this reason. They all gate on auth.uid(), so for anon they
-- return false rather than leaking. The clean fix is relocating them to
-- an unexposed schema, which is a change worth making deliberately and
-- verifying, not bundling into a hygiene migration.
--
-- Idempotent. Safe to run twice.

revoke execute on function public.protect_oracle_state()
  from public, anon, authenticated;

revoke execute on function public.protect_beneficiary_state()
  from public, anon, authenticated;

revoke execute on function public.protect_group_room_state()
  from public, anon, authenticated;

revoke execute on function public.is_entitled(uuid, text)
  from public, anon, authenticated;
